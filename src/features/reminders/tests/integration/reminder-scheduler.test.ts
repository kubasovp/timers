import { describe, expect, it } from "vitest";
import { SchedulerRegistry } from "@/kernel/scheduler/scheduler-registry";
import { FakeClock } from "@/platform/clock/fake-clock";
import { MockNotificationAdapter } from "@/platform/notifications/mock-notification-adapter";
import { InMemorySchedulerDispatchStore } from "@/platform/scheduler-loop/scheduler-dispatch-store";
import { SchedulerLoop } from "@/platform/scheduler-loop/scheduler-loop";
import type { Reminder } from "../../domain/reminder-types";
import { InMemoryReminderRepository } from "../../persistence/in-memory-reminder-repository";
import { ReminderSchedulerSource } from "../../scheduler/reminder-scheduler-source";
import { createReminderUseCases } from "../../use-cases/reminder-use-cases";

describe("reminder scheduler integration", () => {
  it("fires due one-time reminders once and avoids duplicate dispatch", async () => {
    const clock = new FakeClock("2026-07-02T10:00:00.000Z");
    const repository = new InMemoryReminderRepository();
    const useCases = createReminderUseCases({
      clock,
      repository,
      idGenerator: { nextId: () => "reminder-1" }
    });
    const created = await useCases.createOneTime({
      title: "Coffee",
      message: "Take the cup",
      fireAtUtc: "2026-07-02T10:00:01.000Z"
    });
    expect(created.ok).toBe(true);

    const { loop, notifications } = createLoop(repository, clock);
    clock.advanceBySeconds(1);
    const first = await loop.reconcileOnce();
    const second = await loop.reconcileOnce();
    const reminder = await repository.getReminder("reminder-1");

    expect(first.actionsDispatched).toBe(1);
    expect(second.actionsCreated).toBe(0);
    expect(reminder?.status).toBe("due");
    expect(notifications.notifications).toHaveLength(1);
    expect(notifications.sounds).toHaveLength(1);
    expect(await repository.listOccurrences("reminder-1")).toHaveLength(1);
  });

  it("snoozes a due reminder and fires again at the snoozed time", async () => {
    const clock = new FakeClock("2026-07-02T10:00:00.000Z");
    const repository = new InMemoryReminderRepository();
    const useCases = createReminderUseCases({
      clock,
      repository,
      idGenerator: { nextId: () => "reminder-1" }
    });
    await useCases.createOneTime({
      title: "Move",
      fireAtUtc: "2026-07-02T10:00:01.000Z"
    });

    const { loop, notifications } = createLoop(repository, clock);
    clock.advanceBySeconds(1);
    await loop.reconcileOnce();

    const snoozed = await useCases.snooze({ id: "reminder-1", snoozeSeconds: 120 });
    expect(snoozed.ok && snoozed.value.status).toBe("snoozed");

    clock.advanceBySeconds(119);
    const beforeSnoozeEnd = await loop.reconcileOnce();
    expect(beforeSnoozeEnd.actionsDispatched).toBe(0);

    clock.advanceBySeconds(1);
    const afterSnoozeEnd = await loop.reconcileOnce();
    const occurrences = await repository.listOccurrences("reminder-1");

    expect(afterSnoozeEnd.actionsDispatched).toBe(1);
    expect(notifications.notifications).toHaveLength(2);
    expect(occurrences.map((occurrence) => occurrence.status)).toEqual(["snoozed", "fired"]);
  });

  it("skips old one-time misfires without notification storms", async () => {
    const clock = new FakeClock("2026-07-02T10:00:00.000Z");
    const repository = new InMemoryReminderRepository();
    const useCases = createReminderUseCases({
      clock,
      repository,
      idGenerator: { nextId: () => "reminder-1" }
    });
    await useCases.createOneTime({
      title: "Old reminder",
      fireAtUtc: "2026-06-30T09:59:00.000Z"
    });

    const { loop, notifications } = createLoop(repository, clock);
    const first = await loop.reconcileOnce();
    const second = await loop.reconcileOnce();
    const reminder = await repository.getReminder("reminder-1");
    const occurrences = await repository.listOccurrences("reminder-1");

    expect(first.actionsDispatched).toBe(0);
    expect(second.actionsCreated).toBe(0);
    expect(reminder?.status).toBe("done");
    expect(occurrences).toHaveLength(1);
    expect(occurrences[0]?.status).toBe("skipped");
    expect(notifications.notifications).toHaveLength(0);
  });

  it("fires one-time misfires inside the grace window once", async () => {
    const clock = new FakeClock("2026-07-02T10:00:00.000Z");
    const repository = new InMemoryReminderRepository();
    const useCases = createReminderUseCases({
      clock,
      repository,
      idGenerator: { nextId: () => "reminder-1" }
    });
    await useCases.createOneTime({
      title: "Recent missed reminder",
      fireAtUtc: "2026-07-01T11:00:00.000Z"
    });

    const { loop, notifications } = createLoop(repository, clock);
    const first = await loop.reconcileOnce();
    const second = await loop.reconcileOnce();
    const reminder = await repository.getReminder("reminder-1");

    expect(first.actionsDispatched).toBe(1);
    expect(second.actionsCreated).toBe(0);
    expect(reminder?.status).toBe("due");
    expect(notifications.notifications).toHaveLength(1);
  });

  it("queues simultaneous due reminders through the scheduler loop", async () => {
    const clock = new FakeClock("2026-07-02T10:00:00.000Z");
    const repository = new InMemoryReminderRepository();
    let nextId = 0;
    const useCases = createReminderUseCases({
      clock,
      repository,
      idGenerator: { nextId: () => `id-${++nextId}` }
    });
    await useCases.createOneTime({
      title: "First",
      fireAtUtc: "2026-07-02T10:00:05.000Z"
    });
    await useCases.createOneTime({
      title: "Second",
      fireAtUtc: "2026-07-02T10:00:05.000Z"
    });

    const { loop, notifications } = createLoop(repository, clock);
    clock.advanceBySeconds(5);
    const report = await loop.reconcileOnce();

    expect(report.actionsCreated).toBe(2);
    expect(report.actionsDispatched).toBe(2);
    expect(notifications.notifications.map((notification) => notification.title)).toEqual([
      "First",
      "Second"
    ]);
  });

  it("fires daily local-floating reminders once per local calendar date", async () => {
    const clock = new FakeClock("2026-07-03T08:15:00.000Z");
    const repository = new InMemoryReminderRepository();
    await repository.saveReminder(
      dailyReminder({
        nextFireAtUtc: "2026-07-02T08:00:00.000Z",
        timezoneSnapshot: "Europe/Berlin"
      })
    );

    const { loop, notifications } = createLoop(repository, clock, "Europe/Berlin");
    const first = await loop.reconcileOnce();
    const second = await loop.reconcileOnce();
    const reminder = await repository.getReminder("reminder-1");
    const occurrences = await repository.listOccurrences("reminder-1");

    expect(first.actionsDispatched).toBe(1);
    expect(second.actionsCreated).toBe(0);
    expect(reminder?.status).toBe("due");
    expect(reminder?.lastFiredLocalDate).toBe("2026-07-03");
    expect(reminder?.nextFireAtUtc).toBe("2026-07-04T08:00:00.000Z");
    expect(occurrences).toHaveLength(1);
    expect(occurrences[0]?.localDateKey).toBe("2026-07-03");
    expect(notifications.notifications).toHaveLength(1);
  });

  it("recalculates daily local-floating next fire after timezone switch", async () => {
    const clock = new FakeClock("2026-07-03T13:30:00.000Z");
    const repository = new InMemoryReminderRepository();
    await repository.saveReminder(
      dailyReminder({
        nextFireAtUtc: "2026-07-03T08:00:00.000Z",
        timezoneSnapshot: "Europe/Berlin"
      })
    );

    const { loop, notifications } = createLoop(repository, clock, "America/New_York");
    const report = await loop.reconcileOnce();
    const reminder = await repository.getReminder("reminder-1");

    expect(report.actionsDispatched).toBe(0);
    expect(reminder?.status).toBe("enabled");
    expect(reminder?.nextFireAtUtc).toBe("2026-07-03T14:00:00.000Z");
    expect(reminder?.timezoneSnapshot).toBe("America/New_York");
    expect(notifications.notifications).toHaveLength(0);
  });

  it("skips stale daily local-floating occurrences once", async () => {
    const clock = new FakeClock("2026-07-03T10:30:00.000Z");
    const repository = new InMemoryReminderRepository();
    await repository.saveReminder(dailyReminder());

    const { loop, notifications } = createLoop(repository, clock, "Europe/Berlin");
    const first = await loop.reconcileOnce();
    const second = await loop.reconcileOnce();
    const reminder = await repository.getReminder("reminder-1");
    const occurrences = await repository.listOccurrences("reminder-1");

    expect(first.actionsDispatched).toBe(0);
    expect(second.actionsCreated).toBe(0);
    expect(reminder?.status).toBe("enabled");
    expect(reminder?.nextFireAtUtc).toBe("2026-07-04T08:00:00.000Z");
    expect(occurrences).toHaveLength(1);
    expect(occurrences[0]?.status).toBe("skipped");
    expect(occurrences[0]?.localDateKey).toBe("2026-07-03");
    expect(notifications.notifications).toHaveLength(0);
  });

  it("fires the latest due interval after sleep without catch-up storms", async () => {
    const clock = new FakeClock("2026-07-03T11:05:00.000Z");
    const repository = new InMemoryReminderRepository();
    await repository.saveReminder(intervalReminder());

    const { loop, notifications } = createLoop(repository, clock);
    const first = await loop.reconcileOnce();
    const second = await loop.reconcileOnce();
    const reminder = await repository.getReminder("reminder-1");
    const occurrences = await repository.listOccurrences("reminder-1");

    expect(first.actionsDispatched).toBe(1);
    expect(second.actionsCreated).toBe(0);
    expect(reminder?.status).toBe("due");
    expect(reminder?.nextFireAtUtc).toBe("2026-07-03T12:00:00.000Z");
    expect(occurrences).toHaveLength(1);
    expect(occurrences[0]?.scheduledForUtc).toBe("2026-07-03T11:00:00.000Z");
    expect(notifications.notifications).toHaveLength(1);
  });

  it("skips old interval misfires outside the interval grace window", async () => {
    const clock = new FakeClock("2026-07-03T10:00:00.000Z");
    const repository = new InMemoryReminderRepository();
    await repository.saveReminder(
      intervalReminder({
        intervalSeconds: 24 * 60 * 60,
        intervalAnchorAtUtc: "2026-07-01T00:00:00.000Z",
        nextFireAtUtc: "2026-07-02T00:00:00.000Z"
      })
    );

    const { loop, notifications } = createLoop(repository, clock);
    const first = await loop.reconcileOnce();
    const second = await loop.reconcileOnce();
    const reminder = await repository.getReminder("reminder-1");
    const occurrences = await repository.listOccurrences("reminder-1");

    expect(first.actionsDispatched).toBe(0);
    expect(second.actionsCreated).toBe(0);
    expect(reminder?.status).toBe("enabled");
    expect(reminder?.nextFireAtUtc).toBe("2026-07-04T00:00:00.000Z");
    expect(occurrences).toHaveLength(1);
    expect(occurrences[0]?.status).toBe("skipped");
    expect(occurrences[0]?.scheduledForUtc).toBe("2026-07-03T00:00:00.000Z");
    expect(notifications.notifications).toHaveLength(0);
  });

  it("refires snoozed recurring occurrences with an explicit snooze occurrence key", async () => {
    const clock = new FakeClock("2026-07-03T08:00:00.000Z");
    const repository = new InMemoryReminderRepository();
    await repository.saveReminder(intervalReminder());

    const { loop, notifications } = createLoop(repository, clock);
    clock.set("2026-07-03T09:00:00.000Z");
    await loop.reconcileOnce();

    const useCases = createReminderUseCases({
      clock,
      repository,
      idGenerator: { nextId: () => "history-1" }
    });
    const snoozed = await useCases.snooze({ id: "reminder-1", snoozeSeconds: 120 });
    expect(snoozed.ok && snoozed.value.status).toBe("snoozed");

    clock.set("2026-07-03T09:02:00.000Z");
    const refire = await loop.reconcileOnce();
    const occurrences = await repository.listOccurrences("reminder-1");
    const reminder = await repository.getReminder("reminder-1");

    expect(refire.actionsDispatched).toBe(1);
    expect(notifications.notifications).toHaveLength(2);
    expect(occurrences.map((occurrence) => occurrence.status)).toEqual(["snoozed", "fired"]);
    expect(occurrences[1]?.scheduledForUtc).toBe("2026-07-03T09:02:00.000Z");
    expect(reminder?.status).toBe("due");
    expect(reminder?.nextFireAtUtc).toBe("2026-07-03T10:00:00.000Z");
  });
});

function createLoop(
  repository: InMemoryReminderRepository,
  clock: FakeClock,
  timeZone = "UTC"
): {
  loop: SchedulerLoop;
  notifications: MockNotificationAdapter;
} {
  const registry = new SchedulerRegistry();
  registry.addSource(
    new ReminderSchedulerSource(repository, {
      resolveCurrentTimeZone: () => timeZone
    })
  );
  const notifications = new MockNotificationAdapter();
  const loop = new SchedulerLoop({
    scheduler: registry,
    clock,
    notifications,
    dispatchStore: new InMemorySchedulerDispatchStore()
  });

  return { loop, notifications };
}

function dailyReminder(overrides: Partial<Reminder> = {}): Reminder {
  return {
    id: "reminder-1",
    title: "Hydrate",
    status: "enabled",
    scheduleType: "daily",
    timeSemantics: "local_floating",
    dailyTimeLocal: "10:00",
    nextFireAtUtc: "2026-07-03T08:00:00.000Z",
    timezoneSnapshot: "Europe/Berlin",
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
    title: "Move",
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
