import type {
  FocusHistoryEvent,
  FocusProfile,
  FocusSession
} from "./domain/focus-types";
import type { Instant } from "@/shared/time/instant";

export interface FocusRepository {
  saveProfile(profile: FocusProfile): Promise<void>;
  getProfile(id: string): Promise<FocusProfile | null>;
  listProfiles(): Promise<FocusProfile[]>;
  deleteProfile(id: string): Promise<void>;
  hasActiveSessionForProfile(profileId: string): Promise<boolean>;
  saveSession(session: FocusSession): Promise<void>;
  getSession(id: string): Promise<FocusSession | null>;
  getActiveSession(): Promise<FocusSession | null>;
  listDueRunningSessions(now: Instant): Promise<FocusSession[]>;
  appendHistoryEvent(event: FocusHistoryEvent): Promise<void>;
  listHistory(): Promise<FocusHistoryEvent[]>;
}
