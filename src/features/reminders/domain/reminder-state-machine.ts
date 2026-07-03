import { appError } from "@/kernel/errors/app-error";
import { err, ok, type Result } from "@/shared/result/result";
import { addSeconds, type Instant } from "@/shared/time/instant";
import {
  isValidIntervalSeconds,
  parseDailyTimeLocal
} from "./recurrence-planner";
import type { Reminder, ReminderStatus } from "./reminder-types";

export interface CreateOneTimeReminderInput {
  id: string;
  now: Instant;
  title: string;
  message?: string;
  fireAtUtc: Instant;
  timezoneSnapshot?: string;
}

export interface CreateDailyReminderInput {
  id: string;
  now: Instant;
  title: string;
  message?: string;
  dailyTimeLocal: string;
  nextFireAtUtc: Instant;
  timezoneSnapshot?: string;
}

export interface CreateIntervalReminderInput {
  id: string;
  now: Instant;
  title: string;
  message?: string;
  intervalSeconds: number;
  intervalAnchorAtUtc: Instant;
  nextFireAtUtc: Instant;
}

export interface MarkRecurringReminderDueInput {
  scheduledForUtc: Instant;
  nextFireAtUtc: Instant;
  localDateKey?: string;
  timezoneSnapshot?: string;
}

export function createOneTimeReminder(input: CreateOneTimeReminderInput): Result<Reminder> {
  const title = normalizeText(input.title);

  if (!title) {
    return err(
      appError({
        code: "reminders.invalid_title",
        message: "Reminder title is required.",
        category: "validation"
      })
    );
  }

  const invalidFireAt = validateInstant(input.fireAtUtc, "reminders.invalid_fire_time");

  if (!invalidFireAt.ok) {
    return invalidFireAt;
  }

  return ok({
    id: input.id,
    title,
    message: normalizeText(input.message),
    status: "enabled",
    scheduleType: "one_time",
    timeSemantics: "fixed_utc",
    oneTimeFireAtUtc: input.fireAtUtc,
    nextFireAtUtc: input.fireAtUtc,
    timezoneSnapshot: input.timezoneSnapshot,
    isEnabled: true,
    createdAtUtc: input.now,
    updatedAtUtc: input.now,
    version: 1
  });
}

export function createDailyReminder(input: CreateDailyReminderInput): Result<Reminder> {
  const title = normalizeText(input.title);

  if (!title) {
    return invalidTitle();
  }

  if (!parseDailyTimeLocal(input.dailyTimeLocal)) {
    return err(
      appError({
        code: "reminders.invalid_daily_time",
        message: "Daily reminder time must use HH:mm format.",
        category: "validation",
        details: { value: input.dailyTimeLocal }
      })
    );
  }

  const invalidNextFireAt = validateInstant(
    input.nextFireAtUtc,
    "reminders.invalid_fire_time"
  );

  if (!invalidNextFireAt.ok) {
    return invalidNextFireAt;
  }

  return ok({
    id: input.id,
    title,
    message: normalizeText(input.message),
    status: "enabled",
    scheduleType: "daily",
    timeSemantics: "local_floating",
    dailyTimeLocal: input.dailyTimeLocal,
    nextFireAtUtc: input.nextFireAtUtc,
    timezoneSnapshot: input.timezoneSnapshot,
    isEnabled: true,
    createdAtUtc: input.now,
    updatedAtUtc: input.now,
    version: 1
  });
}

export function createIntervalReminder(input: CreateIntervalReminderInput): Result<Reminder> {
  const title = normalizeText(input.title);

  if (!title) {
    return invalidTitle();
  }

  if (!isValidIntervalSeconds(input.intervalSeconds)) {
    return err(
      appError({
        code: "reminders.invalid_interval",
        message: "Interval duration must be greater than zero.",
        category: "validation",
        details: { value: input.intervalSeconds }
      })
    );
  }

  const invalidAnchor = validateInstant(
    input.intervalAnchorAtUtc,
    "reminders.invalid_interval_anchor"
  );

  if (!invalidAnchor.ok) {
    return invalidAnchor;
  }

  const invalidNextFireAt = validateInstant(
    input.nextFireAtUtc,
    "reminders.invalid_fire_time"
  );

  if (!invalidNextFireAt.ok) {
    return invalidNextFireAt;
  }

  return ok({
    id: input.id,
    title,
    message: normalizeText(input.message),
    status: "enabled",
    scheduleType: "interval",
    timeSemantics: "fixed_utc",
    intervalSeconds: input.intervalSeconds,
    intervalAnchorAtUtc: input.intervalAnchorAtUtc,
    nextFireAtUtc: input.nextFireAtUtc,
    isEnabled: true,
    createdAtUtc: input.now,
    updatedAtUtc: input.now,
    version: 1
  });
}

export function markReminderDue(
  reminder: Reminder,
  now: Instant,
  scheduledForUtc = reminder.nextFireAtUtc
): Result<Reminder> {
  const transition = ensureStatus(reminder, ["enabled", "snoozed"], "due_at_reached");

  if (!transition.ok) {
    return transition;
  }

  return ok({
    ...reminder,
    status: "due",
    nextFireAtUtc: scheduledForUtc,
    lastFiredAtUtc: now,
    snoozedUntilUtc: undefined,
    updatedAtUtc: now,
    version: reminder.version + 1
  });
}

export function markRecurringReminderDue(
  reminder: Reminder,
  now: Instant,
  input: MarkRecurringReminderDueInput
): Result<Reminder> {
  const transition = ensureStatus(reminder, ["enabled", "snoozed"], "due_at_reached");

  if (!transition.ok) {
    return transition;
  }

  if (reminder.scheduleType === "one_time") {
    return err(
      appError({
        code: "reminders.invalid_transition",
        message: "One-time reminders must use the one-time due transition.",
        category: "domain"
      })
    );
  }

  return ok({
    ...reminder,
    status: "due",
    nextFireAtUtc: input.nextFireAtUtc,
    timezoneSnapshot: input.timezoneSnapshot ?? reminder.timezoneSnapshot,
    lastFiredAtUtc: now,
    lastFiredLocalDate: input.localDateKey ?? reminder.lastFiredLocalDate,
    snoozedUntilUtc: undefined,
    updatedAtUtc: now,
    version: reminder.version + 1
  });
}

export function rescheduleReminder(
  reminder: Reminder,
  now: Instant,
  nextFireAtUtc: Instant,
  timezoneSnapshot?: string
): Result<Reminder> {
  const transition = ensureStatus(reminder, ["enabled"], "reschedule");

  if (!transition.ok) {
    return transition;
  }

  return ok({
    ...reminder,
    nextFireAtUtc,
    timezoneSnapshot: timezoneSnapshot ?? reminder.timezoneSnapshot,
    updatedAtUtc: now,
    version: reminder.version + 1
  });
}

export function snoozeReminder(
  reminder: Reminder,
  now: Instant,
  snoozeSeconds: number
): Result<Reminder> {
  const transition = ensureStatus(reminder, ["due"], "snooze");

  if (!transition.ok) {
    return transition;
  }

  if (!Number.isInteger(snoozeSeconds) || snoozeSeconds <= 0) {
    return err(
      appError({
        code: "reminders.invalid_snooze",
        message: "Snooze duration must be greater than zero.",
        category: "validation"
      })
    );
  }

  const snoozedUntilUtc = addSeconds(now, snoozeSeconds);

  return ok({
    ...reminder,
    status: "snoozed",
    nextFireAtUtc: snoozedUntilUtc,
    snoozedUntilUtc,
    isEnabled: true,
    updatedAtUtc: now,
    version: reminder.version + 1
  });
}

export function acknowledgeReminder(reminder: Reminder, now: Instant): Result<Reminder> {
  const transition = ensureStatus(reminder, ["due"], "done");

  if (!transition.ok) {
    return transition;
  }

  return ok({
    ...reminder,
    status: "done",
    isEnabled: false,
    updatedAtUtc: now,
    version: reminder.version + 1
  });
}

export function acknowledgeRecurringReminder(
  reminder: Reminder,
  now: Instant,
  nextFireAtUtc: Instant,
  timezoneSnapshot?: string
): Result<Reminder> {
  const transition = ensureStatus(reminder, ["due"], "done");

  if (!transition.ok) {
    return transition;
  }

  if (reminder.scheduleType === "one_time") {
    return err(
      appError({
        code: "reminders.invalid_transition",
        message: "One-time reminders must use terminal acknowledgement.",
        category: "domain"
      })
    );
  }

  return ok({
    ...reminder,
    status: "enabled",
    isEnabled: true,
    nextFireAtUtc,
    timezoneSnapshot: timezoneSnapshot ?? reminder.timezoneSnapshot,
    snoozedUntilUtc: undefined,
    updatedAtUtc: now,
    version: reminder.version + 1
  });
}

export function disableReminder(reminder: Reminder, now: Instant): Result<Reminder> {
  const transition = ensureStatus(reminder, ["enabled", "snoozed"], "disable");

  if (!transition.ok) {
    return transition;
  }

  return ok({
    ...reminder,
    status: "disabled",
    isEnabled: false,
    updatedAtUtc: now,
    version: reminder.version + 1
  });
}

export function enableReminder(reminder: Reminder, now: Instant): Result<Reminder> {
  const transition = ensureStatus(reminder, ["disabled"], "enable");

  if (!transition.ok) {
    return transition;
  }

  return ok({
    ...reminder,
    status: "enabled",
    isEnabled: true,
    nextFireAtUtc: reminder.snoozedUntilUtc ?? reminder.nextFireAtUtc,
    updatedAtUtc: now,
    version: reminder.version + 1
  });
}

export function deleteReminder(reminder: Reminder, now: Instant): Result<Reminder> {
  const transition = ensureStatus(
    reminder,
    ["enabled", "due", "snoozed", "done", "disabled"],
    "delete"
  );

  if (!transition.ok) {
    return transition;
  }

  return ok({
    ...reminder,
    status: "deleted",
    isEnabled: false,
    deletedAtUtc: now,
    updatedAtUtc: now,
    version: reminder.version + 1
  });
}

export function skipMissedOneTimeReminder(reminder: Reminder, now: Instant): Result<Reminder> {
  const transition = ensureStatus(reminder, ["enabled", "snoozed"], "skip_missed");

  if (!transition.ok) {
    return transition;
  }

  return ok({
    ...reminder,
    status: "done",
    isEnabled: false,
    snoozedUntilUtc: undefined,
    updatedAtUtc: now,
    version: reminder.version + 1
  });
}

function invalidTitle(): Result<never> {
  return err(
    appError({
      code: "reminders.invalid_title",
      message: "Reminder title is required.",
      category: "validation"
    })
  );
}

function ensureStatus(
  reminder: Reminder,
  allowed: ReminderStatus[],
  command: string
): Result<Reminder> {
  if (allowed.includes(reminder.status)) {
    return ok(reminder);
  }

  return err(
    appError({
      code: "reminders.invalid_transition",
      message: `Cannot ${command} reminder from ${reminder.status}.`,
      category: "domain",
      details: {
        command,
        currentStatus: reminder.status,
        allowed
      }
    })
  );
}

function validateInstant(value: Instant, code: string): Result<void> {
  const parsed = Date.parse(value);

  if (!Number.isNaN(parsed)) {
    return ok(undefined);
  }

  return err(
    appError({
      code,
      message: "Reminder time must be a valid UTC instant.",
      category: "validation",
      details: { value }
    })
  );
}

function normalizeText(value: string | undefined): string | undefined {
  const normalized = value?.trim().replace(/\s+/g, " ");
  return normalized ? normalized : undefined;
}
