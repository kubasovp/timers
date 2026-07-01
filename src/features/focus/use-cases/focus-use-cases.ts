import { appError } from "@/kernel/errors/app-error";
import { DefaultIdGenerator, type IdGenerator } from "@/shared/id/create-id";
import { err, ok, type Result } from "@/shared/result/result";
import type { Clock } from "@/shared/time/clock";
import {
  getFocusPhaseRemainingSeconds,
  pauseFocusSession,
  resumeFocusSession,
  skipFocusPhase,
  startFocusSession,
  stopFocusSession
} from "../domain/focus-state-machine";
import type {
  FocusHistoryEvent,
  FocusPhase,
  FocusProfile,
  FocusSession
} from "../domain/focus-types";
import type { FocusRepository } from "../ports";

export const FOCUS_COMMANDS = {
  CREATE_PROFILE: "focus.profile.create",
  UPDATE_PROFILE: "focus.profile.update",
  DELETE_PROFILE: "focus.profile.delete",
  START_SESSION: "focus.session.start",
  PAUSE_SESSION: "focus.session.pause",
  RESUME_SESSION: "focus.session.resume",
  STOP_SESSION: "focus.session.stop",
  SKIP_PHASE: "focus.session.skipPhase"
} as const;

export const FOCUS_QUERIES = {
  LIST_PROFILES: "focus.profile.list",
  GET_ACTIVE_SESSION: "focus.session.getActive"
} as const;

export interface FocusProfilePayload {
  name: string;
  focusDurationSec: number;
  shortBreakSec: number;
  longBreakSec: number;
  cyclesBeforeLongBreak: number;
}

export interface UpdateFocusProfilePayload extends FocusProfilePayload {
  id: string;
}

export interface FocusProfileIdPayload {
  id: string;
}

export interface StartFocusSessionPayload {
  profileId: string;
}

export interface FocusSessionIdPayload {
  id: string;
}

export interface FocusSessionView {
  id: string;
  title: string;
  profileId: string;
  status: FocusSession["status"];
  currentPhase: FocusPhase;
  cycleIndex: number;
  totalCycles: number;
  completedCycles: number;
  phaseDurationSec: number;
  remainingSeconds: number;
  phaseStartedAtUtc: string;
  phaseEndsAtUtc: string;
  startedAtUtc: string;
}

export interface FocusUseCases {
  createProfile(payload: FocusProfilePayload): Promise<Result<FocusProfile>>;
  updateProfile(payload: UpdateFocusProfilePayload): Promise<Result<FocusProfile>>;
  deleteProfile(payload: FocusProfileIdPayload): Promise<Result<{ id: string }>>;
  startSession(payload: StartFocusSessionPayload): Promise<Result<FocusSessionView>>;
  pauseSession(payload: FocusSessionIdPayload): Promise<Result<FocusSessionView>>;
  resumeSession(payload: FocusSessionIdPayload): Promise<Result<FocusSessionView>>;
  stopSession(payload: FocusSessionIdPayload): Promise<Result<FocusSessionView>>;
  skipPhase(payload: FocusSessionIdPayload): Promise<Result<FocusSessionView>>;
  listProfiles(): Promise<Result<FocusProfile[]>>;
  getActiveSession(): Promise<Result<FocusSessionView | null>>;
}

export function createFocusUseCases(dependencies: {
  repository: FocusRepository;
  clock: Clock;
  idGenerator?: IdGenerator;
}): FocusUseCases {
  const ids = dependencies.idGenerator ?? new DefaultIdGenerator();

  return {
    async createProfile(payload) {
      const now = dependencies.clock.now();
      const profile = createProfileFromPayload(ids.nextId(), payload, now, now);

      if (!profile.ok) {
        return profile;
      }

      const unique = await ensureUniqueProfileName(dependencies.repository, profile.value.name);

      if (!unique.ok) {
        return unique;
      }

      await dependencies.repository.saveProfile(profile.value);
      await dependencies.repository.appendHistoryEvent(
        historyEvent(ids, "profile", profile.value.id, "focus_profile_created", now, {
          name: profile.value.name
        })
      );

      return ok(profile.value);
    },

    async updateProfile(payload) {
      const existing = await dependencies.repository.getProfile(payload.id);

      if (!existing) {
        return profileNotFound(payload.id);
      }

      if (await dependencies.repository.hasActiveSessionForProfile(payload.id)) {
        return err(
          appError({
            code: "focus.profile_in_use",
            message: "Cannot update a focus profile while it has an active session.",
            category: "conflict",
            details: { id: payload.id }
          })
        );
      }

      const now = dependencies.clock.now();
      const profile = createProfileFromPayload(payload.id, payload, existing.createdAtUtc, now);

      if (!profile.ok) {
        return profile;
      }

      const unique = await ensureUniqueProfileName(
        dependencies.repository,
        profile.value.name,
        payload.id
      );

      if (!unique.ok) {
        return unique;
      }

      await dependencies.repository.saveProfile(profile.value);
      await dependencies.repository.appendHistoryEvent(
        historyEvent(ids, "profile", profile.value.id, "focus_profile_updated", now, {
          name: profile.value.name
        })
      );

      return ok(profile.value);
    },

    async deleteProfile(payload) {
      const existing = await dependencies.repository.getProfile(payload.id);

      if (!existing) {
        return profileNotFound(payload.id);
      }

      if (await dependencies.repository.hasActiveSessionForProfile(payload.id)) {
        return err(
          appError({
            code: "focus.profile_in_use",
            message: "Cannot delete a focus profile while it has an active session.",
            category: "conflict",
            details: { id: payload.id }
          })
        );
      }

      const now = dependencies.clock.now();
      await dependencies.repository.deleteProfile(payload.id);
      await dependencies.repository.appendHistoryEvent(
        historyEvent(ids, "profile", payload.id, "focus_profile_deleted", now, {
          name: existing.name
        })
      );

      return ok({ id: payload.id });
    },

    async startSession(payload) {
      const profile = await dependencies.repository.getProfile(payload.profileId);

      if (!profile) {
        return profileNotFound(payload.profileId);
      }

      const active = await dependencies.repository.getActiveSession();

      if (active) {
        return err(
          appError({
            code: "focus.session_already_active",
            message: "Only one focus session can be active at a time.",
            category: "conflict",
            details: { activeSessionId: active.id }
          })
        );
      }

      const now = dependencies.clock.now();
      const started = startFocusSession({
        id: ids.nextId(),
        now,
        profile
      });

      if (!started.ok) {
        return started;
      }

      await dependencies.repository.saveSession(started.value);
      await dependencies.repository.appendHistoryEvent(
        historyEvent(ids, "timer_session", started.value.id, "focus_session_started", now, {
          profileId: profile.id,
          phase: started.value.currentPhase
        })
      );

      return ok(toFocusSessionView(started.value, now));
    },

    async pauseSession(payload) {
      return mutateExistingSession(dependencies, ids, payload.id, "focus_session_paused", pauseFocusSession);
    },

    async resumeSession(payload) {
      return mutateExistingSession(
        dependencies,
        ids,
        payload.id,
        "focus_session_resumed",
        resumeFocusSession
      );
    },

    async stopSession(payload) {
      return mutateExistingSession(dependencies, ids, payload.id, "focus_session_stopped", stopFocusSession);
    },

    async skipPhase(payload) {
      const now = dependencies.clock.now();
      const session = await dependencies.repository.getSession(payload.id);

      if (!session) {
        return sessionNotFound(payload.id);
      }

      const profile = await dependencies.repository.getProfile(session.profileId);

      if (!profile) {
        return profileNotFound(session.profileId);
      }

      const updated = skipFocusPhase(session, profile, now);

      if (!updated.ok) {
        return updated;
      }

      await dependencies.repository.saveSession(updated.value);
      await dependencies.repository.appendHistoryEvent(
        historyEvent(ids, "timer_session", updated.value.id, "focus_phase_skipped", now, {
          fromPhase: session.currentPhase,
          toPhase: updated.value.currentPhase,
          status: updated.value.status,
          cycleIndex: updated.value.cycleIndex,
          completedCycles: updated.value.completedCycles
        })
      );

      return ok(toFocusSessionView(updated.value, now));
    },

    async listProfiles() {
      return ok(await dependencies.repository.listProfiles());
    },

    async getActiveSession() {
      const now = dependencies.clock.now();
      const session = await dependencies.repository.getActiveSession();
      return ok(session ? toFocusSessionView(session, now) : null);
    }
  };
}

export function toFocusSessionView(session: FocusSession, now: string): FocusSessionView {
  return {
    id: session.id,
    title: session.title,
    profileId: session.profileId,
    status: session.status,
    currentPhase: session.currentPhase,
    cycleIndex: session.cycleIndex,
    totalCycles: session.totalCycles,
    completedCycles: session.completedCycles,
    phaseDurationSec: session.phaseDurationSec,
    remainingSeconds: getFocusPhaseRemainingSeconds(session, now),
    phaseStartedAtUtc: session.phaseStartedAtUtc,
    phaseEndsAtUtc: session.phaseEndsAtUtc,
    startedAtUtc: session.startedAtUtc
  };
}

async function mutateExistingSession(
  dependencies: { repository: FocusRepository; clock: Clock },
  ids: IdGenerator,
  id: string,
  eventType: string,
  transition: (session: FocusSession, now: string) => Result<FocusSession>
): Promise<Result<FocusSessionView>> {
  const now = dependencies.clock.now();
  const session = await dependencies.repository.getSession(id);

  if (!session) {
    return sessionNotFound(id);
  }

  const updated = transition(session, now);

  if (!updated.ok) {
    return updated;
  }

  await dependencies.repository.saveSession(updated.value);
  await dependencies.repository.appendHistoryEvent(
    historyEvent(ids, "timer_session", updated.value.id, eventType, now, {
      status: updated.value.status,
      phase: updated.value.currentPhase,
      cycleIndex: updated.value.cycleIndex
    })
  );

  return ok(toFocusSessionView(updated.value, now));
}

function createProfileFromPayload(
  id: string,
  payload: FocusProfilePayload,
  createdAtUtc: string,
  updatedAtUtc: string
): Result<FocusProfile> {
  const name = normalizeName(payload.name);

  if (!name) {
    return err(
      appError({
        code: "focus.invalid_profile_name",
        message: "Focus profile name is required.",
        category: "validation"
      })
    );
  }

  const profile = {
    id,
    name,
    focusDurationSec: positiveInteger(payload.focusDurationSec),
    shortBreakSec: positiveInteger(payload.shortBreakSec),
    longBreakSec: positiveInteger(payload.longBreakSec),
    cyclesBeforeLongBreak: positiveInteger(payload.cyclesBeforeLongBreak),
    createdAtUtc,
    updatedAtUtc
  };

  if (
    profile.focusDurationSec <= 0 ||
    profile.shortBreakSec <= 0 ||
    profile.longBreakSec <= 0 ||
    profile.cyclesBeforeLongBreak <= 0
  ) {
    return err(
      appError({
        code: "focus.invalid_profile",
        message: "Focus profile durations and cycles must be greater than zero.",
        category: "validation"
      })
    );
  }

  return ok(profile);
}

async function ensureUniqueProfileName(
  repository: FocusRepository,
  name: string,
  exceptId?: string
): Promise<Result<void>> {
  const existing = await repository.listProfiles();
  const normalized = name.toLocaleLowerCase();
  const conflict = existing.find(
    (profile) => profile.id !== exceptId && profile.name.toLocaleLowerCase() === normalized
  );

  if (!conflict) {
    return ok(undefined);
  }

  return err(
    appError({
      code: "focus.profile_name_conflict",
      message: "A focus profile with this name already exists.",
      category: "conflict",
      details: { name }
    })
  );
}

function profileNotFound(id: string): Result<never> {
  return err(
    appError({
      code: "focus.profile_not_found",
      message: "Focus profile was not found.",
      category: "not_found",
      details: { id }
    })
  );
}

function sessionNotFound(id: string): Result<never> {
  return err(
    appError({
      code: "focus.session_not_found",
      message: "Focus session was not found.",
      category: "not_found",
      details: { id }
    })
  );
}

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

function positiveInteger(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function historyEvent(
  ids: IdGenerator,
  aggregateType: FocusHistoryEvent["aggregateType"],
  aggregateId: string,
  eventType: string,
  now: string,
  eventPayload: Record<string, unknown>
): FocusHistoryEvent {
  return {
    id: ids.nextId(),
    aggregateType,
    aggregateId,
    eventType,
    eventPayload,
    occurredAtUtc: now
  };
}
