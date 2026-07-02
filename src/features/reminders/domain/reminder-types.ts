import type { Instant } from "@/shared/time/instant";

export type ReminderStatus =
  | "enabled"
  | "due"
  | "snoozed"
  | "done"
  | "disabled"
  | "deleted";

export type ReminderScheduleType = "one_time" | "daily" | "interval";

export type ReminderTimeSemantics = "fixed_utc" | "local_floating";

export interface Reminder {
  id: string;
  title: string;
  message?: string;
  status: ReminderStatus;
  scheduleType: ReminderScheduleType;
  timeSemantics: ReminderTimeSemantics;
  oneTimeFireAtUtc?: Instant;
  dailyTimeLocal?: string;
  intervalSeconds?: number;
  intervalAnchorAtUtc?: Instant;
  nextFireAtUtc: Instant;
  timezoneSnapshot?: string;
  lastFiredAtUtc?: Instant;
  lastFiredLocalDate?: string;
  snoozedUntilUtc?: Instant;
  isEnabled: boolean;
  createdAtUtc: Instant;
  updatedAtUtc: Instant;
  deletedAtUtc?: Instant;
  version: number;
}

export type ReminderOccurrenceStatus =
  | "due"
  | "fired"
  | "snoozed"
  | "done"
  | "missed"
  | "skipped"
  | "failed";

export interface ReminderOccurrence {
  id: string;
  reminderId: string;
  scheduledForUtc: Instant;
  status: ReminderOccurrenceStatus;
  firedAtUtc?: Instant;
  acknowledgedAtUtc?: Instant;
  snoozedUntilUtc?: Instant;
  localDateKey?: string;
  idempotencyKey: string;
}

export interface ReminderHistoryEvent {
  id: string;
  reminderId: string;
  eventType: string;
  eventPayload: Record<string, unknown>;
  occurredAtUtc: Instant;
}
