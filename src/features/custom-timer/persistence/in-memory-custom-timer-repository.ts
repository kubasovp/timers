import { isDue, type Instant } from "@/shared/time/instant";
import type {
  CustomTimerHistoryEvent,
  CustomTimerPreset,
  CustomTimerSession
} from "../domain/custom-timer-types";
import type { CustomTimerRepository } from "../ports";
import { createDefaultTimerPresets } from "./default-presets";

export class InMemoryCustomTimerRepository implements CustomTimerRepository {
  private readonly sessions = new Map<string, CustomTimerSession>();
  private readonly presets = new Map<string, CustomTimerPreset>();
  private readonly history: CustomTimerHistoryEvent[] = [];

  constructor(presets: CustomTimerPreset[] = createDefaultTimerPresets()) {
    for (const preset of presets) {
      this.presets.set(preset.id, clone(preset));
    }
  }

  async saveSession(session: CustomTimerSession): Promise<void> {
    this.sessions.set(session.id, clone(session));
  }

  async getSession(id: string): Promise<CustomTimerSession | null> {
    const session = this.sessions.get(id);
    return session ? clone(session) : null;
  }

  async listActiveSessions(): Promise<CustomTimerSession[]> {
    return Array.from(this.sessions.values())
      .filter((session) => session.status === "running" || session.status === "paused")
      .map(clone);
  }

  async listDueRunningSessions(now: Instant): Promise<CustomTimerSession[]> {
    return Array.from(this.sessions.values())
      .filter((session) => session.status === "running" && isDue(session.endsAtUtc, now))
      .map(clone);
  }

  async listPresets(): Promise<CustomTimerPreset[]> {
    return Array.from(this.presets.values()).map(clone);
  }

  async savePreset(preset: CustomTimerPreset): Promise<void> {
    this.presets.set(preset.id, clone(preset));
  }

  async appendHistoryEvent(event: CustomTimerHistoryEvent): Promise<void> {
    this.history.push(clone(event));
  }

  async listHistory(): Promise<CustomTimerHistoryEvent[]> {
    return this.history.map(clone);
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
