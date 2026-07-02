import {
  createSchedulerIdempotencyKey,
  type SchedulerAction,
  type SchedulerSource
} from "@/kernel/scheduler/scheduler-types";
import { compareInstants, parseInstant, type Instant } from "@/shared/time/instant";
import {
  markReminderDue,
  skipMissedOneTimeReminder
} from "../domain/reminder-state-machine";
import type { Reminder, ReminderOccurrence } from "../domain/reminder-types";
import type { ReminderRepository } from "../ports";
import { createFiredOccurrence } from "../use-cases/reminder-use-cases";

const ONE_TIME_GRACE_WINDOW_SECONDS = 24 * 60 * 60;

export class ReminderSchedulerSource implements SchedulerSource {
  readonly id = "reminders.one-time-due";
  readonly sourceType = "reminder";

  constructor(private readonly repository: ReminderRepository) {}

  async getNextFireAt(): Promise<Instant | null> {
    const reminders = await this.repository.listReminders();
    const next = reminders
      .filter(
        (reminder) =>
          reminder.isEnabled &&
          reminder.scheduleType === "one_time" &&
          (reminder.status === "enabled" || reminder.status === "snoozed")
      )
      .sort((a, b) => compareInstants(a.nextFireAtUtc, b.nextFireAtUtc))[0];

    return next?.nextFireAtUtc ?? null;
  }

  async reconcile(now: Instant): Promise<SchedulerAction[]> {
    const dueReminders = await this.repository.listDueReminders(now);
    const actions: SchedulerAction[] = [];

    for (const reminder of dueReminders) {
      const scheduledForUtc = reminder.nextFireAtUtc;
      const idempotencyKey = reminderIdempotencyKey(reminder, scheduledForUtc);
      const existing = await this.repository.getOccurrenceByIdempotencyKey(idempotencyKey);

      if (existing && existing.status !== "failed") {
        continue;
      }

      if (isOutsideGraceWindow(scheduledForUtc, now)) {
        await this.skipMissed(reminder, scheduledForUtc, now, idempotencyKey);
        continue;
      }

      const due = markReminderDue(reminder, now, scheduledForUtc);

      if (!due.ok) {
        continue;
      }

      await this.repository.saveReminder(due.value);
      await this.repository.saveOccurrence(
        createFiredOccurrence({
          id: reminderOccurrenceId(reminder, scheduledForUtc),
          reminderId: reminder.id,
          scheduledForUtc,
          firedAtUtc: now,
          idempotencyKey
        })
      );
      await this.repository.appendHistoryEvent({
        id: `${reminder.id}:reminder_fired:${scheduledForUtc}`,
        reminderId: reminder.id,
        eventType: "reminder_fired",
        eventPayload: {
          scheduledForUtc,
          detectedAtUtc: now,
          previousStatus: reminder.status
        },
        occurredAtUtc: now
      });
      actions.push(createReminderDueAction(reminder, scheduledForUtc, now));
    }

    return actions;
  }

  private async skipMissed(
    reminder: Reminder,
    scheduledForUtc: Instant,
    now: Instant,
    idempotencyKey: string
  ): Promise<void> {
    const skipped = skipMissedOneTimeReminder(reminder, now);

    if (!skipped.ok) {
      return;
    }

    const occurrence: ReminderOccurrence = {
      id: reminderOccurrenceId(reminder, scheduledForUtc),
      reminderId: reminder.id,
      scheduledForUtc,
      status: "skipped",
      idempotencyKey
    };

    await this.repository.saveReminder(skipped.value);
    await this.repository.saveOccurrence(occurrence);
    await this.repository.appendHistoryEvent({
      id: `${reminder.id}:reminder_skipped:${scheduledForUtc}`,
      reminderId: reminder.id,
      eventType: "reminder_skipped",
      eventPayload: {
        scheduledForUtc,
        detectedAtUtc: now,
        reason: "one_time_grace_window_exceeded"
      },
      occurredAtUtc: now
    });
  }
}

function createReminderDueAction(
  reminder: Reminder,
  scheduledForUtc: Instant,
  detectedAtUtc: Instant
): SchedulerAction {
  const idempotencyKey = reminderIdempotencyKey(reminder, scheduledForUtc);

  return {
    kind: "user_alert",
    source: {
      sourceType: "reminder",
      sourceId: reminder.id
    },
    occurrence: {
      occurrenceId: reminderOccurrenceId(reminder, scheduledForUtc),
      scheduledForUtc,
      detectedAtUtc,
      idempotencyKey
    },
    delivery: {
      channels: ["os_notification", "sound"],
      notification: {
        title: reminder.title,
        body: reminder.message ?? "Reminder due.",
        urgency: "normal"
      },
      sound: {
        soundId: "reminder-due",
        volume: 0.5
      }
    },
    retry: {
      maxAttempts: 3,
      backoffMs: [1000, 5000, 15000]
    },
    queue: {
      policy: "fifo_by_scheduled_time",
      groupKey: "reminders"
    }
  };
}

function reminderIdempotencyKey(reminder: Reminder, scheduledForUtc: Instant): string {
  return createSchedulerIdempotencyKey({
    sourceType: "reminder",
    sourceId: reminder.id,
    scheduledForUtc,
    kind: "user_alert"
  });
}

function reminderOccurrenceId(reminder: Reminder, scheduledForUtc: Instant): string {
  return `${reminder.id}:reminder_due:${scheduledForUtc}`;
}

function isOutsideGraceWindow(scheduledForUtc: Instant, now: Instant): boolean {
  return parseInstant(now) - parseInstant(scheduledForUtc) > ONE_TIME_GRACE_WINDOW_SECONDS * 1000;
}
