import { describe, expect, it } from "vitest";
import {
  acknowledgeRecurringReminder,
  acknowledgeReminder,
  createDailyReminder,
  createIntervalReminder,
  createOneTimeReminder,
  deleteReminder,
  disableReminder,
  enableReminder,
  markRecurringReminderDue,
  markReminderDue,
  snoozeReminder
} from "../../domain/reminder-state-machine";

describe("reminder state machine", () => {
  it("creates, disables, enables and deletes a one-time reminder", () => {
    const created = createOneTimeReminder({
      id: "reminder-1",
      now: "2026-07-02T10:00:00.000Z",
      title: "Standup",
      fireAtUtc: "2026-07-02T10:15:00.000Z"
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const disabled = disableReminder(created.value, "2026-07-02T10:01:00.000Z");
    expect(disabled.ok && disabled.value.status).toBe("disabled");

    if (!disabled.ok) return;
    const enabled = enableReminder(disabled.value, "2026-07-02T10:02:00.000Z");
    expect(enabled.ok && enabled.value.status).toBe("enabled");

    if (!enabled.ok) return;
    const deleted = deleteReminder(enabled.value, "2026-07-02T10:03:00.000Z");
    expect(deleted.ok && deleted.value.status).toBe("deleted");
    expect(deleted.ok && deleted.value.isEnabled).toBe(false);
  });

  it("moves due reminders through snooze and done", () => {
    const created = createOneTimeReminder({
      id: "reminder-1",
      now: "2026-07-02T10:00:00.000Z",
      title: "Stretch",
      fireAtUtc: "2026-07-02T10:01:00.000Z"
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const due = markReminderDue(created.value, "2026-07-02T10:01:00.000Z");
    expect(due.ok && due.value.status).toBe("due");

    if (!due.ok) return;
    const snoozed = snoozeReminder(due.value, "2026-07-02T10:01:05.000Z", 300);
    expect(snoozed.ok && snoozed.value.status).toBe("snoozed");
    expect(snoozed.ok && snoozed.value.nextFireAtUtc).toBe("2026-07-02T10:06:05.000Z");

    if (!snoozed.ok) return;
    const disabled = disableReminder(snoozed.value, "2026-07-02T10:02:00.000Z");
    expect(disabled.ok && disabled.value.nextFireAtUtc).toBe("2026-07-02T10:06:05.000Z");

    if (!disabled.ok) return;
    const enabled = enableReminder(disabled.value, "2026-07-02T10:03:00.000Z");
    expect(enabled.ok && enabled.value.nextFireAtUtc).toBe("2026-07-02T10:06:05.000Z");

    if (!enabled.ok) return;
    const dueAgain = markReminderDue(enabled.value, "2026-07-02T10:06:05.000Z");
    expect(dueAgain.ok && dueAgain.value.status).toBe("due");

    if (!dueAgain.ok) return;
    const done = acknowledgeReminder(dueAgain.value, "2026-07-02T10:06:10.000Z");
    expect(done.ok && done.value.status).toBe("done");
    expect(done.ok && done.value.isEnabled).toBe(false);
  });

  it("rejects invalid transitions", () => {
    const created = createOneTimeReminder({
      id: "reminder-1",
      now: "2026-07-02T10:00:00.000Z",
      title: "Stretch",
      fireAtUtc: "2026-07-02T10:01:00.000Z"
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const invalidDone = acknowledgeReminder(created.value, "2026-07-02T10:00:05.000Z");
    expect(invalidDone.ok).toBe(false);
  });

  it("acknowledges recurring daily reminders without making the rule terminal", () => {
    const created = createDailyReminder({
      id: "reminder-1",
      now: "2026-07-02T10:00:00.000Z",
      title: "Hydrate",
      dailyTimeLocal: "10:00",
      nextFireAtUtc: "2026-07-03T08:00:00.000Z",
      timezoneSnapshot: "Europe/Berlin"
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const due = markRecurringReminderDue(created.value, "2026-07-03T08:00:00.000Z", {
      scheduledForUtc: "2026-07-03T08:00:00.000Z",
      nextFireAtUtc: "2026-07-04T08:00:00.000Z",
      localDateKey: "2026-07-03",
      timezoneSnapshot: "Europe/Berlin"
    });
    expect(due.ok && due.value.status).toBe("due");
    expect(due.ok && due.value.lastFiredLocalDate).toBe("2026-07-03");

    if (!due.ok) return;
    const done = acknowledgeRecurringReminder(
      due.value,
      "2026-07-03T08:01:00.000Z",
      "2026-07-04T08:00:00.000Z",
      "Europe/Berlin"
    );

    expect(done.ok && done.value.status).toBe("enabled");
    expect(done.ok && done.value.isEnabled).toBe(true);
    expect(done.ok && done.value.nextFireAtUtc).toBe("2026-07-04T08:00:00.000Z");
  });

  it("snoozes and disables recurring occurrences through the same rule state", () => {
    const created = createIntervalReminder({
      id: "reminder-1",
      now: "2026-07-02T10:00:00.000Z",
      title: "Move",
      intervalSeconds: 3600,
      intervalAnchorAtUtc: "2026-07-02T10:00:00.000Z",
      nextFireAtUtc: "2026-07-02T11:00:00.000Z"
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const due = markRecurringReminderDue(created.value, "2026-07-02T11:00:00.000Z", {
      scheduledForUtc: "2026-07-02T11:00:00.000Z",
      nextFireAtUtc: "2026-07-02T12:00:00.000Z"
    });
    expect(due.ok).toBe(true);
    if (!due.ok) return;

    const snoozed = snoozeReminder(due.value, "2026-07-02T11:00:10.000Z", 300);
    expect(snoozed.ok && snoozed.value.status).toBe("snoozed");
    expect(snoozed.ok && snoozed.value.nextFireAtUtc).toBe("2026-07-02T11:05:10.000Z");

    if (!snoozed.ok) return;
    const disabled = disableReminder(snoozed.value, "2026-07-02T11:01:00.000Z");
    expect(disabled.ok && disabled.value.status).toBe("disabled");
    expect(disabled.ok && disabled.value.isEnabled).toBe(false);
  });
});
