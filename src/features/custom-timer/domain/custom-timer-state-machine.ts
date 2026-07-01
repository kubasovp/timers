import { appError } from "@/kernel/errors/app-error";
import { err, ok, type Result } from "@/shared/result/result";
import { addSeconds, secondsUntil, type Instant } from "@/shared/time/instant";
import type {
  CustomTimerInput,
  CustomTimerSession,
  CustomTimerSessionStatus
} from "./custom-timer-types";

export interface StartCustomTimerSessionInput {
  id: string;
  now: Instant;
  durationTotalSec: number;
  input: CustomTimerInput;
  title?: string;
  timerPresetId?: string;
}

export function startCustomTimerSession(
  input: StartCustomTimerSessionInput
): Result<CustomTimerSession> {
  if (!Number.isInteger(input.durationTotalSec) || input.durationTotalSec <= 0) {
    return err(
      appError({
        code: "customTimer.invalid_duration",
        message: "Timer duration must be greater than zero.",
        category: "validation"
      })
    );
  }

  return ok({
    id: input.id,
    sessionType: "custom_timer",
    status: "running",
    title: normalizeTitle(input.title),
    startedAtUtc: input.now,
    endsAtUtc: addSeconds(input.now, input.durationTotalSec),
    durationTotalSec: input.durationTotalSec,
    input: input.input,
    timerPresetId: input.timerPresetId,
    version: 1
  });
}

export function pauseCustomTimer(
  session: CustomTimerSession,
  now: Instant
): Result<CustomTimerSession> {
  const transition = ensureStatus(session, ["running"], "pause");

  if (!transition.ok) {
    return transition;
  }

  return ok({
    ...session,
    status: "paused",
    pausedAtUtc: now,
    remainingSecAtPause: getRemainingSeconds(session, now),
    version: session.version + 1
  });
}

export function resumeCustomTimer(
  session: CustomTimerSession,
  now: Instant
): Result<CustomTimerSession> {
  const transition = ensureStatus(session, ["paused"], "resume");

  if (!transition.ok) {
    return transition;
  }

  const remainingSeconds = session.remainingSecAtPause ?? 0;

  return ok({
    ...session,
    status: "running",
    pausedAtUtc: undefined,
    remainingSecAtPause: undefined,
    endsAtUtc: addSeconds(now, remainingSeconds),
    version: session.version + 1
  });
}

export function stopCustomTimer(
  session: CustomTimerSession,
  now: Instant
): Result<CustomTimerSession> {
  const transition = ensureStatus(session, ["running", "paused"], "stop");

  if (!transition.ok) {
    return transition;
  }

  if (session.completedAtUtc) {
    return ok({
      ...session,
      status: "completed",
      stoppedAtUtc: undefined,
      pausedAtUtc: undefined,
      remainingSecAtPause: undefined,
      version: session.version + 1
    });
  }

  return ok({
    ...session,
    status: "stopped",
    stoppedAtUtc: now,
    pausedAtUtc: undefined,
    remainingSecAtPause: undefined,
    version: session.version + 1
  });
}

export function restartCustomTimer(
  session: CustomTimerSession,
  now: Instant
): Result<CustomTimerSession> {
  const transition = ensureStatus(session, ["running", "paused", "completed"], "restart");

  if (!transition.ok) {
    return transition;
  }

  return ok({
    ...session,
    status: "running",
    startedAtUtc: now,
    endsAtUtc: addSeconds(now, session.durationTotalSec),
    pausedAtUtc: undefined,
    remainingSecAtPause: undefined,
    stoppedAtUtc: undefined,
    version: session.version + 1
  });
}

export function completeCustomTimer(
  session: CustomTimerSession,
  now: Instant
): Result<CustomTimerSession> {
  const transition = ensureStatus(session, ["running"], "timer_end");

  if (!transition.ok) {
    return transition;
  }

  return ok({
    ...session,
    status: "completed",
    completedAtUtc: now,
    version: session.version + 1
  });
}

export function getRemainingSeconds(session: CustomTimerSession, now: Instant): number {
  if (session.status === "paused") {
    return session.remainingSecAtPause ?? 0;
  }

  if (session.status !== "running") {
    return 0;
  }

  return secondsUntil(session.endsAtUtc, now);
}

function ensureStatus(
  session: CustomTimerSession,
  allowed: CustomTimerSessionStatus[],
  command: string
): Result<CustomTimerSession> {
  if (allowed.includes(session.status)) {
    return ok(session);
  }

  return err(
    appError({
      code: "customTimer.invalid_transition",
      message: `Cannot ${command} timer from ${session.status}.`,
      category: "domain",
      details: {
        command,
        currentStatus: session.status,
        allowed
      }
    })
  );
}

function normalizeTitle(title: string | undefined): string | undefined {
  const normalized = title?.trim();
  return normalized ? normalized : undefined;
}
