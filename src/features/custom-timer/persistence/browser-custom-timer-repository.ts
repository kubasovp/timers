import { isDue, type Instant } from "@/shared/time/instant";
import type {
  CustomTimerHistoryEvent,
  CustomTimerPreset,
  CustomTimerSession
} from "../domain/custom-timer-types";
import type { CustomTimerRepository } from "../ports";
import { createDefaultTimerPresets } from "./default-presets";
import { InMemoryCustomTimerRepository } from "./in-memory-custom-timer-repository";

interface BrowserCustomTimerState {
  sessions: CustomTimerSession[];
  presets: CustomTimerPreset[];
  history: CustomTimerHistoryEvent[];
}

export class BrowserCustomTimerRepository implements CustomTimerRepository {
  private readonly fallback = new InMemoryCustomTimerRepository();

  constructor(private readonly storageKey = "timers.customTimer.v1") {
    const storage = getLocalStorage();

    if (storage && !storage.getItem(this.storageKey)) {
      writeState(storage, this.storageKey, {
        sessions: [],
        presets: createDefaultTimerPresets(),
        history: []
      });
    }
  }

  async saveSession(session: CustomTimerSession): Promise<void> {
    await this.withState(
      async (state) => {
        state.sessions = state.sessions.filter((item) => item.id !== session.id);
        state.sessions.push(clone(session));
      },
      () => this.fallback.saveSession(session)
    );
  }

  async getSession(id: string): Promise<CustomTimerSession | null> {
    const storage = getLocalStorage();

    if (!storage) {
      return this.fallback.getSession(id);
    }

    return readState(storage, this.storageKey).sessions.find((session) => session.id === id) ?? null;
  }

  async listActiveSessions(): Promise<CustomTimerSession[]> {
    const sessions = await this.listSessions();
    return sessions.filter((session) => session.status === "running" || session.status === "paused");
  }

  async listCompletedSessions(): Promise<CustomTimerSession[]> {
    const sessions = await this.listSessions();
    return sessions
      .filter((session) => session.status === "completed")
      .sort(compareCompletedSessions);
  }

  async listDueRunningSessions(now: Instant): Promise<CustomTimerSession[]> {
    const sessions = await this.listSessions();
    return sessions.filter(
      (session) => session.status === "running" && isDue(session.endsAtUtc, now)
    );
  }

  async deleteSession(id: string): Promise<void> {
    await this.withState(
      async (state) => {
        state.sessions = state.sessions.filter((session) => session.id !== id);
      },
      () => this.fallback.deleteSession(id)
    );
  }

  async listPresets(): Promise<CustomTimerPreset[]> {
    const storage = getLocalStorage();

    if (!storage) {
      return this.fallback.listPresets();
    }

    return readState(storage, this.storageKey).presets.map(clone);
  }

  async savePreset(preset: CustomTimerPreset): Promise<void> {
    await this.withState(
      async (state) => {
        state.presets = state.presets.filter((item) => item.id !== preset.id);
        state.presets.push(clone(preset));
      },
      () => this.fallback.savePreset(preset)
    );
  }

  async appendHistoryEvent(event: CustomTimerHistoryEvent): Promise<void> {
    await this.withState(
      async (state) => {
        state.history.push(clone(event));
      },
      () => this.fallback.appendHistoryEvent(event)
    );
  }

  async listHistory(): Promise<CustomTimerHistoryEvent[]> {
    const storage = getLocalStorage();

    if (!storage) {
      return this.fallback.listHistory();
    }

    return readState(storage, this.storageKey).history.map(clone);
  }

  private async listSessions(): Promise<CustomTimerSession[]> {
    const storage = getLocalStorage();

    if (!storage) {
      const [active, completed] = await Promise.all([
        this.fallback.listActiveSessions(),
        this.fallback.listCompletedSessions()
      ]);
      return [...active, ...completed];
    }

    return readState(storage, this.storageKey).sessions.map(clone);
  }

  private async withState(
    update: (state: BrowserCustomTimerState) => Promise<void> | void,
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

function readState(storage: Storage, key: string): BrowserCustomTimerState {
  const raw = storage.getItem(key);

  if (!raw) {
    return {
      sessions: [],
      presets: createDefaultTimerPresets(),
      history: []
    };
  }

  return JSON.parse(raw) as BrowserCustomTimerState;
}

function writeState(storage: Storage, key: string, state: BrowserCustomTimerState): void {
  storage.setItem(key, JSON.stringify(state));
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function compareCompletedSessions(a: CustomTimerSession, b: CustomTimerSession): number {
  const aTime = a.completedAtUtc ?? a.endsAtUtc;
  const bTime = b.completedAtUtc ?? b.endsAtUtc;
  return bTime.localeCompare(aTime);
}
