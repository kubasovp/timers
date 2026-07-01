import type { Instant } from "@/shared/time/instant";

export type CustomTimerSessionStatus = "running" | "paused" | "completed" | "stopped";

export interface CustomTimerInput {
  hours: number;
  minutes: number;
  seconds: number;
}

export interface CustomTimerSession {
  id: string;
  sessionType: "custom_timer";
  status: CustomTimerSessionStatus;
  title?: string;
  startedAtUtc: Instant;
  endsAtUtc: Instant;
  pausedAtUtc?: Instant;
  completedAtUtc?: Instant;
  stoppedAtUtc?: Instant;
  durationTotalSec: number;
  remainingSecAtPause?: number;
  input: CustomTimerInput;
  timerPresetId?: string;
  version: number;
}

export interface CustomTimerPreset {
  id: string;
  name: string;
  durationTotalSec: number;
  description?: string;
  category?: string;
  createdAtUtc: Instant;
  updatedAtUtc: Instant;
}

export interface CustomTimerHistoryEvent {
  id: string;
  sessionId: string;
  eventType: string;
  eventPayload: Record<string, unknown>;
  occurredAtUtc: Instant;
}
