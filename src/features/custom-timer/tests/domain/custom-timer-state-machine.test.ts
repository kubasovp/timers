import { describe, expect, it } from "vitest";
import {
  completeCustomTimer,
  pauseCustomTimer,
  restartCustomTimer,
  resumeCustomTimer,
  startCustomTimerSession,
  stopCustomTimer
} from "../../domain/custom-timer-state-machine";

describe("custom timer state machine", () => {
  it("supports start, pause, resume, restart, stop and natural completion", () => {
    const started = startCustomTimerSession({
      id: "timer-1",
      now: "2026-07-01T10:00:00.000Z",
      durationTotalSec: 90,
      input: { hours: 0, minutes: 1, seconds: 30 }
    });

    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect(started.value.status).toBe("running");

    const paused = pauseCustomTimer(started.value, "2026-07-01T10:00:30.000Z");
    expect(paused.ok && paused.value.status).toBe("paused");
    if (!paused.ok) return;
    expect(paused.value.remainingSecAtPause).toBe(60);

    const resumed = resumeCustomTimer(paused.value, "2026-07-01T10:01:00.000Z");
    expect(resumed.ok && resumed.value.endsAtUtc).toBe("2026-07-01T10:02:00.000Z");
    if (!resumed.ok) return;

    const restarted = restartCustomTimer(resumed.value, "2026-07-01T10:01:10.000Z");
    expect(restarted.ok && restarted.value.endsAtUtc).toBe("2026-07-01T10:02:40.000Z");
    if (!restarted.ok) return;

    const stopped = stopCustomTimer(restarted.value, "2026-07-01T10:01:20.000Z");
    expect(stopped.ok && stopped.value.status).toBe("stopped");

    const completed = completeCustomTimer(started.value, "2026-07-01T10:01:30.000Z");
    expect(completed.ok && completed.value.status).toBe("completed");
  });

  it("returns a domain error for invalid transitions", () => {
    const started = startCustomTimerSession({
      id: "timer-1",
      now: "2026-07-01T10:00:00.000Z",
      durationTotalSec: 60,
      input: { hours: 0, minutes: 1, seconds: 0 }
    });

    if (!started.ok) {
      throw new Error("setup failed");
    }

    const stopped = stopCustomTimer(started.value, "2026-07-01T10:00:05.000Z");
    if (!stopped.ok) {
      throw new Error("setup failed");
    }

    const paused = pauseCustomTimer(stopped.value, "2026-07-01T10:00:10.000Z");

    expect(paused.ok).toBe(false);
    if (paused.ok) return;
    expect(paused.error.code).toBe("customTimer.invalid_transition");
  });
});
