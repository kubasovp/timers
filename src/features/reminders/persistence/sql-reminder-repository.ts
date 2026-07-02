import type { DatabaseConnection } from "@/kernel/storage/database";
import type { Instant } from "@/shared/time/instant";
import type {
  Reminder,
  ReminderHistoryEvent,
  ReminderOccurrence,
  ReminderOccurrenceStatus,
  ReminderScheduleType,
  ReminderStatus,
  ReminderTimeSemantics
} from "../domain/reminder-types";
import type { ReminderRepository } from "../ports";

interface ReminderRow extends Record<string, unknown> {
  id: string;
  title: string;
  message: string | null;
  status: ReminderStatus;
  schedule_type: ReminderScheduleType;
  time_semantics: ReminderTimeSemantics;
  one_time_fire_at_utc: string | null;
  daily_time_local: string | null;
  interval_seconds: number | null;
  interval_anchor_at_utc: string | null;
  next_fire_at_utc: string;
  timezone_snapshot: string | null;
  last_fired_at_utc: string | null;
  last_fired_local_date: string | null;
  snoozed_until_utc: string | null;
  is_enabled: number;
  created_at_utc: string;
  updated_at_utc: string;
  deleted_at_utc: string | null;
  version: number;
}

interface ReminderOccurrenceRow extends Record<string, unknown> {
  id: string;
  reminder_id: string;
  scheduled_for_utc: string;
  status: ReminderOccurrenceStatus;
  fired_at_utc: string | null;
  acknowledged_at_utc: string | null;
  snoozed_until_utc: string | null;
  local_date_key: string | null;
  idempotency_key: string;
}

interface ReminderHistoryRow extends Record<string, unknown> {
  id: string;
  aggregate_id: string;
  event_type: string;
  event_payload_json: string;
  occurred_at_utc: string;
}

export class SqlReminderRepository implements ReminderRepository {
  constructor(private readonly db: DatabaseConnection) {}

  async saveReminder(reminder: Reminder): Promise<void> {
    await this.db.execute(
      `insert into active_reminders (
        id, title, message, status, schedule_type, time_semantics,
        one_time_fire_at_utc, daily_time_local, interval_seconds, interval_anchor_at_utc,
        next_fire_at_utc, timezone_snapshot, last_fired_at_utc, last_fired_local_date,
        snoozed_until_utc, is_enabled, created_at_utc, updated_at_utc, deleted_at_utc, version
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      on conflict(id) do update set
        title = excluded.title,
        message = excluded.message,
        status = excluded.status,
        schedule_type = excluded.schedule_type,
        time_semantics = excluded.time_semantics,
        one_time_fire_at_utc = excluded.one_time_fire_at_utc,
        daily_time_local = excluded.daily_time_local,
        interval_seconds = excluded.interval_seconds,
        interval_anchor_at_utc = excluded.interval_anchor_at_utc,
        next_fire_at_utc = excluded.next_fire_at_utc,
        timezone_snapshot = excluded.timezone_snapshot,
        last_fired_at_utc = excluded.last_fired_at_utc,
        last_fired_local_date = excluded.last_fired_local_date,
        snoozed_until_utc = excluded.snoozed_until_utc,
        is_enabled = excluded.is_enabled,
        updated_at_utc = excluded.updated_at_utc,
        deleted_at_utc = excluded.deleted_at_utc,
        version = excluded.version`,
      [
        reminder.id,
        reminder.title,
        reminder.message ?? null,
        reminder.status,
        reminder.scheduleType,
        reminder.timeSemantics,
        reminder.oneTimeFireAtUtc ?? null,
        reminder.dailyTimeLocal ?? null,
        reminder.intervalSeconds ?? null,
        reminder.intervalAnchorAtUtc ?? null,
        reminder.nextFireAtUtc,
        reminder.timezoneSnapshot ?? null,
        reminder.lastFiredAtUtc ?? null,
        reminder.lastFiredLocalDate ?? null,
        reminder.snoozedUntilUtc ?? null,
        reminder.isEnabled ? 1 : 0,
        reminder.createdAtUtc,
        reminder.updatedAtUtc,
        reminder.deletedAtUtc ?? null,
        reminder.version
      ]
    );
  }

  async getReminder(id: string): Promise<Reminder | null> {
    const rows = await this.db.select<ReminderRow>(
      `select * from active_reminders where id = ?`,
      [id]
    );
    return rows[0] ? mapReminder(rows[0]) : null;
  }

  async listReminders(): Promise<Reminder[]> {
    const rows = await this.db.select<ReminderRow>(
      `select * from active_reminders
       where status != 'deleted'
       order by
         case status
           when 'due' then 0
           when 'snoozed' then 1
           when 'enabled' then 2
           when 'disabled' then 3
           when 'done' then 4
           else 5
         end,
         next_fire_at_utc asc`
    );
    return rows.map(mapReminder);
  }

  async listDueReminders(now: Instant): Promise<Reminder[]> {
    const rows = await this.db.select<ReminderRow>(
      `select * from active_reminders
       where is_enabled = 1
         and schedule_type = 'one_time'
         and status in ('enabled', 'snoozed')
         and next_fire_at_utc <= ?
       order by next_fire_at_utc asc`,
      [now]
    );
    return rows.map(mapReminder);
  }

  async saveOccurrence(occurrence: ReminderOccurrence): Promise<void> {
    await this.db.execute(
      `insert into reminder_occurrences (
        id, reminder_id, scheduled_for_utc, status, fired_at_utc,
        acknowledged_at_utc, snoozed_until_utc, local_date_key, idempotency_key
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?)
      on conflict(id) do update set
        status = excluded.status,
        fired_at_utc = excluded.fired_at_utc,
        acknowledged_at_utc = excluded.acknowledged_at_utc,
        snoozed_until_utc = excluded.snoozed_until_utc,
        local_date_key = excluded.local_date_key`,
      [
        occurrence.id,
        occurrence.reminderId,
        occurrence.scheduledForUtc,
        occurrence.status,
        occurrence.firedAtUtc ?? null,
        occurrence.acknowledgedAtUtc ?? null,
        occurrence.snoozedUntilUtc ?? null,
        occurrence.localDateKey ?? null,
        occurrence.idempotencyKey
      ]
    );
  }

  async getOccurrenceByIdempotencyKey(
    idempotencyKey: string
  ): Promise<ReminderOccurrence | null> {
    const rows = await this.db.select<ReminderOccurrenceRow>(
      `select * from reminder_occurrences where idempotency_key = ?`,
      [idempotencyKey]
    );
    return rows[0] ? mapOccurrence(rows[0]) : null;
  }

  async getLatestOccurrence(reminderId: string): Promise<ReminderOccurrence | null> {
    const rows = await this.db.select<ReminderOccurrenceRow>(
      `select * from reminder_occurrences
       where reminder_id = ?
       order by scheduled_for_utc desc
       limit 1`,
      [reminderId]
    );
    return rows[0] ? mapOccurrence(rows[0]) : null;
  }

  async listOccurrences(reminderId?: string): Promise<ReminderOccurrence[]> {
    const rows = reminderId
      ? await this.db.select<ReminderOccurrenceRow>(
          `select * from reminder_occurrences
           where reminder_id = ?
           order by scheduled_for_utc asc`,
          [reminderId]
        )
      : await this.db.select<ReminderOccurrenceRow>(
          `select * from reminder_occurrences
           order by scheduled_for_utc asc`
        );
    return rows.map(mapOccurrence);
  }

  async appendHistoryEvent(event: ReminderHistoryEvent): Promise<void> {
    await this.db.execute(
      `insert into history_events (
        id, aggregate_type, aggregate_id, event_type, event_payload_json, occurred_at_utc
      ) values (?, 'reminder', ?, ?, ?, ?)`,
      [
        event.id,
        event.reminderId,
        event.eventType,
        JSON.stringify(event.eventPayload),
        event.occurredAtUtc
      ]
    );
  }

  async listHistory(): Promise<ReminderHistoryEvent[]> {
    const rows = await this.db.select<ReminderHistoryRow>(
      `select * from history_events
       where aggregate_type = 'reminder'
       order by occurred_at_utc desc`
    );
    return rows.map((row) => ({
      id: row.id,
      reminderId: row.aggregate_id,
      eventType: row.event_type,
      eventPayload: JSON.parse(row.event_payload_json) as Record<string, unknown>,
      occurredAtUtc: row.occurred_at_utc
    }));
  }
}

function mapReminder(row: ReminderRow): Reminder {
  return {
    id: row.id,
    title: row.title,
    message: row.message ?? undefined,
    status: row.status,
    scheduleType: row.schedule_type,
    timeSemantics: row.time_semantics,
    oneTimeFireAtUtc: row.one_time_fire_at_utc ?? undefined,
    dailyTimeLocal: row.daily_time_local ?? undefined,
    intervalSeconds: row.interval_seconds ?? undefined,
    intervalAnchorAtUtc: row.interval_anchor_at_utc ?? undefined,
    nextFireAtUtc: row.next_fire_at_utc,
    timezoneSnapshot: row.timezone_snapshot ?? undefined,
    lastFiredAtUtc: row.last_fired_at_utc ?? undefined,
    lastFiredLocalDate: row.last_fired_local_date ?? undefined,
    snoozedUntilUtc: row.snoozed_until_utc ?? undefined,
    isEnabled: Boolean(row.is_enabled),
    createdAtUtc: row.created_at_utc,
    updatedAtUtc: row.updated_at_utc,
    deletedAtUtc: row.deleted_at_utc ?? undefined,
    version: row.version
  };
}

function mapOccurrence(row: ReminderOccurrenceRow): ReminderOccurrence {
  return {
    id: row.id,
    reminderId: row.reminder_id,
    scheduledForUtc: row.scheduled_for_utc,
    status: row.status,
    firedAtUtc: row.fired_at_utc ?? undefined,
    acknowledgedAtUtc: row.acknowledged_at_utc ?? undefined,
    snoozedUntilUtc: row.snoozed_until_utc ?? undefined,
    localDateKey: row.local_date_key ?? undefined,
    idempotencyKey: row.idempotency_key
  };
}
