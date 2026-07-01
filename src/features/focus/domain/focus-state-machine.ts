import { appError } from "@/kernel/errors/app-error";
import { err, ok, type Result } from "@/shared/result/result";
import { addSeconds, secondsUntil, type Instant } from "@/shared/time/instant";
import type {
  FocusPhase,
  FocusProfile,
  FocusSession,
  FocusSessionStatus
} from "./focus-types";

export interface StartFocusSessionInput {
  id: string;
  now: Instant;
  profile: FocusProfile;
}

export function startFocusSession(input: StartFocusSessionInput): Result<FocusSession> {
  const validProfile = validateProfileDurations(input.profile);

  if (!validProfile.ok) {
    return validProfile;
  }

  return ok({
    id: input.id,
    sessionType: "focus",
    status: "running_focus",
    title: input.profile.name,
    profileId: input.profile.id,
    startedAtUtc: input.now,
    currentPhase: "focus",
    cycleIndex: 1,
    totalCycles: input.profile.cyclesBeforeLongBreak,
    completedCycles: 0,
    phaseStartedAtUtc: input.now,
    phaseEndsAtUtc: addSeconds(input.now, input.profile.focusDurationSec),
    phaseDurationSec: input.profile.focusDurationSec,
    durationTotalSec: getPlannedSessionDuration(input.profile),
    version: 1
  });
}

export function pauseFocusSession(
  session: FocusSession,
  now: Instant
): Result<FocusSession> {
  const transition = ensureStatus(session, ["running_focus", "running_break"], "pause");

  if (!transition.ok) {
    return transition;
  }

  return ok({
    ...session,
    status: session.status === "running_focus" ? "paused_focus" : "paused_break",
    pausedAtUtc: now,
    remainingSecAtPause: getFocusPhaseRemainingSeconds(session, now),
    version: session.version + 1
  });
}

export function resumeFocusSession(
  session: FocusSession,
  now: Instant
): Result<FocusSession> {
  const transition = ensureStatus(session, ["paused_focus", "paused_break"], "resume");

  if (!transition.ok) {
    return transition;
  }

  const remainingSeconds = session.remainingSecAtPause ?? 0;
  const elapsedBeforePause = Math.max(0, session.phaseDurationSec - remainingSeconds);

  return ok({
    ...session,
    status: session.status === "paused_focus" ? "running_focus" : "running_break",
    pausedAtUtc: undefined,
    remainingSecAtPause: undefined,
    phaseStartedAtUtc: addSeconds(now, -elapsedBeforePause),
    phaseEndsAtUtc: addSeconds(now, remainingSeconds),
    version: session.version + 1
  });
}

export function stopFocusSession(
  session: FocusSession,
  now: Instant
): Result<FocusSession> {
  const transition = ensureStatus(
    session,
    ["running_focus", "running_break", "paused_focus", "paused_break"],
    "stop"
  );

  if (!transition.ok) {
    return transition;
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

export function skipFocusPhase(
  session: FocusSession,
  profile: FocusProfile,
  now: Instant
): Result<FocusSession> {
  const transition = ensureStatus(session, ["running_focus", "running_break"], "skip");

  if (!transition.ok) {
    return transition;
  }

  const validProfile = validateProfileDurations(profile);

  if (!validProfile.ok) {
    return validProfile;
  }

  if (session.status === "running_focus") {
    return ok(startBreakAfterFocus(session, profile, now, false));
  }

  return ok(startNextFocusOrComplete(session, profile, now));
}

export function advanceFocusPhase(
  session: FocusSession,
  profile: FocusProfile
): Result<FocusSession> {
  const transition = ensureStatus(session, ["running_focus", "running_break"], "phase_end");

  if (!transition.ok) {
    return transition;
  }

  const validProfile = validateProfileDurations(profile);

  if (!validProfile.ok) {
    return validProfile;
  }

  if (session.status === "running_focus") {
    return ok(startBreakAfterFocus(session, profile, session.phaseEndsAtUtc, true));
  }

  return ok(startNextFocusOrComplete(session, profile, session.phaseEndsAtUtc));
}

export function getFocusPhaseRemainingSeconds(session: FocusSession, now: Instant): number {
  if (session.status === "paused_focus" || session.status === "paused_break") {
    return session.remainingSecAtPause ?? 0;
  }

  if (session.status !== "running_focus" && session.status !== "running_break") {
    return 0;
  }

  return secondsUntil(session.phaseEndsAtUtc, now);
}

export function isActiveFocusSession(session: FocusSession): boolean {
  return (
    session.status === "running_focus" ||
    session.status === "running_break" ||
    session.status === "paused_focus" ||
    session.status === "paused_break"
  );
}

export function isRunningFocusSession(session: FocusSession): boolean {
  return session.status === "running_focus" || session.status === "running_break";
}

export function getPlannedSessionDuration(profile: FocusProfile): number {
  const totalCycles = Math.max(1, Math.floor(profile.cyclesBeforeLongBreak));
  return (
    totalCycles * profile.focusDurationSec +
    Math.max(0, totalCycles - 1) * profile.shortBreakSec +
    profile.longBreakSec
  );
}

function startBreakAfterFocus(
  session: FocusSession,
  profile: FocusProfile,
  phaseStartedAtUtc: Instant,
  countAsCompleted: boolean
): FocusSession {
  const completedCycles = countAsCompleted
    ? Math.min(session.totalCycles, session.completedCycles + 1)
    : session.completedCycles;
  const currentPhase: FocusPhase =
    session.cycleIndex >= session.totalCycles ? "long_break" : "short_break";
  const phaseDurationSec = getPhaseDuration(profile, currentPhase);

  return {
    ...session,
    status: "running_break",
    currentPhase,
    completedCycles,
    phaseStartedAtUtc,
    phaseEndsAtUtc: addSeconds(phaseStartedAtUtc, phaseDurationSec),
    phaseDurationSec,
    version: session.version + 1
  };
}

function startNextFocusOrComplete(
  session: FocusSession,
  profile: FocusProfile,
  phaseStartedAtUtc: Instant
): FocusSession {
  if (session.currentPhase === "long_break" || session.completedCycles >= session.totalCycles) {
    return {
      ...session,
      status: "completed",
      completedAtUtc: phaseStartedAtUtc,
      version: session.version + 1
    };
  }

  const phaseDurationSec = getPhaseDuration(profile, "focus");

  return {
    ...session,
    status: "running_focus",
    currentPhase: "focus",
    cycleIndex: Math.min(session.totalCycles, session.cycleIndex + 1),
    phaseStartedAtUtc,
    phaseEndsAtUtc: addSeconds(phaseStartedAtUtc, phaseDurationSec),
    phaseDurationSec,
    completedAtUtc: undefined,
    version: session.version + 1
  };
}

function getPhaseDuration(profile: FocusProfile, phase: FocusPhase): number {
  if (phase === "focus") {
    return profile.focusDurationSec;
  }

  if (phase === "short_break") {
    return profile.shortBreakSec;
  }

  return profile.longBreakSec;
}

function ensureStatus(
  session: FocusSession,
  allowed: FocusSessionStatus[],
  command: string
): Result<FocusSession> {
  if (allowed.includes(session.status)) {
    return ok(session);
  }

  return err(
    appError({
      code: "focus.invalid_transition",
      message: `Cannot ${command} focus session from ${session.status}.`,
      category: "domain",
      details: {
        command,
        currentStatus: session.status,
        allowed
      }
    })
  );
}

function validateProfileDurations(profile: FocusProfile): Result<FocusProfile> {
  const invalid =
    !isPositiveInteger(profile.focusDurationSec) ||
    !isPositiveInteger(profile.shortBreakSec) ||
    !isPositiveInteger(profile.longBreakSec) ||
    !isPositiveInteger(profile.cyclesBeforeLongBreak);

  if (!invalid) {
    return ok(profile);
  }

  return err(
    appError({
      code: "focus.invalid_profile",
      message: "Focus profile durations and cycles must be greater than zero.",
      category: "validation"
    })
  );
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}
