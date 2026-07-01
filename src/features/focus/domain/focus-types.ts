import type { Instant } from "@/shared/time/instant";

export type FocusSessionStatus =
  | "running_focus"
  | "running_break"
  | "paused_focus"
  | "paused_break"
  | "completed"
  | "stopped";

export type FocusPhase = "focus" | "short_break" | "long_break";

export interface FocusProfile {
  id: string;
  name: string;
  focusDurationSec: number;
  shortBreakSec: number;
  longBreakSec: number;
  cyclesBeforeLongBreak: number;
  createdAtUtc: Instant;
  updatedAtUtc: Instant;
}

export interface FocusSession {
  id: string;
  sessionType: "focus";
  status: FocusSessionStatus;
  title: string;
  profileId: string;
  startedAtUtc: Instant;
  completedAtUtc?: Instant;
  stoppedAtUtc?: Instant;
  pausedAtUtc?: Instant;
  remainingSecAtPause?: number;
  currentPhase: FocusPhase;
  cycleIndex: number;
  totalCycles: number;
  completedCycles: number;
  phaseStartedAtUtc: Instant;
  phaseEndsAtUtc: Instant;
  phaseDurationSec: number;
  durationTotalSec: number;
  version: number;
}

export interface FocusHistoryEvent {
  id: string;
  aggregateType: "timer_session" | "profile";
  aggregateId: string;
  eventType: string;
  eventPayload: Record<string, unknown>;
  occurredAtUtc: Instant;
}
