import { isDue, type Instant } from "@/shared/time/instant";
import {
  isActiveFocusSession,
  isRunningFocusSession
} from "../domain/focus-state-machine";
import type {
  FocusHistoryEvent,
  FocusProfile,
  FocusSession
} from "../domain/focus-types";
import type { FocusRepository } from "../ports";
import { createDefaultFocusProfiles } from "./default-profiles";

export class InMemoryFocusRepository implements FocusRepository {
  private readonly profiles = new Map<string, FocusProfile>();
  private readonly sessions = new Map<string, FocusSession>();
  private readonly history: FocusHistoryEvent[] = [];

  constructor(profiles: FocusProfile[] = createDefaultFocusProfiles()) {
    for (const profile of profiles) {
      this.profiles.set(profile.id, clone(profile));
    }
  }

  async saveProfile(profile: FocusProfile): Promise<void> {
    this.profiles.set(profile.id, clone(profile));
  }

  async getProfile(id: string): Promise<FocusProfile | null> {
    const profile = this.profiles.get(id);
    return profile ? clone(profile) : null;
  }

  async listProfiles(): Promise<FocusProfile[]> {
    return Array.from(this.profiles.values())
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(clone);
  }

  async deleteProfile(id: string): Promise<void> {
    this.profiles.delete(id);
  }

  async hasActiveSessionForProfile(profileId: string): Promise<boolean> {
    return Array.from(this.sessions.values()).some(
      (session) => session.profileId === profileId && isActiveFocusSession(session)
    );
  }

  async saveSession(session: FocusSession): Promise<void> {
    this.sessions.set(session.id, clone(session));
  }

  async getSession(id: string): Promise<FocusSession | null> {
    const session = this.sessions.get(id);
    return session ? clone(session) : null;
  }

  async getActiveSession(): Promise<FocusSession | null> {
    const session = Array.from(this.sessions.values()).find(isActiveFocusSession);
    return session ? clone(session) : null;
  }

  async listDueRunningSessions(now: Instant): Promise<FocusSession[]> {
    return Array.from(this.sessions.values())
      .filter((session) => isRunningFocusSession(session) && isDue(session.phaseEndsAtUtc, now))
      .map(clone);
  }

  async appendHistoryEvent(event: FocusHistoryEvent): Promise<void> {
    this.history.push(clone(event));
  }

  async listHistory(): Promise<FocusHistoryEvent[]> {
    return this.history.map(clone);
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
