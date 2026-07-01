import { describe, expect, it } from "vitest";
import { FakeClock } from "@/platform/clock/fake-clock";
import { InMemoryFocusRepository } from "../../persistence/in-memory-focus-repository";
import { createFocusUseCases } from "../../use-cases/focus-use-cases";

describe("focus use cases", () => {
  it("supports profile CRUD and enforces one active session", async () => {
    const clock = new FakeClock("2026-07-01T10:00:00.000Z");
    const repository = new InMemoryFocusRepository([]);
    let idCounter = 0;
    const useCases = createFocusUseCases({
      clock,
      repository,
      idGenerator: {
        nextId: () => `id-${++idCounter}`
      }
    });

    const created = await useCases.createProfile({
      name: "Deep Work",
      focusDurationSec: 60,
      shortBreakSec: 30,
      longBreakSec: 45,
      cyclesBeforeLongBreak: 2
    });
    expect(created.ok && created.value.name).toBe("Deep Work");
    if (!created.ok) return;

    const duplicate = await useCases.createProfile({
      name: "Deep Work",
      focusDurationSec: 60,
      shortBreakSec: 30,
      longBreakSec: 45,
      cyclesBeforeLongBreak: 2
    });
    expect(duplicate.ok).toBe(false);

    const updated = await useCases.updateProfile({
      id: created.value.id,
      name: "Deep Work 2",
      focusDurationSec: 90,
      shortBreakSec: 30,
      longBreakSec: 60,
      cyclesBeforeLongBreak: 3
    });
    expect(updated.ok && updated.value.focusDurationSec).toBe(90);

    const started = await useCases.startSession({ profileId: created.value.id });
    expect(started.ok && started.value.status).toBe("running_focus");
    if (!started.ok) return;

    const secondStart = await useCases.startSession({ profileId: created.value.id });
    expect(secondStart.ok).toBe(false);
    if (secondStart.ok) return;
    expect(secondStart.error.code).toBe("focus.session_already_active");

    const updateWhileActive = await useCases.updateProfile({
      id: created.value.id,
      name: "Blocked",
      focusDurationSec: 90,
      shortBreakSec: 30,
      longBreakSec: 60,
      cyclesBeforeLongBreak: 3
    });
    expect(updateWhileActive.ok).toBe(false);

    const stopped = await useCases.stopSession({ id: started.value.id });
    expect(stopped.ok && stopped.value.status).toBe("stopped");

    const deleted = await useCases.deleteProfile({ id: created.value.id });
    expect(deleted.ok && deleted.value.id).toBe(created.value.id);
  });

  it("skips phases, keeps the session active when there is a next phase and records history", async () => {
    const clock = new FakeClock("2026-07-01T10:00:00.000Z");
    const repository = new InMemoryFocusRepository([]);
    let idCounter = 0;
    const useCases = createFocusUseCases({
      clock,
      repository,
      idGenerator: {
        nextId: () => `id-${++idCounter}`
      }
    });

    const profile = await useCases.createProfile({
      name: "Short",
      focusDurationSec: 1,
      shortBreakSec: 1,
      longBreakSec: 1,
      cyclesBeforeLongBreak: 1
    });
    if (!profile.ok) {
      throw new Error("setup failed");
    }

    const started = await useCases.startSession({ profileId: profile.value.id });
    if (!started.ok) {
      throw new Error("setup failed");
    }

    const skippedFocus = await useCases.skipPhase({ id: started.value.id });
    expect(skippedFocus.ok && skippedFocus.value.status).toBe("running_break");
    expect(skippedFocus.ok && skippedFocus.value.currentPhase).toBe("long_break");
    expect(skippedFocus.ok && skippedFocus.value.completedCycles).toBe(0);

    const active = await useCases.getActiveSession();
    expect(active.ok && active.value?.status).toBe("running_break");

    if (!skippedFocus.ok) {
      throw new Error("setup failed");
    }

    const skippedBreak = await useCases.skipPhase({ id: skippedFocus.value.id });
    expect(skippedBreak.ok && skippedBreak.value.status).toBe("completed");

    const history = await repository.listHistory();
    expect(history.filter((event) => event.eventType === "focus_phase_skipped")).toHaveLength(2);
  });
});
