import { compareInstants, isDue, type Instant } from "@/shared/time/instant";
import type {
  Reminder,
  ReminderHistoryEvent,
  ReminderOccurrence
} from "../domain/reminder-types";
import type { ReminderRepository } from "../ports";

export class InMemoryReminderRepository implements ReminderRepository {
  private readonly reminders = new Map<string, Reminder>();
  private readonly occurrences = new Map<string, ReminderOccurrence>();
  private readonly history: ReminderHistoryEvent[] = [];

  async saveReminder(reminder: Reminder): Promise<void> {
    this.reminders.set(reminder.id, clone(reminder));
  }

  async getReminder(id: string): Promise<Reminder | null> {
    const reminder = this.reminders.get(id);
    return reminder ? clone(reminder) : null;
  }

  async listReminders(): Promise<Reminder[]> {
    return Array.from(this.reminders.values())
      .filter((reminder) => reminder.status !== "deleted")
      .sort(compareReminderListItems)
      .map(clone);
  }

  async listDueReminders(now: Instant): Promise<Reminder[]> {
    return Array.from(this.reminders.values())
      .filter(
        (reminder) =>
          reminder.isEnabled &&
          reminder.scheduleType === "one_time" &&
          (reminder.status === "enabled" || reminder.status === "snoozed") &&
          isDue(reminder.nextFireAtUtc, now)
      )
      .sort((a, b) => compareInstants(a.nextFireAtUtc, b.nextFireAtUtc))
      .map(clone);
  }

  async saveOccurrence(occurrence: ReminderOccurrence): Promise<void> {
    this.occurrences.set(occurrence.id, clone(occurrence));
  }

  async getOccurrenceByIdempotencyKey(
    idempotencyKey: string
  ): Promise<ReminderOccurrence | null> {
    const occurrence = Array.from(this.occurrences.values()).find(
      (item) => item.idempotencyKey === idempotencyKey
    );
    return occurrence ? clone(occurrence) : null;
  }

  async getLatestOccurrence(reminderId: string): Promise<ReminderOccurrence | null> {
    const occurrence = Array.from(this.occurrences.values())
      .filter((item) => item.reminderId === reminderId)
      .sort((a, b) => compareInstants(b.scheduledForUtc, a.scheduledForUtc))[0];
    return occurrence ? clone(occurrence) : null;
  }

  async listOccurrences(reminderId?: string): Promise<ReminderOccurrence[]> {
    return Array.from(this.occurrences.values())
      .filter((occurrence) => !reminderId || occurrence.reminderId === reminderId)
      .sort((a, b) => compareInstants(a.scheduledForUtc, b.scheduledForUtc))
      .map(clone);
  }

  async appendHistoryEvent(event: ReminderHistoryEvent): Promise<void> {
    this.history.push(clone(event));
  }

  async listHistory(): Promise<ReminderHistoryEvent[]> {
    return this.history.map(clone);
  }
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
