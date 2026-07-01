import type { DatabaseConnection } from "@/kernel/storage/database";
import { isDue, type Instant } from "@/shared/time/instant";
import {
  isActiveFocusSession,
  isRunningFocusSession
} from "../domain/focus-state-machine";
import type {
  FocusHistoryEvent,
  FocusPhase,
  FocusProfile,
  FocusSession,
  FocusSessionStatus
} from "../domain/focus-types";
import type { FocusRepository } from "../ports";

interface FocusProfileRow extends Record<string, unknown> {
  id: string;
  name: string;
  focus_duration_sec: number;
  short_break_sec: number;
  long_break_sec: number;
  cycles_before_long_break: number;
  created_at_utc: string;
  updated_at_utc: string;
}

interface FocusSessionRow extends Record<string, unknown> {
  id: string;
  status: FocusSessionStatus;
  title: string | null;
  started_at_utc: string;
  ends_at_utc: string;
  paused_at_utc: string | null;
  completed_at_utc: string | null;
  stopped_at_utc: string | null;
  duration_total_sec: number;
  remaining_sec_at_pause: number | null;
  profile_id: string | null;
  focus_phase: FocusPhase | null;
  focus_cycle_index: number | null;
  focus_total_cycles: number | null;
  focus_completed_cycles: number | null;
  phase_started_at_utc: string | null;
  phase_ends_at_utc: string | null;
  phase_duration_sec: number | null;
  version: number;
}

interface FocusHistoryRow extends Record<string, unknown> {
  id: string;
  aggregate_type: "timer_session" | "profile";
  aggregate_id: string;
  event_type: string;
  event_payload_json: string;
  occurred_at_utc: string;
}

export class SqlFocusRepository implements FocusRepository {
  constructor(private readonly db: DatabaseConnection) {}

  async saveProfile(profile: FocusProfile): Promise<void> {
    await this.db.execute(
      `insert into focus_profiles (
        id, name, focus_duration_sec, short_break_sec, long_break_sec,
        cycles_before_long_break, created_at_utc, updated_at_utc
      ) values (?, ?, ?, ?, ?, ?, ?, ?)
      on conflict(id) do update set
        name = excluded.name,
        focus_duration_sec = excluded.focus_duration_sec,
        short_break_sec = excluded.short_break_sec,
        long_break_sec = excluded.long_break_sec,
        cycles_before_long_break = excluded.cycles_before_long_break,
        updated_at_utc = excluded.updated_at_utc`,
      [
        profile.id,
        profile.name,
        profile.focusDurationSec,
        profile.shortBreakSec,
        profile.longBreakSec,
        profile.cyclesBeforeLongBreak,
        profile.createdAtUtc,
        profile.updatedAtUtc
      ]
    );
  }

  async getProfile(id: string): Promise<FocusProfile | null> {
    const rows = await this.db.select<FocusProfileRow>(
      `select * from focus_profiles where id = ?`,
      [id]
    );
    return rows[0] ? mapProfile(rows[0]) : null;
  }

  async listProfiles(): Promise<FocusProfile[]> {
    const rows = await this.db.select<FocusProfileRow>(
      `select * from focus_profiles order by name asc`
    );
    return rows.map(mapProfile);
  }

  async deleteProfile(id: string): Promise<void> {
    await this.db.execute(`delete from focus_profiles where id = ?`, [id]);
  }

  async hasActiveSessionForProfile(profileId: string): Promise<boolean> {
    const rows = await this.db.select<{ id: string }>(
      `select id from active_timer_sessions
       where session_type = 'focus'
         and profile_id = ?
         and status in ('running_focus', 'running_break', 'paused_focus', 'paused_break')
       limit 1`,
      [profileId]
    );
    return rows.length > 0;
  }

  async saveSession(session: FocusSession): Promise<void> {
    await this.db.execute(
      `insert into active_timer_sessions (
        id, session_type, status, title, started_at_utc, ends_at_utc, paused_at_utc,
        completed_at_utc, stopped_at_utc, duration_total_sec,
        remaining_sec_at_pause, input_hours, input_minutes, input_seconds, timer_preset_id,
        profile_id, focus_phase, focus_cycle_index, focus_total_cycles, focus_completed_cycles,
        phase_started_at_utc, phase_ends_at_utc, phase_duration_sec, version
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        profile_id = excluded.profile_id,
        focus_phase = excluded.focus_phase,
        focus_cycle_index = excluded.focus_cycle_index,
        focus_total_cycles = excluded.focus_total_cycles,
        focus_completed_cycles = excluded.focus_completed_cycles,
        phase_started_at_utc = excluded.phase_started_at_utc,
        phase_ends_at_utc = excluded.phase_ends_at_utc,
        phase_duration_sec = excluded.phase_duration_sec,
        version = excluded.version`,
      [
        session.id,
        "focus",
        session.status,
        session.title,
        session.startedAtUtc,
        session.phaseEndsAtUtc,
        session.pausedAtUtc ?? null,
        session.completedAtUtc ?? null,
        session.stoppedAtUtc ?? null,
        session.durationTotalSec,
        session.remainingSecAtPause ?? null,
        0,
        0,
        0,
        null,
        session.profileId,
        session.currentPhase,
        session.cycleIndex,
        session.totalCycles,
        session.completedCycles,
        session.phaseStartedAtUtc,
        session.phaseEndsAtUtc,
        session.phaseDurationSec,
        session.version
      ]
    );
  }

  async getSession(id: string): Promise<FocusSession | null> {
    const rows = await this.db.select<FocusSessionRow>(
      `select * from active_timer_sessions where id = ? and session_type = 'focus'`,
      [id]
    );
    return rows[0] ? mapSession(rows[0]) : null;
  }

  async getActiveSession(): Promise<FocusSession | null> {
    const rows = await this.db.select<FocusSessionRow>(
      `select * from active_timer_sessions
       where session_type = 'focus'
         and status in ('running_focus', 'running_break', 'paused_focus', 'paused_break')
       order by started_at_utc desc
       limit 1`
    );
    return rows[0] ? mapSession(rows[0]) : null;
  }

  async listDueRunningSessions(now: Instant): Promise<FocusSession[]> {
    const rows = await this.db.select<FocusSessionRow>(
      `select * from active_timer_sessions
       where session_type = 'focus'
         and status in ('running_focus', 'running_break')
         and phase_ends_at_utc <= ?
       order by phase_ends_at_utc asc`,
      [now]
    );
    return rows
      .map(mapSession)
      .filter((session) => isRunningFocusSession(session) && isDue(session.phaseEndsAtUtc, now));
  }

  async appendHistoryEvent(event: FocusHistoryEvent): Promise<void> {
    await this.db.execute(
      `insert into history_events (
        id, aggregate_type, aggregate_id, event_type, event_payload_json, occurred_at_utc
      ) values (?, ?, ?, ?, ?, ?)`,
      [
        event.id,
        event.aggregateType,
        event.aggregateId,
        event.eventType,
        JSON.stringify(event.eventPayload),
        event.occurredAtUtc
      ]
    );
  }

  async listHistory(): Promise<FocusHistoryEvent[]> {
    const rows = await this.db.select<FocusHistoryRow>(
      `select * from history_events
       where event_type like 'focus_%'
       order by occurred_at_utc desc`
    );
    return rows.map((row) => ({
      id: row.id,
      aggregateType: row.aggregate_type,
      aggregateId: row.aggregate_id,
      eventType: row.event_type,
      eventPayload: JSON.parse(row.event_payload_json) as Record<string, unknown>,
      occurredAtUtc: row.occurred_at_utc
    }));
  }
}

function mapProfile(row: FocusProfileRow): FocusProfile {
  return {
    id: row.id,
    name: row.name,
    focusDurationSec: row.focus_duration_sec,
    shortBreakSec: row.short_break_sec,
    longBreakSec: row.long_break_sec,
    cyclesBeforeLongBreak: row.cycles_before_long_break,
    createdAtUtc: row.created_at_utc,
    updatedAtUtc: row.updated_at_utc
  };
}

function mapSession(row: FocusSessionRow): FocusSession {
  const phaseEndsAtUtc = row.phase_ends_at_utc ?? row.ends_at_utc;

  return {
    id: row.id,
    sessionType: "focus",
    status: row.status,
    title: row.title ?? "Focus",
    profileId: row.profile_id ?? "",
    startedAtUtc: row.started_at_utc,
    completedAtUtc: row.completed_at_utc ?? undefined,
    stoppedAtUtc: row.stopped_at_utc ?? undefined,
    pausedAtUtc: row.paused_at_utc ?? undefined,
    remainingSecAtPause: row.remaining_sec_at_pause ?? undefined,
    currentPhase: row.focus_phase ?? "focus",
    cycleIndex: row.focus_cycle_index ?? 1,
    totalCycles: row.focus_total_cycles ?? 1,
    completedCycles: row.focus_completed_cycles ?? 0,
    phaseStartedAtUtc: row.phase_started_at_utc ?? row.started_at_utc,
    phaseEndsAtUtc,
    phaseDurationSec: row.phase_duration_sec ?? row.duration_total_sec,
    durationTotalSec: row.duration_total_sec,
    version: row.version
  };
}
