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
import { InMemoryFocusRepository } from "./in-memory-focus-repository";

interface BrowserFocusState {
  profiles: FocusProfile[];
  sessions: FocusSession[];
  history: FocusHistoryEvent[];
}

export class BrowserFocusRepository implements FocusRepository {
  private readonly fallback = new InMemoryFocusRepository();

  constructor(private readonly storageKey = "timers.focus.v1") {
    const storage = getLocalStorage();

    if (storage && !storage.getItem(this.storageKey)) {
      writeState(storage, this.storageKey, {
        profiles: createDefaultFocusProfiles(),
        sessions: [],
        history: []
      });
    }
  }

  async saveProfile(profile: FocusProfile): Promise<void> {
    await this.withState(
      (state) => {
        state.profiles = state.profiles.filter((item) => item.id !== profile.id);
        state.profiles.push(clone(profile));
      },
      () => this.fallback.saveProfile(profile)
    );
  }

  async getProfile(id: string): Promise<FocusProfile | null> {
    const storage = getLocalStorage();

    if (!storage) {
      return this.fallback.getProfile(id);
    }

    return readState(storage, this.storageKey).profiles.find((profile) => profile.id === id) ?? null;
  }

  async listProfiles(): Promise<FocusProfile[]> {
    const storage = getLocalStorage();

    if (!storage) {
      return this.fallback.listProfiles();
    }

    return readState(storage, this.storageKey).profiles
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(clone);
  }

  async deleteProfile(id: string): Promise<void> {
    await this.withState(
      (state) => {
        state.profiles = state.profiles.filter((profile) => profile.id !== id);
      },
      () => this.fallback.deleteProfile(id)
    );
  }

  async hasActiveSessionForProfile(profileId: string): Promise<boolean> {
    const active = await this.getActiveSession();
    return active?.profileId === profileId;
  }

  async saveSession(session: FocusSession): Promise<void> {
    await this.withState(
      (state) => {
        state.sessions = state.sessions.filter((item) => item.id !== session.id);
        state.sessions.push(clone(session));
      },
      () => this.fallback.saveSession(session)
    );
  }

  async getSession(id: string): Promise<FocusSession | null> {
    const storage = getLocalStorage();

    if (!storage) {
      return this.fallback.getSession(id);
    }

    return readState(storage, this.storageKey).sessions.find((session) => session.id === id) ?? null;
  }

  async getActiveSession(): Promise<FocusSession | null> {
    const sessions = await this.listSessions();
    return sessions.find(isActiveFocusSession) ?? null;
  }

  async listDueRunningSessions(now: Instant): Promise<FocusSession[]> {
    const sessions = await this.listSessions();
    return sessions.filter(
      (session) => isRunningFocusSession(session) && isDue(session.phaseEndsAtUtc, now)
    );
  }

  async appendHistoryEvent(event: FocusHistoryEvent): Promise<void> {
    await this.withState(
      (state) => {
        state.history.push(clone(event));
      },
      () => this.fallback.appendHistoryEvent(event)
    );
  }

  async listHistory(): Promise<FocusHistoryEvent[]> {
    const storage = getLocalStorage();

    if (!storage) {
      return this.fallback.listHistory();
    }

    return readState(storage, this.storageKey).history.map(clone);
  }

  private async listSessions(): Promise<FocusSession[]> {
    const storage = getLocalStorage();

    if (!storage) {
      const active = await this.fallback.getActiveSession();
      return active ? [active] : [];
    }

    return readState(storage, this.storageKey).sessions.map(clone);
  }

  private async withState(
    update: (state: BrowserFocusState) => Promise<void> | void,
    fallback: () => Promise<void>
  ): Promise<void> {
    const storage = getLocalStorage();

    if (!storage) {
      await fallback();
      return;
    }

    const state = readState(storage, this.storageKey);
    await update(state);
    writeState(storage, this.storageKey, state);
  }
}

function getLocalStorage(): Storage | null {
  return typeof globalThis.localStorage === "undefined" ? null : globalThis.localStorage;
}

function readState(storage: Storage, key: string): BrowserFocusState {
  const raw = storage.getItem(key);

  if (!raw) {
    return {
      profiles: createDefaultFocusProfiles(),
      sessions: [],
      history: []
    };
  }

  return JSON.parse(raw) as BrowserFocusState;
}

function writeState(storage: Storage, key: string, state: BrowserFocusState): void {
  storage.setItem(key, JSON.stringify(state));
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
