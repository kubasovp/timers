import { appError } from "@/kernel/errors/app-error";
import { DefaultIdGenerator, type IdGenerator } from "@/shared/id/create-id";
import { err, ok, type Result } from "@/shared/result/result";
import type { Clock } from "@/shared/time/clock";
import { secondsUntil, type Instant } from "@/shared/time/instant";
import {
  acknowledgeReminder,
  createOneTimeReminder,
  deleteReminder,
  disableReminder,
  enableReminder,
  snoozeReminder
} from "../domain/reminder-state-machine";
import type {
  Reminder,
  ReminderHistoryEvent,
  ReminderOccurrence
} from "../domain/reminder-types";
import type { ReminderRepository } from "../ports";

export const REMINDER_COMMANDS = {
  CREATE_ONE_TIME: "reminders.createOneTime",
  ENABLE: "reminders.enable",
  DISABLE: "reminders.disable",
  DELETE: "reminders.delete",
  DONE: "reminders.done",
  SNOOZE: "reminders.snooze"
} as const;

export const REMINDER_QUERIES = {
  LIST: "reminders.list"
} as const;

export interface CreateOneTimeReminderPayload {
  title: string;
  message?: string;
  fireAtUtc: Instant;
}

export interface ReminderIdPayload {
  id: string;
}

export interface SnoozeReminderPayload extends ReminderIdPayload {
  snoozeSeconds?: number;
}

export interface ReminderView {
  id: string;
  title: string;
  message?: string;
  status: Reminder["status"];
  scheduleType: Reminder["scheduleType"];
  fireAtUtc: string;
  nextFireAtUtc: string;
  snoozedUntilUtc?: string;
  secondsUntilNext: number;
  isEnabled: boolean;
}

export interface ReminderUseCases {
  createOneTime(payload: CreateOneTimeReminderPayload): Promise<Result<ReminderView>>;
  enable(payload: ReminderIdPayload): Promise<Result<ReminderView>>;
  disable(payload: ReminderIdPayload): Promise<Result<ReminderView>>;
  delete(payload: ReminderIdPayload): Promise<Result<ReminderView>>;
  done(payload: ReminderIdPayload): Promise<Result<ReminderView>>;
  snooze(payload: SnoozeReminderPayload): Promise<Result<ReminderView>>;
  list(): Promise<Result<ReminderView[]>>;
}

const DEFAULT_SNOOZE_SECONDS = 5 * 60;

export function createReminderUseCases(dependencies: {
  repository: ReminderRepository;
  clock: Clock;
  idGenerator?: IdGenerator;
}): ReminderUseCases {
  const ids = dependencies.idGenerator ?? new DefaultIdGenerator();

  return {
    async createOneTime(payload) {
      const now = dependencies.clock.now();
      const reminder = createOneTimeReminder({
        id: ids.nextId(),
        now,
        title: payload.title,
        message: payload.message,
        fireAtUtc: payload.fireAtUtc,
        timezoneSnapshot: getTimezoneSnapshot()
      });

      if (!reminder.ok) {
        return reminder;
      }

      await dependencies.repository.saveReminder(reminder.value);
      await dependencies.repository.appendHistoryEvent(
        historyEvent(ids, reminder.value, "reminder_created", now, {
          scheduleType: reminder.value.scheduleType,
          fireAtUtc: reminder.value.oneTimeFireAtUtc
        })
      );

      return ok(toReminderView(reminder.value, now));
    },

    async enable(payload) {
      return mutateReminder(dependencies, ids, payload.id, "reminder_enabled", enableReminder);
    },

    async disable(payload) {
      return mutateReminder(dependencies, ids, payload.id, "reminder_disabled", disableReminder);
    },

    async delete(payload) {
      return mutateReminder(dependencies, ids, payload.id, "reminder_deleted", deleteReminder);
    },

    async done(payload) {
      const now = dependencies.clock.now();
      const reminder = await dependencies.repository.getReminder(payload.id);

      if (!reminder) {
        return reminderNotFound(payload.id);
      }

      const acknowledged = acknowledgeReminder(reminder, now);

      if (!acknowledged.ok) {
        return acknowledged;
      }

      const occurrence = await dependencies.repository.getLatestOccurrence(payload.id);

      if (occurrence) {
        await dependencies.repository.saveOccurrence({
          ...occurrence,
          status: "done",
          acknowledgedAtUtc: now
        });
      }

      await dependencies.repository.saveReminder(acknowledged.value);
      await dependencies.repository.appendHistoryEvent(
        historyEvent(ids, acknowledged.value, "reminder_done", now, {
          previousStatus: reminder.status
        })
      );

      return ok(toReminderView(acknowledged.value, now));
    },

    async snooze(payload) {
      const now = dependencies.clock.now();
      const reminder = await dependencies.repository.getReminder(payload.id);

      if (!reminder) {
        return reminderNotFound(payload.id);
      }

      const snoozed = snoozeReminder(
        reminder,
        now,
        Math.floor(payload.snoozeSeconds ?? DEFAULT_SNOOZE_SECONDS)
      );

      if (!snoozed.ok) {
        return snoozed;
      }

      const occurrence = await dependencies.repository.getLatestOccurrence(payload.id);

      if (occurrence) {
        await dependencies.repository.saveOccurrence({
          ...occurrence,
          status: "snoozed",
          snoozedUntilUtc: snoozed.value.snoozedUntilUtc
        });
      }

      await dependencies.repository.saveReminder(snoozed.value);
      await dependencies.repository.appendHistoryEvent(
        historyEvent(ids, snoozed.value, "reminder_snoozed", now, {
          previousStatus: reminder.status,
          snoozedUntilUtc: snoozed.value.snoozedUntilUtc
        })
      );

      return ok(toReminderView(snoozed.value, now));
    },

    async list() {
      const now = dependencies.clock.now();
      const reminders = await dependencies.repository.listReminders();
      return ok(reminders.map((reminder) => toReminderView(reminder, now)));
    }
  };
}

export function toReminderView(reminder: Reminder, now: Instant): ReminderView {
  return {
    id: reminder.id,
    title: reminder.title,
    message: reminder.message,
    status: reminder.status,
    scheduleType: reminder.scheduleType,
    fireAtUtc: reminder.oneTimeFireAtUtc ?? reminder.nextFireAtUtc,
    nextFireAtUtc: reminder.nextFireAtUtc,
    snoozedUntilUtc: reminder.snoozedUntilUtc,
    secondsUntilNext:
      reminder.status === "enabled" || reminder.status === "snoozed"
        ? secondsUntil(reminder.nextFireAtUtc, now)
        : 0,
    isEnabled: reminder.isEnabled
  };
}

async function mutateReminder(
  dependencies: { repository: ReminderRepository; clock: Clock },
  ids: IdGenerator,
  id: string,
  eventType: string,
  transition: (reminder: Reminder, now: Instant) => Result<Reminder>
): Promise<Result<ReminderView>> {
  const now = dependencies.clock.now();
  const reminder = await dependencies.repository.getReminder(id);

  if (!reminder) {
    return reminderNotFound(id);
  }

  const updated = transition(reminder, now);

  if (!updated.ok) {
    return updated;
  }

  await dependencies.repository.saveReminder(updated.value);
  await dependencies.repository.appendHistoryEvent(
    historyEvent(ids, updated.value, eventType, now, {
      previousStatus: reminder.status,
      status: updated.value.status
    })
  );

  return ok(toReminderView(updated.value, now));
}

function reminderNotFound(id: string): Result<never> {
  return err(
    appError({
      code: "reminders.not_found",
      message: "Reminder was not found.",
      category: "not_found",
      details: { id }
    })
  );
}

function historyEvent(
  ids: IdGenerator,
  reminder: Reminder,
  eventType: string,
  now: Instant,
  eventPayload: Record<string, unknown>
): ReminderHistoryEvent {
  return {
    id: ids.nextId(),
    reminderId: reminder.id,
    eventType,
    eventPayload,
    occurredAtUtc: now
  };
}

function getTimezoneSnapshot(): string | undefined {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function createFiredOccurrence(input: {
  id: string;
  reminderId: string;
  scheduledForUtc: Instant;
  firedAtUtc: Instant;
  idempotencyKey: string;
}): ReminderOccurrence {
  return {
    id: input.id,
    reminderId: input.reminderId,
    scheduledForUtc: input.scheduledForUtc,
    status: "fired",
    firedAtUtc: input.firedAtUtc,
    idempotencyKey: input.idempotencyKey
  };
}
