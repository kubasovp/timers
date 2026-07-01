import { describe, expect, it } from "vitest";
import { SchedulerRegistry } from "@/kernel/scheduler/scheduler-registry";
import { FakeClock } from "@/platform/clock/fake-clock";
import { MockNotificationAdapter } from "@/platform/notifications/mock-notification-adapter";
import { InMemorySchedulerDispatchStore } from "@/platform/scheduler-loop/scheduler-dispatch-store";
import { SchedulerLoop } from "@/platform/scheduler-loop/scheduler-loop";
import { InMemoryCustomTimerRepository } from "../../persistence/in-memory-custom-timer-repository";
import { CustomTimerSchedulerSource } from "../../scheduler/custom-timer-scheduler-source";
import { createCustomTimerUseCases } from "../../use-cases/custom-timer-use-cases";

describe("custom timer scheduler integration", () => {
  it("completes due timers, dispatches once and does not duplicate on repeated reconcile", async () => {
    const clock = new FakeClock("2026-07-01T10:00:00.000Z");
    const repository = new InMemoryCustomTimerRepository([]);
    const useCases = createCustomTimerUseCases({
      clock,
      repository,
      idGenerator: { nextId: () => "timer-1" }
    });
    const started = await useCases.start({ seconds: 1 });
    expect(started.ok).toBe(true);

    const registry = new SchedulerRegistry();
    registry.addSource(new CustomTimerSchedulerSource(repository));
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
    const session = await repository.getSession("timer-1");

    expect(first.actionsDispatched).toBe(1);
    expect(second.actionsCreated).toBe(0);
    expect(session?.status).toBe("completed");
    expect(notifications.notifications).toHaveLength(1);
    expect(notifications.sounds).toHaveLength(1);
  });
});
