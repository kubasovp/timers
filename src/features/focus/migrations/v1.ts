import type { Migration } from "@/kernel/storage/migrations";

export const focusMigrations: Migration[] = [
  {
    id: "focus.v1",
    description: "Focus profiles",
    statements: [
      `create table if not exists focus_profiles (
        id text primary key,
        name text not null unique,
        focus_duration_sec integer not null,
        short_break_sec integer not null,
        long_break_sec integer not null,
        cycles_before_long_break integer not null,
        created_at_utc text not null,
        updated_at_utc text not null
      )`,
      `create index if not exists idx_focus_profiles_name
        on focus_profiles(name)`
    ]
  }
];
