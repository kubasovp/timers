import type {
  CustomTimerHistoryEvent,
  CustomTimerPreset,
  CustomTimerSession
} from "./domain/custom-timer-types";
import type { Instant } from "@/shared/time/instant";

export interface CustomTimerRepository {
  saveSession(session: CustomTimerSession): Promise<void>;
  getSession(id: string): Promise<CustomTimerSession | null>;
  listActiveSessions(): Promise<CustomTimerSession[]>;
  listCompletedSessions(): Promise<CustomTimerSession[]>;
  listDueRunningSessions(now: Instant): Promise<CustomTimerSession[]>;
  deleteSession(id: string): Promise<void>;
  listPresets(): Promise<CustomTimerPreset[]>;
  savePreset(preset: CustomTimerPreset): Promise<void>;
  appendHistoryEvent(event: CustomTimerHistoryEvent): Promise<void>;
  listHistory(): Promise<CustomTimerHistoryEvent[]>;
}
