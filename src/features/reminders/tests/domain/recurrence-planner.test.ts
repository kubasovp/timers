import { describe, expect, it } from "vitest";
import type { Reminder, ReminderOccurrence } from "../../domain/reminder-types";
import {
  getNextRecurringFireAt,
  planReminderRecurrence
} from "../../domain/recurrence-planner";

describe("recurrence planner", () => {
  describe("daily local-floating reminders", () => {
    it("D01 keeps today's candidate scheduled when it is still in the future", () => {
      const decision = planReminderRecurrence(dailyReminder(), {
        nowUtc: "2026-07-03T07:00:00.000Z",
        currentTimeZone: "Europe/Berlin"
      });

      expect(decision).toMatchObject({
        kind: "none",
        nextFireAtUtc: "2026-07-03T08:00:00.000Z",
        reason: "future"
      });
    });

    it("D02 fires today's candidate inside the daily grace window", () => {
      const decision = planReminderRecurrence(dailyReminder(), {
        nowUtc: "2026-07-03T08:15:00.000Z",
        currentTimeZone: "Europe/Berlin"
      });

      expect(decision).toMatchObject({
        kind: "fire",
        scheduledForUtc: "2026-07-03T08:00:00.000Z",
        nextFireAtUtc: "2026-07-04T08:00:00.000Z",
        localDateKey: "2026-07-03"
      });
    });

    it("D03 skips today's candidate outside the daily grace window", () => {
      const decision = planReminderRecurrence(dailyReminder(), {
        nowUtc: "2026-07-03T10:30:00.000Z",
        currentTimeZone: "Europe/Berlin"
      });

      expect(decision).toMatchObject({
        kind: "skip",
        scheduledForUtc: "2026-07-03T08:00:00.000Z",
        nextFireAtUtc: "2026-07-04T08:00:00.000Z",
        localDateKey: "2026-07-03",
        reason: "daily_grace_window_exceeded"
      });
    });

    it("D04 deduplicates a local calendar date that already fired", () => {
      const decision = planReminderRecurrence(
        dailyReminder({ lastFiredLocalDate: "2026-07-03" }),
        {
          nowUtc: "2026-07-03T08:30:00.000Z",
          currentTimeZone: "Europe/Berlin"
        }
      );

      expect(decision).toMatchObject({
        kind: "none",
        nextFireAtUtc: "2026-07-04T08:00:00.000Z",
        reason: "deduplicated"
      });
    });

    it("deduplicates a local calendar date that was already skipped", () => {
      const decision = planReminderRecurrence(dailyReminder(), {
        nowUtc: "2026-07-03T10:31:00.000Z",
        currentTimeZone: "Europe/Berlin",
        latestOccurrence: occurrence({
          scheduledForUtc: "2026-07-03T08:00:00.000Z",
          status: "skipped",
          localDateKey: "2026-07-03"
        })
      });

      expect(decision).toMatchObject({
        kind: "none",
        nextFireAtUtc: "2026-07-04T08:00:00.000Z",
        reason: "already_processed"
      });
    });

    it("D05 reconstructs next fire from rule state when persisted next is stale", () => {
      const decision = planReminderRecurrence(
        dailyReminder({ nextFireAtUtc: "2026-07-02T08:00:00.000Z" }),
        {
          nowUtc: "2026-07-03T07:00:00.000Z",
          currentTimeZone: "Europe/Berlin"
        }
      );

      expect(decision).toMatchObject({
        kind: "none",
        nextFireAtUtc: "2026-07-03T08:00:00.000Z"
      });
    });

    it("D06 shifts a spring-forward nonexistent local time to the nearest valid local time", () => {
      const decision = planReminderRecurrence(
        dailyReminder({
          dailyTimeLocal: "02:30",
          nextFireAtUtc: "2026-03-29T01:00:00.000Z"
        }),
        {
          nowUtc: "2026-03-29T00:30:00.000Z",
          currentTimeZone: "Europe/Berlin"
        }
      );

      expect(decision).toMatchObject({
        kind: "none",
        nextFireAtUtc: "2026-03-29T01:00:00.000Z"
      });
    });

    it("D07 chooses the first local occurrence during fall-back overlap", () => {
      const decision = planReminderRecurrence(
        dailyReminder({
          dailyTimeLocal: "02:30",
          nextFireAtUtc: "2026-10-25T00:30:00.000Z"
        }),
        {
          nowUtc: "2026-10-24T23:30:00.000Z",
          currentTimeZone: "Europe/Berlin"
        }
      );

      expect(decision).toMatchObject({
        kind: "none",
        nextFireAtUtc: "2026-10-25T00:30:00.000Z"
      });
    });

    it("D08 does not fire again during the second fall-back occurrence", () => {
      const decision = planReminderRecurrence(
        dailyReminder({
          dailyTimeLocal: "02:30",
          lastFiredLocalDate: "2026-10-25",
          nextFireAtUtc: "2026-10-25T00:30:00.000Z"
        }),
        {
          nowUtc: "2026-10-25T01:45:00.000Z",
          currentTimeZone: "Europe/Berlin"
        }
      );

      expect(decision).toMatchObject({
        kind: "none",
        nextFireAtUtc: "2026-10-26T01:30:00.000Z",
        reason: "deduplicated"
      });
    });

    it("D09 recalculates a future local-floating candidate after timezone switch", () => {
      const decision = planReminderRecurrence(dailyReminder(), {
        nowUtc: "2026-07-03T13:30:00.000Z",
        currentTimeZone: "America/New_York"
      });

      expect(decision).toMatchObject({
        kind: "none",
        nextFireAtUtc: "2026-07-03T14:00:00.000Z"
      });
    });

    it("D10 grace-fires today's candidate after timezone switch", () => {
      const decision = planReminderRecurrence(dailyReminder(), {
        nowUtc: "2026-07-03T01:15:00.000Z",
        currentTimeZone: "Asia/Tokyo"
      });

      expect(decision).toMatchObject({
        kind: "fire",
        scheduledForUtc: "2026-07-03T01:00:00.000Z",
        localDateKey: "2026-07-03"
      });
    });

    it("D11 skips a stale candidate after timezone switch", () => {
      const decision = planReminderRecurrence(dailyReminder(), {
        nowUtc: "2026-07-03T03:30:00.000Z",
        currentTimeZone: "Asia/Tokyo"
      });

      expect(decision).toMatchObject({
        kind: "skip",
        scheduledForUtc: "2026-07-03T01:00:00.000Z",
        nextFireAtUtc: "2026-07-04T01:00:00.000Z"
      });
    });

    it("D12 keys dedup by local calendar date instead of UTC date", () => {
      const decision = planReminderRecurrence(
        dailyReminder({
          dailyTimeLocal: "00:00",
          nextFireAtUtc: "2025-12-31T11:00:00.000Z"
        }),
        {
          nowUtc: "2025-12-31T11:15:00.000Z",
          currentTimeZone: "Pacific/Auckland"
        }
      );

      expect(decision).toMatchObject({
        kind: "fire",
        scheduledForUtc: "2025-12-31T11:00:00.000Z",
        localDateKey: "2026-01-01"
      });
    });
  });

  describe("interval reminders", () => {
    it("I01 keeps the next interval scheduled when it is still future", () => {
      const decision = planReminderRecurrence(intervalReminder(), {
        nowUtc: "2026-07-03T08:30:00.000Z",
        currentTimeZone: "UTC"
      });

      expect(decision).toMatchObject({
        kind: "none",
        nextFireAtUtc: "2026-07-03T09:00:00.000Z",
        reason: "future"
      });
    });

    it("I02 fires an exact interval boundary", () => {
      const decision = planReminderRecurrence(intervalReminder(), {
        nowUtc: "2026-07-03T09:00:00.000Z",
        currentTimeZone: "UTC"
      });

      expect(decision).toMatchObject({
        kind: "fire",
        scheduledForUtc: "2026-07-03T09:00:00.000Z",
        nextFireAtUtc: "2026-07-03T10:00:00.000Z"
      });
    });

    it("I03 fires at most the latest due interval after sleep or restart", () => {
      const decision = planReminderRecurrence(intervalReminder(), {
        nowUtc: "2026-07-03T11:05:00.000Z",
        currentTimeZone: "UTC"
      });

      expect(decision).toMatchObject({
        kind: "fire",
        scheduledForUtc: "2026-07-03T11:00:00.000Z",
        nextFireAtUtc: "2026-07-03T12:00:00.000Z"
      });
    });

    it("I04 skips the latest due interval outside the interval grace window", () => {
      const decision = planReminderRecurrence(
        intervalReminder({
          intervalSeconds: 24 * 60 * 60,
          intervalAnchorAtUtc: "2026-07-01T00:00:00.000Z",
          nextFireAtUtc: "2026-07-02T00:00:00.000Z"
        }),
        {
          nowUtc: "2026-07-03T10:00:00.000Z",
          currentTimeZone: "UTC"
        }
      );

      expect(decision).toMatchObject({
        kind: "skip",
        scheduledForUtc: "2026-07-03T00:00:00.000Z",
        nextFireAtUtc: "2026-07-04T00:00:00.000Z",
        reason: "interval_grace_window_exceeded"
      });
    });

    it("I05 returns none for a repeated reconcile after an occurrence was processed", () => {
      const decision = planReminderRecurrence(intervalReminder(), {
        nowUtc: "2026-07-03T09:00:00.000Z",
        currentTimeZone: "UTC",
        latestOccurrence: occurrence({
          scheduledForUtc: "2026-07-03T09:00:00.000Z",
          status: "fired"
        })
      });

      expect(decision).toMatchObject({
        kind: "none",
        nextFireAtUtc: "2026-07-03T10:00:00.000Z",
        reason: "already_processed"
      });
    });

    it("I06 keeps UTC cadence across DST transitions", () => {
      const decision = planReminderRecurrence(
        intervalReminder({
          intervalAnchorAtUtc: "2026-03-29T00:00:00.000Z",
          nextFireAtUtc: "2026-03-29T01:00:00.000Z"
        }),
        {
          nowUtc: "2026-03-29T03:00:00.000Z",
          currentTimeZone: "Europe/Berlin"
        }
      );

      expect(decision).toMatchObject({
        kind: "fire",
        scheduledForUtc: "2026-03-29T03:00:00.000Z",
        nextFireAtUtc: "2026-03-29T04:00:00.000Z"
      });
    });

    it("computes the next recurring interval after a processed occurrence", () => {
      expect(
        getNextRecurringFireAt(intervalReminder(), {
          nowUtc: "2026-07-03T09:05:00.000Z",
          currentTimeZone: "UTC",
          latestOccurrence: occurrence({
            scheduledForUtc: "2026-07-03T09:00:00.000Z",
            status: "done"
          })
        })
      ).toBe("2026-07-03T10:00:00.000Z");
    });
  });
});

function dailyReminder(overrides: Partial<Reminder> = {}): Reminder {
  return {
    id: "reminder-1",
    title: "Daily",
    status: "enabled",
    scheduleType: "daily",
    timeSemantics: "local_floating",
    dailyTimeLocal: "10:00",
    nextFireAtUtc: "2026-07-03T08:00:00.000Z",
    isEnabled: true,
    createdAtUtc: "2026-07-01T00:00:00.000Z",
    updatedAtUtc: "2026-07-01T00:00:00.000Z",
    version: 1,
    ...overrides
  };
}

function intervalReminder(overrides: Partial<Reminder> = {}): Reminder {
  return {
    id: "reminder-1",
    title: "Interval",
    status: "enabled",
    scheduleType: "interval",
    timeSemantics: "fixed_utc",
    intervalSeconds: 3600,
    intervalAnchorAtUtc: "2026-07-03T08:00:00.000Z",
    nextFireAtUtc: "2026-07-03T09:00:00.000Z",
    isEnabled: true,
    createdAtUtc: "2026-07-01T00:00:00.000Z",
    updatedAtUtc: "2026-07-01T00:00:00.000Z",
    version: 1,
    ...overrides
  };
}

function occurrence(
  overrides: Partial<ReminderOccurrence> = {}
): Pick<ReminderOccurrence, "scheduledForUtc" | "status" | "localDateKey"> {
  return {
    scheduledForUtc: "2026-07-03T09:00:00.000Z",
    status: "fired",
    ...overrides
  };
}
