import { compareInstants, isDue, type Instant } from "@/shared/time/instant";
import type {
  Reminder,
  ReminderHistoryEvent,
  ReminderOccurrence
} from "../domain/reminder-types";
import type { ReminderRepository } from "../ports";
import { InMemoryReminderRepository } from "./in-memory-reminder-repository";

interface BrowserReminderState {
  reminders: Reminder[];
  occurrences: ReminderOccurrence[];
  history: ReminderHistoryEvent[];
}

export class BrowserReminderRepository implements ReminderRepository {
  private readonly fallback = new InMemoryReminderRepository();

  constructor(private readonly storageKey = "timers.reminders.v1") {
    const storage = getLocalStorage();

    if (storage && !storage.getItem(this.storageKey)) {
      writeState(storage, this.storageKey, {
        reminders: [],
        occurrences: [],
        history: []
      });
    }
  }

  async saveReminder(reminder: Reminder): Promise<void> {
    await this.withState(
      (state) => {
        state.reminders = state.reminders.filter((item) => item.id !== reminder.id);
        state.reminders.push(clone(reminder));
      },
      () => this.fallback.saveReminder(reminder)
    );
  }

  async getReminder(id: string): Promise<Reminder | null> {
    const storage = getLocalStorage();

    if (!storage) {
      return this.fallback.getReminder(id);
    }

    const reminder = readState(storage, this.storageKey).reminders.find((item) => item.id === id);
    return reminder ? clone(reminder) : null;
  }

  async listReminders(): Promise<Reminder[]> {
    const reminders = await this.listAllReminders();
    return reminders
      .filter((reminder) => reminder.status !== "deleted")
      .sort(compareReminderListItems);
  }

  async listDueReminders(now: Instant): Promise<Reminder[]> {
    const reminders = await this.listAllReminders();
    return reminders
      .filter(
        (reminder) =>
          reminder.isEnabled &&
          reminder.scheduleType === "one_time" &&
          (reminder.status === "enabled" || reminder.status === "snoozed") &&
          isDue(reminder.nextFireAtUtc, now)
      )
      .sort((a, b) => compareInstants(a.nextFireAtUtc, b.nextFireAtUtc));
  }

  async saveOccurrence(occurrence: ReminderOccurrence): Promise<void> {
    await this.withState(
      (state) => {
        state.occurrences = state.occurrences.filter((item) => item.id !== occurrence.id);
        state.occurrences.push(clone(occurrence));
      },
      () => this.fallback.saveOccurrence(occurrence)
    );
  }

  async getOccurrenceByIdempotencyKey(
    idempotencyKey: string
  ): Promise<ReminderOccurrence | null> {
    const storage = getLocalStorage();

    if (!storage) {
      return this.fallback.getOccurrenceByIdempotencyKey(idempotencyKey);
    }

    const occurrence = readState(storage, this.storageKey).occurrences.find(
      (item) => item.idempotencyKey === idempotencyKey
    );
    return occurrence ? clone(occurrence) : null;
  }

  async getLatestOccurrence(reminderId: string): Promise<ReminderOccurrence | null> {
    const occurrences = await this.listOccurrences(reminderId);
    return occurrences.sort((a, b) => compareInstants(b.scheduledForUtc, a.scheduledForUtc))[0] ?? null;
  }

  async listOccurrences(reminderId?: string): Promise<ReminderOccurrence[]> {
    const storage = getLocalStorage();

    if (!storage) {
      return this.fallback.listOccurrences(reminderId);
    }

    return readState(storage, this.storageKey).occurrences
      .filter((occurrence) => !reminderId || occurrence.reminderId === reminderId)
      .sort((a, b) => compareInstants(a.scheduledForUtc, b.scheduledForUtc))
      .map(clone);
  }

  async appendHistoryEvent(event: ReminderHistoryEvent): Promise<void> {
    await this.withState(
      (state) => {
        state.history.push(clone(event));
      },
      () => this.fallback.appendHistoryEvent(event)
    );
  }

  async listHistory(): Promise<ReminderHistoryEvent[]> {
    const storage = getLocalStorage();

    if (!storage) {
      return this.fallback.listHistory();
    }

    return readState(storage, this.storageKey).history.map(clone);
  }

  private async listAllReminders(): Promise<Reminder[]> {
    const storage = getLocalStorage();

    if (!storage) {
      return this.fallback.listReminders();
    }

    return readState(storage, this.storageKey).reminders.map(clone);
  }

  private async withState(
    update: (state: BrowserReminderState) => Promise<void> | void,
    fallback: () => Promise<void>
  ): Promise<void> {
    const storage = getLocalStorage();

    if (!storage) {
      await fallback();
      return;
    }

    const state = readState(storage, this.storageKey);
    await update(state);
    writeState(storage, this.storageKey, state);
  }
}

function getLocalStorage(): Storage | null {
  return typeof globalThis.localStorage === "undefined" ? null : globalThis.localStorage;
}

function readState(storage: Storage, key: string): BrowserReminderState {
  const raw = storage.getItem(key);

  if (!raw) {
    return {
      reminders: [],
      occurrences: [],
      history: []
    };
  }

  return JSON.parse(raw) as BrowserReminderState;
}

function writeState(storage: Storage, key: string, state: BrowserReminderState): void {
  storage.setItem(key, JSON.stringify(state));
}

function compareReminderListItems(a: Reminder, b: Reminder): number {
  if (a.status === b.status) {
    return compareInstants(a.nextFireAtUtc, b.nextFireAtUtc);
  }

  return statusRank(a.status) - statusRank(b.status);
}

function statusRank(status: Reminder["status"]): number {
  switch (status) {
    case "due":
      return 0;
    case "snoozed":
      return 1;
    case "enabled":
      return 2;
    case "disabled":
      return 3;
    case "done":
      return 4;
    case "deleted":
      return 5;
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
