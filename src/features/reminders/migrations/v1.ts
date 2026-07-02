import type { Migration } from "@/kernel/storage/migrations";

export const reminderMigrations: Migration[] = [
  {
    id: "reminders.v1",
    description: "One-time reminders and reminder occurrence history",
    statements: [
      `create table if not exists active_reminders (
        id text primary key,
        title text not null,
        message text,
        status text not null,
        schedule_type text not null,
        time_semantics text not null,
        one_time_fire_at_utc text,
        daily_time_local text,
        interval_seconds integer,
        interval_anchor_at_utc text,
        next_fire_at_utc text not null,
        timezone_snapshot text,
        last_fired_at_utc text,
        last_fired_local_date text,
        snoozed_until_utc text,
        is_enabled integer not null,
        created_at_utc text not null,
        updated_at_utc text not null,
        deleted_at_utc text,
        version integer not null
      )`,
      `create index if not exists idx_active_reminders_next_enabled
        on active_reminders(next_fire_at_utc, is_enabled)`,
      `create index if not exists idx_active_reminders_schedule_status_next
        on active_reminders(schedule_type, status, next_fire_at_utc)`,
      `create table if not exists reminder_occurrences (
        id text primary key,
        reminder_id text not null,
        scheduled_for_utc text not null,
        status text not null,
        fired_at_utc text,
        acknowledged_at_utc text,
        snoozed_until_utc text,
        local_date_key text,
        idempotency_key text not null unique,
        foreign key (reminder_id) references active_reminders(id)
      )`,
      `create index if not exists idx_reminder_occurrences_reminder_scheduled
        on reminder_occurrences(reminder_id, scheduled_for_utc)`
    ]
  }
];
