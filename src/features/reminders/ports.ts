import type { Instant } from "@/shared/time/instant";
import type {
  Reminder,
  ReminderHistoryEvent,
  ReminderOccurrence
} from "./domain/reminder-types";

export interface ReminderRepository {
  saveReminder(reminder: Reminder): Promise<void>;
  getReminder(id: string): Promise<Reminder | null>;
  listReminders(): Promise<Reminder[]>;
  listDueReminders(now: Instant): Promise<Reminder[]>;
  saveOccurrence(occurrence: ReminderOccurrence): Promise<void>;
  getOccurrenceByIdempotencyKey(idempotencyKey: string): Promise<ReminderOccurrence | null>;
  getLatestOccurrence(reminderId: string): Promise<ReminderOccurrence | null>;
  listOccurrences(reminderId?: string): Promise<ReminderOccurrence[]>;
  appendHistoryEvent(event: ReminderHistoryEvent): Promise<void>;
  listHistory(): Promise<ReminderHistoryEvent[]>;
}
