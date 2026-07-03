import {
  createSchedulerIdempotencyKey,
  type SchedulerAction,
  type SchedulerSource
} from "@/kernel/scheduler/scheduler-types";
import {
  compareInstants,
  isDue,
  parseInstant,
  type Instant
} from "@/shared/time/instant";
import {
  markRecurringReminderDue,
  markReminderDue,
  recordIntervalReminderFire,
  rescheduleReminder,
  resumeIntervalReminder,
  skipMissedOneTimeReminder
} from "../domain/reminder-state-machine";
import type { Reminder, ReminderOccurrence } from "../domain/reminder-types";
import {
  getNextRecurringFireAt,
  planReminderRecurrence,
  type RecurrencePlannerDecision
} from "../domain/recurrence-planner";
import type { ReminderRepository } from "../ports";
import { createFiredOccurrence } from "../use-cases/reminder-use-cases";

const ONE_TIME_GRACE_WINDOW_SECONDS = 24 * 60 * 60;

export class ReminderSchedulerSource implements SchedulerSource {
  readonly id = "reminders.due";
  readonly sourceType = "reminder";

  constructor(
    private readonly repository: ReminderRepository,
    private readonly options: {
      resolveCurrentTimeZone?: () => string;
    } = {}
  ) {}

  async getNextFireAt(_now: Instant): Promise<Instant | null> {
    const reminders = await this.repository.listReminders();
    const next = reminders
      .filter(isSchedulerActiveReminder)
      .sort((a, b) => compareInstants(a.nextFireAtUtc, b.nextFireAtUtc))[0];

    return next?.nextFireAtUtc ?? null;
  }

  async reconcile(now: Instant): Promise<SchedulerAction[]> {
    const activeReminders = (await this.repository.listReminders())
      .filter(isSchedulerActiveReminder)
      .sort((a, b) => compareInstants(a.nextFireAtUtc, b.nextFireAtUtc));
    const actions: SchedulerAction[] = [];
    const currentTimeZone = this.currentTimeZone();

    for (const reminder of activeReminders) {
      if (reminder.scheduleType === "one_time") {
        if (isDue(reminder.nextFireAtUtc, now)) {
          const action = await this.reconcileOneTime(reminder, now);

          if (action) {
            actions.push(action);
          }
        }
        continue;
      }

      if (reminder.status === "snoozed") {
        if (isDue(reminder.nextFireAtUtc, now)) {
          const action = await this.reconcileSnoozedRecurring(
            reminder,
            now,
            currentTimeZone
          );

          if (action) {
            actions.push(action);
          }
        }
        continue;
      }

      const action = await this.reconcileEnabledRecurring(reminder, now, currentTimeZone);

      if (action) {
        actions.push(action);
      }
    }

    return actions;
  }

  private async reconcileOneTime(
    reminder: Reminder,
    now: Instant
  ): Promise<SchedulerAction | null> {
    const scheduledForUtc = reminder.nextFireAtUtc;
    const idempotencyKey = reminderIdempotencyKey(reminder, scheduledForUtc);
    const existing = await this.repository.getOccurrenceByIdempotencyKey(idempotencyKey);

    if (existing && existing.status !== "failed") {
      return null;
    }

    if (isOutsideGraceWindow(scheduledForUtc, now)) {
      await this.skipMissed(reminder, scheduledForUtc, now, idempotencyKey);
      return null;
    }

    const due = markReminderDue(reminder, now, scheduledForUtc);

    if (!due.ok) {
      return null;
    }

    await this.repository.saveReminder(due.value);
    await this.saveFiredOccurrence(reminder, scheduledForUtc, now, idempotencyKey);
    await this.appendFiredHistory(reminder, scheduledForUtc, now);
    return createReminderDueAction(reminder, scheduledForUtc, now);
  }

  private async reconcileEnabledRecurring(
    reminder: Reminder,
    now: Instant,
    currentTimeZone: string
  ): Promise<SchedulerAction | null> {
    const latestOccurrence = await this.repository.getLatestOccurrence(reminder.id);
    const decision = planReminderRecurrence(reminder, {
      nowUtc: now,
      currentTimeZone,
      latestOccurrence
    });

    if (decision.kind === "invalid") {
      return null;
    }

    if (decision.kind === "none") {
      await this.saveRescheduleIfChanged(reminder, now, decision);
      return null;
    }

    const idempotencyKey = reminderIdempotencyKey(reminder, decision.scheduledForUtc);
    const existing = await this.repository.getOccurrenceByIdempotencyKey(idempotencyKey);

    if (existing && existing.status !== "failed") {
      await this.rescheduleRecurring(reminder, now, decision.nextFireAtUtc, currentTimeZone);
      return null;
    }

    if (decision.kind === "skip") {
      await this.skipRecurring(reminder, decision, now, idempotencyKey, currentTimeZone);
      return null;
    }

    const fired =
      reminder.scheduleType === "interval"
        ? recordIntervalReminderFire(reminder, now, {
            scheduledForUtc: decision.scheduledForUtc,
            nextFireAtUtc: decision.nextFireAtUtc,
            timezoneSnapshot: currentTimeZone
          })
        : markRecurringReminderDue(reminder, now, {
            scheduledForUtc: decision.scheduledForUtc,
            nextFireAtUtc: decision.nextFireAtUtc,
            localDateKey: decision.localDateKey,
            timezoneSnapshot: currentTimeZone
          });

    if (!fired.ok) {
      return null;
    }

    await this.repository.saveReminder(fired.value);
    await this.saveFiredOccurrence(
      reminder,
      decision.scheduledForUtc,
      now,
      idempotencyKey,
      decision.localDateKey
    );
    await this.appendFiredHistory(reminder, decision.scheduledForUtc, now, {
      localDateKey: decision.localDateKey,
      nextFireAtUtc: decision.nextFireAtUtc,
      scheduleType: reminder.scheduleType
    });
    return createReminderDueAction(reminder, decision.scheduledForUtc, now);
  }

  private async reconcileSnoozedRecurring(
    reminder: Reminder,
    now: Instant,
    currentTimeZone: string
  ): Promise<SchedulerAction | null> {
    const latestOccurrence = await this.repository.getLatestOccurrence(reminder.id);
    const scheduledForUtc = reminder.snoozedUntilUtc ?? reminder.nextFireAtUtc;
    const idempotencyKey = reminderIdempotencyKey(reminder, scheduledForUtc);
    const existing = await this.repository.getOccurrenceByIdempotencyKey(idempotencyKey);

    if (existing && existing.status !== "failed") {
      return null;
    }

    const nextFireAtUtc = getNextRecurringFireAt(reminder, {
      nowUtc: now,
      currentTimeZone,
      latestOccurrence
    });

    if (!nextFireAtUtc) {
      return null;
    }

    const fired =
      reminder.scheduleType === "interval"
        ? recordIntervalReminderFire(reminder, now, {
            scheduledForUtc,
            nextFireAtUtc,
            timezoneSnapshot: currentTimeZone
          })
        : markRecurringReminderDue(reminder, now, {
            scheduledForUtc,
            nextFireAtUtc,
            localDateKey: latestOccurrence?.localDateKey,
            timezoneSnapshot: currentTimeZone
          });

    if (!fired.ok) {
      return null;
    }

    await this.repository.saveReminder(fired.value);
    await this.saveFiredOccurrence(
      reminder,
      scheduledForUtc,
      now,
      idempotencyKey,
      latestOccurrence?.localDateKey
    );
    await this.appendFiredHistory(reminder, scheduledForUtc, now, {
      previousStatus: reminder.status,
      snoozedUntilUtc: reminder.snoozedUntilUtc,
      nextFireAtUtc,
      scheduleType: reminder.scheduleType
    });
    return createReminderDueAction(reminder, scheduledForUtc, now);
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

  private async skipRecurring(
    reminder: Reminder,
    decision: Extract<RecurrencePlannerDecision, { kind: "skip" }>,
    now: Instant,
    idempotencyKey: string,
    currentTimeZone: string
  ): Promise<void> {
    await this.rescheduleRecurring(reminder, now, decision.nextFireAtUtc, currentTimeZone);
    await this.repository.saveOccurrence({
      id: reminderOccurrenceId(reminder, decision.scheduledForUtc),
      reminderId: reminder.id,
      scheduledForUtc: decision.scheduledForUtc,
      status: "skipped",
      localDateKey: decision.localDateKey,
      idempotencyKey
    });
    await this.repository.appendHistoryEvent({
      id: `${reminder.id}:reminder_skipped:${decision.scheduledForUtc}`,
      reminderId: reminder.id,
      eventType: "reminder_skipped",
      eventPayload: {
        scheduledForUtc: decision.scheduledForUtc,
        detectedAtUtc: now,
        reason: decision.reason,
        localDateKey: decision.localDateKey,
        nextFireAtUtc: decision.nextFireAtUtc,
        scheduleType: reminder.scheduleType
      },
      occurredAtUtc: now
    });
  }

  private async saveRescheduleIfChanged(
    reminder: Reminder,
    now: Instant,
    decision: Extract<RecurrencePlannerDecision, { kind: "none" }>
  ): Promise<void> {
    const shouldResumeDueInterval =
      reminder.scheduleType === "interval" && reminder.status === "due";

    if (
      !shouldResumeDueInterval &&
      reminder.nextFireAtUtc === decision.nextFireAtUtc &&
      reminder.timezoneSnapshot === decision.timezoneSnapshot
    ) {
      return;
    }

    await this.rescheduleRecurring(
      reminder,
      now,
      decision.nextFireAtUtc,
      decision.timezoneSnapshot
    );
  }

  private async rescheduleRecurring(
    reminder: Reminder,
    now: Instant,
    nextFireAtUtc: Instant,
    currentTimeZone?: string
  ): Promise<void> {
    const rescheduled =
      reminder.scheduleType === "interval" && reminder.status === "due"
        ? resumeIntervalReminder(reminder, now, nextFireAtUtc, currentTimeZone)
        : rescheduleReminder(reminder, now, nextFireAtUtc, currentTimeZone);

    if (rescheduled.ok) {
      await this.repository.saveReminder(rescheduled.value);
    }
  }

  private async saveFiredOccurrence(
    reminder: Reminder,
    scheduledForUtc: Instant,
    now: Instant,
    idempotencyKey: string,
    localDateKey?: string
  ): Promise<void> {
    await this.repository.saveOccurrence(
      createFiredOccurrence({
        id: reminderOccurrenceId(reminder, scheduledForUtc),
        reminderId: reminder.id,
        scheduledForUtc,
        firedAtUtc: now,
        idempotencyKey,
        localDateKey
      })
    );
  }

  private async appendFiredHistory(
    reminder: Reminder,
    scheduledForUtc: Instant,
    now: Instant,
    extraPayload: Record<string, unknown> = {}
  ): Promise<void> {
    await this.repository.appendHistoryEvent({
      id: `${reminder.id}:reminder_fired:${scheduledForUtc}`,
      reminderId: reminder.id,
      eventType: "reminder_fired",
      eventPayload: {
        scheduledForUtc,
        detectedAtUtc: now,
        previousStatus: reminder.status,
        ...extraPayload
      },
      occurredAtUtc: now
    });
  }

  private currentTimeZone(): string {
    return (
      this.options.resolveCurrentTimeZone?.() ??
      Intl.DateTimeFormat().resolvedOptions().timeZone ??
      "UTC"
    );
  }
}

function isSchedulerActiveReminder(reminder: Reminder): boolean {
  return (
    reminder.isEnabled &&
    (reminder.status === "enabled" ||
      reminder.status === "snoozed" ||
      (reminder.scheduleType === "interval" && reminder.status === "due"))
  );
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
