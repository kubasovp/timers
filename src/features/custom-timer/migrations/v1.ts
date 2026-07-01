import type { Migration } from "@/kernel/storage/migrations";

export const customTimerMigrations: Migration[] = [
  {
    id: "custom-timer.v1",
    description: "Custom timer active sessions, presets and history indexes",
    statements: [
      `create table if not exists active_timer_sessions (
        id text primary key,
        session_type text not null,
        status text not null,
        title text,
        started_at_utc text not null,
        ends_at_utc text not null,
        paused_at_utc text,
        completed_at_utc text,
        stopped_at_utc text,
        duration_total_sec integer not null,
        remaining_sec_at_pause integer,
        input_hours integer not null,
        input_minutes integer not null,
        input_seconds integer not null,
        timer_preset_id text,
        profile_id text,
        focus_phase text,
        focus_cycle_index integer,
        focus_total_cycles integer,
        focus_completed_cycles integer,
        phase_started_at_utc text,
        phase_ends_at_utc text,
        phase_duration_sec integer,
        version integer not null
      )`,
      `create index if not exists idx_active_timer_sessions_status_ends
        on active_timer_sessions(status, ends_at_utc)`,
      `create index if not exists idx_active_timer_sessions_type_status
        on active_timer_sessions(session_type, status)`,
      `create table if not exists timer_presets (
        id text primary key,
        name text not null,
        duration_total_sec integer not null,
        description text,
        category text,
        created_at_utc text not null,
        updated_at_utc text not null
      )`,
      `create index if not exists idx_timer_presets_category_name
        on timer_presets(category, name)`,
      `create table if not exists history_events (
        id text primary key,
        aggregate_type text not null,
        aggregate_id text not null,
        event_type text not null,
        event_payload_json text not null,
        occurred_at_utc text not null,
        causation_id text,
        correlation_id text
      )`,
      `create index if not exists idx_history_events_aggregate
        on history_events(aggregate_type, aggregate_id, occurred_at_utc)`
    ]
  }
];
