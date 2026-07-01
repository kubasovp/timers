import type { DatabaseConnection } from "@/kernel/storage/database";
import { isDue, type Instant } from "@/shared/time/instant";
import type {
  CustomTimerHistoryEvent,
  CustomTimerPreset,
  CustomTimerSession,
  CustomTimerSessionStatus
} from "../domain/custom-timer-types";
import type { CustomTimerRepository } from "../ports";

interface TimerSessionRow extends Record<string, unknown> {
  id: string;
  status: CustomTimerSessionStatus;
  title: string | null;
  started_at_utc: string;
  ends_at_utc: string;
  paused_at_utc: string | null;
  completed_at_utc: string | null;
  stopped_at_utc: string | null;
  duration_total_sec: number;
  remaining_sec_at_pause: number | null;
  input_hours: number;
  input_minutes: number;
  input_seconds: number;
  timer_preset_id: string | null;
  version: number;
}

interface TimerPresetRow extends Record<string, unknown> {
  id: string;
  name: string;
  duration_total_sec: number;
  description: string | null;
  category: string | null;
  created_at_utc: string;
  updated_at_utc: string;
}

interface TimerHistoryRow extends Record<string, unknown> {
  id: string;
  aggregate_id: string;
  event_type: string;
  event_payload_json: string;
  occurred_at_utc: string;
}

export class SqlCustomTimerRepository implements CustomTimerRepository {
  constructor(private readonly db: DatabaseConnection) {}

  async saveSession(session: CustomTimerSession): Promise<void> {
    await this.db.execute(
      `insert into active_timer_sessions (
        id, session_type, status, title, started_at_utc, ends_at_utc, paused_at_utc,
        completed_at_utc, stopped_at_utc, duration_total_sec, remaining_sec_at_pause,
        input_hours, input_minutes, input_seconds, timer_preset_id, version
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      on conflict(id) do update set
        status = excluded.status,
        title = excluded.title,
        started_at_utc = excluded.started_at_utc,
        ends_at_utc = excluded.ends_at_utc,
        paused_at_utc = excluded.paused_at_utc,
        completed_at_utc = excluded.completed_at_utc,
        stopped_at_utc = excluded.stopped_at_utc,
        duration_total_sec = excluded.duration_total_sec,
        remaining_sec_at_pause = excluded.remaining_sec_at_pause,
        input_hours = excluded.input_hours,
        input_minutes = excluded.input_minutes,
        input_seconds = excluded.input_seconds,
        timer_preset_id = excluded.timer_preset_id,
        version = excluded.version`,
      [
        session.id,
        "custom_timer",
        session.status,
        session.title ?? null,
        session.startedAtUtc,
        session.endsAtUtc,
        session.pausedAtUtc ?? null,
        session.completedAtUtc ?? null,
        session.stoppedAtUtc ?? null,
        session.durationTotalSec,
        session.remainingSecAtPause ?? null,
        session.input.hours,
        session.input.minutes,
        session.input.seconds,
        session.timerPresetId ?? null,
        session.version
      ]
    );
  }

  async getSession(id: string): Promise<CustomTimerSession | null> {
    const rows = await this.db.select<TimerSessionRow>(
      `select * from active_timer_sessions where id = ? and session_type = 'custom_timer'`,
      [id]
    );
    return rows[0] ? mapSession(rows[0]) : null;
  }

  async listActiveSessions(): Promise<CustomTimerSession[]> {
    const rows = await this.db.select<TimerSessionRow>(
      `select * from active_timer_sessions
       where session_type = 'custom_timer' and status in ('running', 'paused')
       order by started_at_utc asc`
    );
    return rows.map(mapSession);
  }

  async listDueRunningSessions(now: Instant): Promise<CustomTimerSession[]> {
    const rows = await this.db.select<TimerSessionRow>(
      `select * from active_timer_sessions
       where session_type = 'custom_timer' and status = 'running' and ends_at_utc <= ?
       order by ends_at_utc asc`,
      [now]
    );
    return rows.map(mapSession).filter((session) => isDue(session.endsAtUtc, now));
  }

  async listPresets(): Promise<CustomTimerPreset[]> {
    const rows = await this.db.select<TimerPresetRow>(
      `select * from timer_presets order by category asc, name asc`
    );
    return rows.map(mapPreset);
  }

  async savePreset(preset: CustomTimerPreset): Promise<void> {
    await this.db.execute(
      `insert into timer_presets (
        id, name, duration_total_sec, description, category, created_at_utc, updated_at_utc
      ) values (?, ?, ?, ?, ?, ?, ?)
      on conflict(id) do update set
        name = excluded.name,
        duration_total_sec = excluded.duration_total_sec,
        description = excluded.description,
        category = excluded.category,
        updated_at_utc = excluded.updated_at_utc`,
      [
        preset.id,
        preset.name,
        preset.durationTotalSec,
        preset.description ?? null,
        preset.category ?? null,
        preset.createdAtUtc,
        preset.updatedAtUtc
      ]
    );
  }

  async appendHistoryEvent(event: CustomTimerHistoryEvent): Promise<void> {
    await this.db.execute(
      `insert into history_events (
        id, aggregate_type, aggregate_id, event_type, event_payload_json, occurred_at_utc
      ) values (?, 'timer_session', ?, ?, ?, ?)`,
      [
        event.id,
        event.sessionId,
        event.eventType,
        JSON.stringify(event.eventPayload),
        event.occurredAtUtc
      ]
    );
  }

  async listHistory(): Promise<CustomTimerHistoryEvent[]> {
    const rows = await this.db.select<TimerHistoryRow>(
      `select * from history_events
       where aggregate_type = 'timer_session'
       order by occurred_at_utc desc`
    );
    return rows.map((row) => ({
      id: row.id,
      sessionId: row.aggregate_id,
      eventType: row.event_type,
      eventPayload: JSON.parse(row.event_payload_json) as Record<string, unknown>,
      occurredAtUtc: row.occurred_at_utc
    }));
  }
}

function mapSession(row: TimerSessionRow): CustomTimerSession {
  return {
    id: row.id,
    sessionType: "custom_timer",
    status: row.status,
    title: row.title ?? undefined,
    startedAtUtc: row.started_at_utc,
    endsAtUtc: row.ends_at_utc,
    pausedAtUtc: row.paused_at_utc ?? undefined,
    completedAtUtc: row.completed_at_utc ?? undefined,
    stoppedAtUtc: row.stopped_at_utc ?? undefined,
    durationTotalSec: row.duration_total_sec,
    remainingSecAtPause: row.remaining_sec_at_pause ?? undefined,
    input: {
      hours: row.input_hours,
      minutes: row.input_minutes,
      seconds: row.input_seconds
    },
    timerPresetId: row.timer_preset_id ?? undefined,
    version: row.version
  };
}

function mapPreset(row: TimerPresetRow): CustomTimerPreset {
  return {
    id: row.id,
    name: row.name,
    durationTotalSec: row.duration_total_sec,
    description: row.description ?? undefined,
    category: row.category ?? undefined,
    createdAtUtc: row.created_at_utc,
    updatedAtUtc: row.updated_at_utc
  };
}
