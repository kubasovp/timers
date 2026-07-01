import { appError } from "@/kernel/errors/app-error";
import { err, ok, type Result } from "@/shared/result/result";
import type { Clock } from "@/shared/time/clock";
import { type IdGenerator, DefaultIdGenerator } from "@/shared/id/create-id";
import {
  completeCustomTimer,
  getRemainingSeconds,
  pauseCustomTimer,
  restartCustomTimer,
  resumeCustomTimer,
  startCustomTimerSession,
  stopCustomTimer
} from "../domain/custom-timer-state-machine";
import type {
  CustomTimerHistoryEvent,
  CustomTimerInput,
  CustomTimerPreset,
  CustomTimerSession
} from "../domain/custom-timer-types";
import type { CustomTimerRepository } from "../ports";

export const CUSTOM_TIMER_COMMANDS = {
  START: "customTimer.start",
  PAUSE: "customTimer.pause",
  RESUME: "customTimer.resume",
  STOP: "customTimer.stop",
  RESTART: "customTimer.restart",
  COMPLETE: "customTimer.complete"
} as const;

export const CUSTOM_TIMER_QUERIES = {
  LIST_ACTIVE: "customTimer.listActive",
  LIST_PRESETS: "customTimer.listPresets"
} as const;

export interface StartCustomTimerPayload {
  title?: string;
  hours?: number;
  minutes?: number;
  seconds?: number;
  durationTotalSec?: number;
  presetId?: string;
}

export interface TimerIdPayload {
  id: string;
}

export interface CustomTimerView {
  id: string;
  title: string;
  status: CustomTimerSession["status"];
  durationTotalSec: number;
  remainingSeconds: number;
  endsAtUtc: string;
  startedAtUtc: string;
}

export interface CustomTimerUseCases {
  start(payload: StartCustomTimerPayload): Promise<Result<CustomTimerView>>;
  pause(payload: TimerIdPayload): Promise<Result<CustomTimerView>>;
  resume(payload: TimerIdPayload): Promise<Result<CustomTimerView>>;
  stop(payload: TimerIdPayload): Promise<Result<CustomTimerView>>;
  restart(payload: TimerIdPayload): Promise<Result<CustomTimerView>>;
  complete(payload: TimerIdPayload): Promise<Result<CustomTimerView>>;
  listActive(): Promise<Result<CustomTimerView[]>>;
  listPresets(): Promise<Result<CustomTimerPreset[]>>;
}

export function createCustomTimerUseCases(dependencies: {
  repository: CustomTimerRepository;
  clock: Clock;
  idGenerator?: IdGenerator;
}): CustomTimerUseCases {
  const ids = dependencies.idGenerator ?? new DefaultIdGenerator();

  return {
    async start(payload) {
      const now = dependencies.clock.now();
      const duration = resolveDuration(payload);

      if (!duration.ok) {
        return duration;
      }

      const input = resolveInput(payload, duration.value);
      const started = startCustomTimerSession({
        id: ids.nextId(),
        now,
        durationTotalSec: duration.value,
        input,
        title: payload.title,
        timerPresetId: payload.presetId
      });

      if (!started.ok) {
        return started;
      }

      await dependencies.repository.saveSession(started.value);
      await dependencies.repository.appendHistoryEvent(
        historyEvent(ids, started.value, "timer_started", now)
      );

      return ok(toCustomTimerView(started.value, now));
    },

    async pause(payload) {
      return mutateExistingTimer(dependencies, ids, payload.id, "timer_paused", pauseCustomTimer);
    },

    async resume(payload) {
      return mutateExistingTimer(dependencies, ids, payload.id, "timer_resumed", resumeCustomTimer);
    },

    async stop(payload) {
      return mutateExistingTimer(dependencies, ids, payload.id, "timer_stopped", stopCustomTimer);
    },

    async restart(payload) {
      return mutateExistingTimer(
        dependencies,
        ids,
        payload.id,
        "timer_restarted",
        restartCustomTimer
      );
    },

    async complete(payload) {
      return mutateExistingTimer(
        dependencies,
        ids,
        payload.id,
        "timer_completed",
        completeCustomTimer
      );
    },

    async listActive() {
      const now = dependencies.clock.now();
      const sessions = await dependencies.repository.listActiveSessions();
      return ok(sessions.map((session) => toCustomTimerView(session, now)));
    },

    async listPresets() {
      return ok(await dependencies.repository.listPresets());
    }
  };
}

export function toCustomTimerView(session: CustomTimerSession, now: string): CustomTimerView {
  return {
    id: session.id,
    title: session.title ?? "Timer",
    status: session.status,
    durationTotalSec: session.durationTotalSec,
    remainingSeconds: getRemainingSeconds(session, now),
    endsAtUtc: session.endsAtUtc,
    startedAtUtc: session.startedAtUtc
  };
}

async function mutateExistingTimer(
  dependencies: { repository: CustomTimerRepository; clock: Clock },
  ids: IdGenerator,
  id: string,
  eventType: string,
  transition: (session: CustomTimerSession, now: string) => Result<CustomTimerSession>
): Promise<Result<CustomTimerView>> {
  const now = dependencies.clock.now();
  const session = await dependencies.repository.getSession(id);

  if (!session) {
    return err(
      appError({
        code: "customTimer.not_found",
        message: "Timer session was not found.",
        category: "not_found",
        details: { id }
      })
    );
  }

  const updated = transition(session, now);

  if (!updated.ok) {
    return updated;
  }

  await dependencies.repository.saveSession(updated.value);
  await dependencies.repository.appendHistoryEvent(
    historyEvent(ids, updated.value, eventType, now)
  );

  return ok(toCustomTimerView(updated.value, now));
}

function resolveDuration(payload: StartCustomTimerPayload): Result<number> {
  if (payload.durationTotalSec !== undefined) {
    return payload.durationTotalSec > 0
      ? ok(Math.floor(payload.durationTotalSec))
      : err(
          appError({
            code: "customTimer.invalid_duration",
            message: "Timer duration must be greater than zero.",
            category: "validation"
          })
        );
  }

  const hours = positivePart(payload.hours);
  const minutes = positivePart(payload.minutes);
  const seconds = positivePart(payload.seconds);
  const duration = hours * 3600 + minutes * 60 + seconds;

  return duration > 0
    ? ok(duration)
    : err(
        appError({
          code: "customTimer.invalid_duration",
          message: "Timer duration must be greater than zero.",
          category: "validation"
        })
      );
}

function resolveInput(payload: StartCustomTimerPayload, duration: number): CustomTimerInput {
  if (
    payload.hours !== undefined ||
    payload.minutes !== undefined ||
    payload.seconds !== undefined
  ) {
    return {
      hours: positivePart(payload.hours),
      minutes: positivePart(payload.minutes),
      seconds: positivePart(payload.seconds)
    };
  }

  return {
    hours: Math.floor(duration / 3600),
    minutes: Math.floor((duration % 3600) / 60),
    seconds: duration % 60
  };
}

function positivePart(value: number | undefined): number {
  if (!value || value < 0) {
    return 0;
  }

  return Math.floor(value);
}

function historyEvent(
  ids: IdGenerator,
  session: CustomTimerSession,
  eventType: string,
  now: string
): CustomTimerHistoryEvent {
  return {
    id: ids.nextId(),
    sessionId: session.id,
    eventType,
    eventPayload: {
      status: session.status,
      durationTotalSec: session.durationTotalSec
    },
    occurredAtUtc: now
  };
}
