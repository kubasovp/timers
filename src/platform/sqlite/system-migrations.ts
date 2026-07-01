import type { Migration } from "@/kernel/storage/migrations";

export const systemMigrations: Migration[] = [
  {
    id: "system.v1",
    description: "System settings and scheduler delivery history",
    statements: [
      `create table if not exists app_settings (
        key text primary key,
        value_json text not null,
        schema_version integer not null,
        updated_at_utc text not null
      )`,
      `create table if not exists scheduler_occurrences (
        id text primary key,
        source_type text not null,
        source_id text not null,
        scheduled_for_utc text not null,
        processed_at_utc text,
        result_status text not null,
        idempotency_key text not null unique
      )`,
      `create index if not exists idx_scheduler_occurrences_source
        on scheduler_occurrences(source_type, source_id, scheduled_for_utc)`,
      `create table if not exists notification_delivery_log (
        id text primary key,
        occurrence_id text not null,
        channel text not null,
        delivery_status text not null,
        attempt_no integer not null,
        created_at_utc text not null,
        foreign key (occurrence_id) references scheduler_occurrences(id)
      )`
    ]
  }
];
