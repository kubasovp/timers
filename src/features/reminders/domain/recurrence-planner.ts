import { addSeconds, parseInstant, toInstant, type Instant } from "@/shared/time/instant";
import type { Reminder, ReminderOccurrence } from "./reminder-types";

export const DEFAULT_DAILY_GRACE_WINDOW_SECONDS = 60 * 60;
export const DEFAULT_INTERVAL_GRACE_WINDOW_SECONDS = 60 * 60;

export interface RecurrencePlannerInput {
  nowUtc: Instant;
  currentTimeZone: string;
  latestOccurrence?: Pick<ReminderOccurrence, "scheduledForUtc" | "status" | "localDateKey"> | null;
  dailyGraceWindowSeconds?: number;
  intervalGraceWindowSeconds?: number;
}

export type RecurrencePlannerDecision =
  | {
      kind: "none";
      nextFireAtUtc: Instant;
      timezoneSnapshot?: string;
      reason: "future" | "deduplicated" | "already_processed";
    }
  | {
      kind: "fire";
      scheduledForUtc: Instant;
      nextFireAtUtc: Instant;
      timezoneSnapshot?: string;
      localDateKey?: string;
    }
  | {
      kind: "skip";
      scheduledForUtc: Instant;
      nextFireAtUtc: Instant;
      timezoneSnapshot?: string;
      localDateKey?: string;
      reason: "daily_grace_window_exceeded" | "interval_grace_window_exceeded";
    }
  | {
      kind: "invalid";
      reason: string;
    };

interface LocalTime {
  hour: number;
  minute: number;
}

interface LocalDateParts {
  year: number;
  month: number;
  day: number;
}

interface LocalDateTimeParts extends LocalDateParts {
  hour: number;
  minute: number;
  second: number;
}

const MINUTE_MS = 60 * 1000;
const SEARCH_WINDOW_MINUTES = 36 * 60;
const formatterCache = new Map<string, Intl.DateTimeFormat>();

export function planReminderRecurrence(
  reminder: Reminder,
  input: RecurrencePlannerInput
): RecurrencePlannerDecision {
  if (reminder.scheduleType === "daily") {
    return planDailyReminder(reminder, input);
  }

  if (reminder.scheduleType === "interval") {
    return planIntervalReminder(reminder, input);
  }

  return {
    kind: "invalid",
    reason: "one_time_reminders_do_not_use_recurrence_planner"
  };
}

export function getNextRecurringFireAt(
  reminder: Reminder,
  input: RecurrencePlannerInput
): Instant | null {
  if (reminder.scheduleType === "daily") {
    if (!reminder.dailyTimeLocal) {
      return null;
    }

    const afterLocalDate = input.latestOccurrence?.localDateKey ?? reminder.lastFiredLocalDate;
    return getNextFutureDailyFireAt(
      reminder.dailyTimeLocal,
      input.nowUtc,
      input.currentTimeZone,
      afterLocalDate
    );
  }

  if (reminder.scheduleType === "interval") {
    if (!reminder.intervalAnchorAtUtc || !reminder.intervalSeconds) {
      return null;
    }

    return getNextFutureIntervalFireAt({
      intervalAnchorAtUtc: reminder.intervalAnchorAtUtc,
      intervalSeconds: reminder.intervalSeconds,
      nowUtc: input.nowUtc,
      afterScheduledForUtc: input.latestOccurrence?.scheduledForUtc
    });
  }

  return null;
}

export function getNextFutureDailyFireAt(
  dailyTimeLocal: string,
  nowUtc: Instant,
  timeZone: string,
  afterLocalDate?: string
): Instant | null {
  const time = parseDailyTimeLocal(dailyTimeLocal);

  if (!time) {
    return null;
  }

  const nowMs = parseInstant(nowUtc);
  const localNow = zonedPartsFromInstant(nowUtc, timeZone);
  let candidateDate = localDateKey(localNow);

  if (afterLocalDate && candidateDate <= afterLocalDate) {
    candidateDate = addLocalDays(afterLocalDate, 1);
  }

  let candidate = resolveLocalDateTime(candidateDate, time, timeZone);

  while (parseInstant(candidate) <= nowMs) {
    candidateDate = addLocalDays(candidateDate, 1);
    candidate = resolveLocalDateTime(candidateDate, time, timeZone);
  }

  return candidate;
}

export function getNextFutureIntervalFireAt(input: {
  intervalAnchorAtUtc: Instant;
  intervalSeconds: number;
  nowUtc: Instant;
  afterScheduledForUtc?: Instant;
}): Instant | null {
  if (!isValidIntervalSeconds(input.intervalSeconds)) {
    return null;
  }

  const anchorMs = parseInstant(input.intervalAnchorAtUtc);
  const intervalMs = input.intervalSeconds * 1000;
  const nowMs = parseInstant(input.nowUtc);
  const afterMs = input.afterScheduledForUtc
    ? parseInstant(input.afterScheduledForUtc)
    : anchorMs;
  const lowerBound = Math.max(nowMs, afterMs, anchorMs);
  const intervalsAfterAnchor = Math.floor((lowerBound - anchorMs) / intervalMs) + 1;
  const intervalIndex = Math.max(1, intervalsAfterAnchor);

  return toInstant(new Date(anchorMs + intervalIndex * intervalMs));
}

export function parseDailyTimeLocal(value: string | undefined): LocalTime | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value ?? "");

  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    return null;
  }

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  return { hour, minute };
}

export function isValidIntervalSeconds(value: number | undefined): value is number {
  return Number.isInteger(value) && value !== undefined && value > 0;
}

export function localDateForInstant(instant: Instant, timeZone: string): string {
  return localDateKey(zonedPartsFromInstant(instant, timeZone));
}

function planDailyReminder(
  reminder: Reminder,
  input: RecurrencePlannerInput
): RecurrencePlannerDecision {
  if (!reminder.dailyTimeLocal) {
    return { kind: "invalid", reason: "daily_time_local_missing" };
  }

  const time = parseDailyTimeLocal(reminder.dailyTimeLocal);

  if (!time) {
    return { kind: "invalid", reason: "daily_time_local_invalid" };
  }

  const nowMs = parseInstant(input.nowUtc);
  const localNow = zonedPartsFromInstant(input.nowUtc, input.currentTimeZone);
  const today = localDateKey(localNow);
  const candidate = resolveLocalDateTime(today, time, input.currentTimeZone);
  const candidateMs = parseInstant(candidate);
  const latestOccurrenceAlreadyProcessedToday =
    input.latestOccurrence?.localDateKey === today &&
    input.latestOccurrence.status !== "failed";
  const nextFireAtUtc = getNextFutureDailyFireAt(
    reminder.dailyTimeLocal,
    input.nowUtc,
    input.currentTimeZone,
    today
  );

  if (!nextFireAtUtc) {
    return { kind: "invalid", reason: "daily_next_fire_unresolved" };
  }

  if (reminder.lastFiredLocalDate === today || latestOccurrenceAlreadyProcessedToday) {
    return {
      kind: "none",
      nextFireAtUtc,
      timezoneSnapshot: input.currentTimeZone,
      reason: latestOccurrenceAlreadyProcessedToday ? "already_processed" : "deduplicated"
    };
  }

  if (candidateMs > nowMs) {
    return {
      kind: "none",
      nextFireAtUtc: candidate,
      timezoneSnapshot: input.currentTimeZone,
      reason: "future"
    };
  }

  const graceWindowSeconds =
    input.dailyGraceWindowSeconds ?? DEFAULT_DAILY_GRACE_WINDOW_SECONDS;
  const isInsideGrace = nowMs - candidateMs <= graceWindowSeconds * 1000;

  if (isInsideGrace) {
    return {
      kind: "fire",
      scheduledForUtc: candidate,
      nextFireAtUtc,
      timezoneSnapshot: input.currentTimeZone,
      localDateKey: today
    };
  }

  return {
    kind: "skip",
    scheduledForUtc: candidate,
    nextFireAtUtc,
    timezoneSnapshot: input.currentTimeZone,
    localDateKey: today,
    reason: "daily_grace_window_exceeded"
  };
}

function planIntervalReminder(
  reminder: Reminder,
  input: RecurrencePlannerInput
): RecurrencePlannerDecision {
  if (!reminder.intervalAnchorAtUtc) {
    return { kind: "invalid", reason: "interval_anchor_at_utc_missing" };
  }

  if (!isValidIntervalSeconds(reminder.intervalSeconds)) {
    return { kind: "invalid", reason: "interval_seconds_invalid" };
  }

  const anchorMs = parseInstant(reminder.intervalAnchorAtUtc);
  const intervalMs = reminder.intervalSeconds * 1000;
  const nowMs = parseInstant(input.nowUtc);
  const firstFireAtUtc = addSeconds(reminder.intervalAnchorAtUtc, reminder.intervalSeconds);

  if (nowMs < parseInstant(firstFireAtUtc)) {
    return {
      kind: "none",
      nextFireAtUtc: firstFireAtUtc,
      reason: "future"
    };
  }

  const elapsedIntervals = Math.floor((nowMs - anchorMs) / intervalMs);
  const latestDueMs = anchorMs + elapsedIntervals * intervalMs;
  const latestDue = toInstant(new Date(latestDueMs));
  const nextFireAtUtc = toInstant(new Date(latestDueMs + intervalMs));

  if (
    input.latestOccurrence &&
    input.latestOccurrence.status !== "failed" &&
    parseInstant(input.latestOccurrence.scheduledForUtc) >= latestDueMs
  ) {
    return {
      kind: "none",
      nextFireAtUtc,
      reason: "already_processed"
    };
  }

  const graceWindowSeconds =
    input.intervalGraceWindowSeconds ?? DEFAULT_INTERVAL_GRACE_WINDOW_SECONDS;
  const isInsideGrace = nowMs - latestDueMs <= graceWindowSeconds * 1000;

  if (isInsideGrace) {
    return {
      kind: "fire",
      scheduledForUtc: latestDue,
      nextFireAtUtc
    };
  }

  return {
    kind: "skip",
    scheduledForUtc: latestDue,
    nextFireAtUtc,
    reason: "interval_grace_window_exceeded"
  };
}

function resolveLocalDateTime(dateKey: string, time: LocalTime, timeZone: string): Instant {
  const date = parseLocalDateKey(dateKey);
  const target: LocalDateTimeParts = {
    ...date,
    hour: time.hour,
    minute: time.minute,
    second: 0
  };
  const targetAsUtcMs = Date.UTC(
    target.year,
    target.month - 1,
    target.day,
    target.hour,
    target.minute,
    target.second,
    0
  );
  const windowStart = targetAsUtcMs - SEARCH_WINDOW_MINUTES * MINUTE_MS;
  const windowEnd = targetAsUtcMs + SEARCH_WINDOW_MINUTES * MINUTE_MS;
  const exactMatches: number[] = [];
  let firstAfterTarget: number | undefined;

  for (let utcMs = windowStart; utcMs <= windowEnd; utcMs += MINUTE_MS) {
    const local = zonedPartsFromDate(new Date(utcMs), timeZone);
    const comparison = compareLocalDateTime(local, target);

    if (comparison === 0) {
      exactMatches.push(utcMs);
    } else if (comparison > 0 && firstAfterTarget === undefined) {
      firstAfterTarget = utcMs;
    }
  }

  if (exactMatches.length > 0) {
    return toInstant(new Date(exactMatches[0]));
  }

  if (firstAfterTarget !== undefined) {
    return toInstant(new Date(firstAfterTarget));
  }

  return toInstant(new Date(targetAsUtcMs));
}

function zonedPartsFromInstant(instant: Instant, timeZone: string): LocalDateTimeParts {
  return zonedPartsFromDate(new Date(parseInstant(instant)), timeZone);
}

function zonedPartsFromDate(date: Date, timeZone: string): LocalDateTimeParts {
  const parts = getFormatter(timeZone).formatToParts(date);
  const values = new Map<string, string>();

  for (const part of parts) {
    if (part.type !== "literal") {
      values.set(part.type, part.value);
    }
  }

  return {
    year: Number(values.get("year")),
    month: Number(values.get("month")),
    day: Number(values.get("day")),
    hour: Number(values.get("hour")),
    minute: Number(values.get("minute")),
    second: Number(values.get("second"))
  };
}

function getFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = formatterCache.get(timeZone);

  if (cached) {
    return cached;
  }

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    calendar: "iso8601",
    numberingSystem: "latn",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  });
  formatterCache.set(timeZone, formatter);
  return formatter;
}

function compareLocalDateTime(a: LocalDateTimeParts, b: LocalDateTimeParts): number {
  return (
    a.year - b.year ||
    a.month - b.month ||
    a.day - b.day ||
    a.hour - b.hour ||
    a.minute - b.minute ||
    a.second - b.second
  );
}

function localDateKey(parts: LocalDateParts): string {
  return [
    parts.year.toString().padStart(4, "0"),
    parts.month.toString().padStart(2, "0"),
    parts.day.toString().padStart(2, "0")
  ].join("-");
}

function parseLocalDateKey(dateKey: string): LocalDateParts {
  const [year, month, day] = dateKey.split("-").map(Number);
  return { year, month, day };
}

function addLocalDays(dateKey: string, days: number): string {
  const date = parseLocalDateKey(dateKey);
  const utcDate = new Date(Date.UTC(date.year, date.month - 1, date.day + days, 12, 0, 0, 0));
  return [
    utcDate.getUTCFullYear().toString().padStart(4, "0"),
    (utcDate.getUTCMonth() + 1).toString().padStart(2, "0"),
    utcDate.getUTCDate().toString().padStart(2, "0")
  ].join("-");
}
