import { describe, expect, it } from "vitest";
import { SchedulerRegistry } from "@/kernel/scheduler/scheduler-registry";
import { FakeClock } from "@/platform/clock/fake-clock";
import { MockNotificationAdapter } from "@/platform/notifications/mock-notification-adapter";
import { InMemorySchedulerDispatchStore } from "@/platform/scheduler-loop/scheduler-dispatch-store";
import { SchedulerLoop } from "@/platform/scheduler-loop/scheduler-loop";
import type { FocusProfile } from "../../domain/focus-types";
import { InMemoryFocusRepository } from "../../persistence/in-memory-focus-repository";
import { FocusSchedulerSource } from "../../scheduler/focus-scheduler-source";
import { createFocusUseCases } from "../../use-cases/focus-use-cases";

const profile: FocusProfile = {
  id: "profile-1",
  name: "Tiny Focus",
  focusDurationSec: 1,
  shortBreakSec: 1,
  longBreakSec: 1,
  cyclesBeforeLongBreak: 2,
  createdAtUtc: "2026-07-01T10:00:00.000Z",
  updatedAtUtc: "2026-07-01T10:00:00.000Z"
};

describe("focus scheduler integration", () => {
  it("restores due phase progress and avoids duplicate dispatch on repeated reconcile", async () => {
    const clock = new FakeClock("2026-07-01T10:00:00.000Z");
    const repository = new InMemoryFocusRepository([profile]);
    const useCases = createFocusUseCases({
      clock,
      repository,
      idGenerator: { nextId: () => "focus-1" }
    });
    const started = await useCases.startSession({ profileId: profile.id });
    expect(started.ok).toBe(true);

    const registry = new SchedulerRegistry();
    registry.addSource(new FocusSchedulerSource(repository));
    const notifications = new MockNotificationAdapter();
    const dispatchStore = new InMemorySchedulerDispatchStore();
    const loop = new SchedulerLoop({
      scheduler: registry,
      clock,
      notifications,
      dispatchStore
    });

    clock.advanceBySeconds(1);
    const first = await loop.reconcileOnce();
    const second = await loop.reconcileOnce();
    const session = await repository.getSession("focus-1");

    expect(first.actionsDispatched).toBe(1);
    expect(second.actionsCreated).toBe(0);
    expect(session?.status).toBe("running_break");
    expect(session?.currentPhase).toBe("short_break");
    expect(session?.phaseStartedAtUtc).toBe("2026-07-01T10:00:01.000Z");
    expect(notifications.notifications).toHaveLength(1);
    expect(notifications.sounds).toHaveLength(1);
  });

  it("advances through cycles and completes after the long break", async () => {
    const clock = new FakeClock("2026-07-01T10:00:00.000Z");
    const repository = new InMemoryFocusRepository([profile]);
    const useCases = createFocusUseCases({
      clock,
      repository,
      idGenerator: { nextId: () => "focus-1" }
    });
    await useCases.startSession({ profileId: profile.id });

    const registry = new SchedulerRegistry();
    registry.addSource(new FocusSchedulerSource(repository));
    const loop = new SchedulerLoop({
      scheduler: registry,
      clock,
      notifications: new MockNotificationAdapter(),
      dispatchStore: new InMemorySchedulerDispatchStore()
    });

    clock.advanceBySeconds(1);
    await loop.reconcileOnce();
    clock.advanceBySeconds(1);
    await loop.reconcileOnce();
    clock.advanceBySeconds(1);
    await loop.reconcileOnce();
    clock.advanceBySeconds(1);
    await loop.reconcileOnce();

    const session = await repository.getSession("focus-1");
    expect(session?.status).toBe("completed");
    expect(session?.completedCycles).toBe(2);
  });
});
