import { describe, expect, it } from "vitest";
import {
  advanceFocusPhase,
  pauseFocusSession,
  resumeFocusSession,
  skipFocusPhase,
  startFocusSession
} from "../../domain/focus-state-machine";
import type { FocusProfile } from "../../domain/focus-types";

const profile: FocusProfile = {
  id: "profile-1",
  name: "Short profile",
  focusDurationSec: 60,
  shortBreakSec: 30,
  longBreakSec: 90,
  cyclesBeforeLongBreak: 2,
  createdAtUtc: "2026-07-01T10:00:00.000Z",
  updatedAtUtc: "2026-07-01T10:00:00.000Z"
};

describe("focus state machine", () => {
  it("advances focus, short break, focus, long break and completion", () => {
    const started = startFocusSession({
      id: "focus-1",
      now: "2026-07-01T10:00:00.000Z",
      profile
    });

    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect(started.value.status).toBe("running_focus");
    expect(started.value.phaseEndsAtUtc).toBe("2026-07-01T10:01:00.000Z");

    const shortBreak = advanceFocusPhase(started.value, profile);
    expect(shortBreak.ok && shortBreak.value.status).toBe("running_break");
    if (!shortBreak.ok) return;
    expect(shortBreak.value.currentPhase).toBe("short_break");
    expect(shortBreak.value.completedCycles).toBe(1);
    expect(shortBreak.value.phaseStartedAtUtc).toBe("2026-07-01T10:01:00.000Z");

    const secondFocus = advanceFocusPhase(shortBreak.value, profile);
    expect(secondFocus.ok && secondFocus.value.status).toBe("running_focus");
    if (!secondFocus.ok) return;
    expect(secondFocus.value.cycleIndex).toBe(2);

    const longBreak = advanceFocusPhase(secondFocus.value, profile);
    expect(longBreak.ok && longBreak.value.currentPhase).toBe("long_break");
    if (!longBreak.ok) return;
    expect(longBreak.value.completedCycles).toBe(2);

    const completed = advanceFocusPhase(longBreak.value, profile);
    expect(completed.ok && completed.value.status).toBe("completed");
    expect(completed.ok && completed.value.completedAtUtc).toBe("2026-07-01T10:04:00.000Z");
  });

  it("pauses and resumes without counting paused time", () => {
    const started = startFocusSession({
      id: "focus-1",
      now: "2026-07-01T10:00:00.000Z",
      profile
    });

    if (!started.ok) {
      throw new Error("setup failed");
    }

    const paused = pauseFocusSession(started.value, "2026-07-01T10:00:15.000Z");
    expect(paused.ok && paused.value.status).toBe("paused_focus");
    expect(paused.ok && paused.value.remainingSecAtPause).toBe(45);
    if (!paused.ok) return;

    const resumed = resumeFocusSession(paused.value, "2026-07-01T10:10:00.000Z");
    expect(resumed.ok && resumed.value.status).toBe("running_focus");
    expect(resumed.ok && resumed.value.phaseEndsAtUtc).toBe("2026-07-01T10:10:45.000Z");
  });

  it("skips the current focus phase without counting it as completed", () => {
    const started = startFocusSession({
      id: "focus-1",
      now: "2026-07-01T10:00:00.000Z",
      profile
    });

    if (!started.ok) {
      throw new Error("setup failed");
    }

    const skipped = skipFocusPhase(started.value, profile, "2026-07-01T10:00:10.000Z");

    expect(skipped.ok && skipped.value.status).toBe("running_break");
    expect(skipped.ok && skipped.value.currentPhase).toBe("short_break");
    expect(skipped.ok && skipped.value.completedCycles).toBe(0);
    expect(skipped.ok && skipped.value.completedAtUtc).toBeUndefined();
    expect(skipped.ok && skipped.value.phaseStartedAtUtc).toBe("2026-07-01T10:00:10.000Z");
  });

  it("skips breaks to the next focus phase or completion", () => {
    const started = startFocusSession({
      id: "focus-1",
      now: "2026-07-01T10:00:00.000Z",
      profile
    });

    if (!started.ok) {
      throw new Error("setup failed");
    }

    const shortBreak = advanceFocusPhase(started.value, profile);
    if (!shortBreak.ok) {
      throw new Error("setup failed");
    }

    const nextFocus = skipFocusPhase(shortBreak.value, profile, "2026-07-01T10:01:10.000Z");
    expect(nextFocus.ok && nextFocus.value.status).toBe("running_focus");
    expect(nextFocus.ok && nextFocus.value.cycleIndex).toBe(2);

    if (!nextFocus.ok) {
      throw new Error("setup failed");
    }

    const longBreak = advanceFocusPhase(nextFocus.value, profile);
    if (!longBreak.ok) {
      throw new Error("setup failed");
    }

    const completed = skipFocusPhase(longBreak.value, profile, "2026-07-01T10:02:30.000Z");
    expect(completed.ok && completed.value.status).toBe("completed");
    expect(completed.ok && completed.value.completedAtUtc).toBe("2026-07-01T10:02:30.000Z");
  });
});
