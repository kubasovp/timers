import { describe, expect, it } from "vitest";
import { SchedulerRegistry } from "@/kernel/scheduler/scheduler-registry";
import { FakeClock } from "@/platform/clock/fake-clock";
import { MockNotificationAdapter } from "@/platform/notifications/mock-notification-adapter";
import { InMemorySchedulerDispatchStore } from "@/platform/scheduler-loop/scheduler-dispatch-store";
import { SchedulerLoop } from "@/platform/scheduler-loop/scheduler-loop";
import { InMemoryReminderRepository } from "../../persistence/in-memory-reminder-repository";
import { ReminderSchedulerSource } from "../../scheduler/reminder-scheduler-source";
import { createReminderUseCases } from "../../use-cases/reminder-use-cases";

describe("reminder scheduler integration", () => {
  it("fires due one-time reminders once and avoids duplicate dispatch", async () => {
    const clock = new FakeClock("2026-07-02T10:00:00.000Z");
    const repository = new InMemoryReminderRepository();
    const useCases = createReminderUseCases({
      clock,
      repository,
      idGenerator: { nextId: () => "reminder-1" }
    });
    const created = await useCases.createOneTime({
      title: "Coffee",
      message: "Take the cup",
      fireAtUtc: "2026-07-02T10:00:01.000Z"
    });
    expect(created.ok).toBe(true);

    const { loop, notifications } = createLoop(repository, clock);
    clock.advanceBySeconds(1);
    const first = await loop.reconcileOnce();
    const second = await loop.reconcileOnce();
    const reminder = await repository.getReminder("reminder-1");

    expect(first.actionsDispatched).toBe(1);
    expect(second.actionsCreated).toBe(0);
    expect(reminder?.status).toBe("due");
    expect(notifications.notifications).toHaveLength(1);
    expect(notifications.sounds).toHaveLength(1);
    expect(await repository.listOccurrences("reminder-1")).toHaveLength(1);
  });

  it("snoozes a due reminder and fires again at the snoozed time", async () => {
    const clock = new FakeClock("2026-07-02T10:00:00.000Z");
    const repository = new InMemoryReminderRepository();
    const useCases = createReminderUseCases({
      clock,
      repository,
      idGenerator: { nextId: () => "reminder-1" }
    });
    await useCases.createOneTime({
      title: "Move",
      fireAtUtc: "2026-07-02T10:00:01.000Z"
    });

    const { loop, notifications } = createLoop(repository, clock);
    clock.advanceBySeconds(1);
    await loop.reconcileOnce();

    const snoozed = await useCases.snooze({ id: "reminder-1", snoozeSeconds: 120 });
    expect(snoozed.ok && snoozed.value.status).toBe("snoozed");

    clock.advanceBySeconds(119);
    const beforeSnoozeEnd = await loop.reconcileOnce();
    expect(beforeSnoozeEnd.actionsDispatched).toBe(0);

    clock.advanceBySeconds(1);
    const afterSnoozeEnd = await loop.reconcileOnce();
    const occurrences = await repository.listOccurrences("reminder-1");

    expect(afterSnoozeEnd.actionsDispatched).toBe(1);
    expect(notifications.notifications).toHaveLength(2);
    expect(occurrences.map((occurrence) => occurrence.status)).toEqual(["snoozed", "fired"]);
  });

  it("skips old one-time misfires without notification storms", async () => {
    const clock = new FakeClock("2026-07-02T10:00:00.000Z");
    const repository = new InMemoryReminderRepository();
    const useCases = createReminderUseCases({
      clock,
      repository,
      idGenerator: { nextId: () => "reminder-1" }
    });
    await useCases.createOneTime({
      title: "Old reminder",
      fireAtUtc: "2026-06-30T09:59:00.000Z"
    });

    const { loop, notifications } = createLoop(repository, clock);
    const first = await loop.reconcileOnce();
    const second = await loop.reconcileOnce();
    const reminder = await repository.getReminder("reminder-1");
    const occurrences = await repository.listOccurrences("reminder-1");

    expect(first.actionsDispatched).toBe(0);
    expect(second.actionsCreated).toBe(0);
    expect(reminder?.status).toBe("done");
    expect(occurrences).toHaveLength(1);
    expect(occurrences[0]?.status).toBe("skipped");
    expect(notifications.notifications).toHaveLength(0);
  });

  it("fires one-time misfires inside the grace window once", async () => {
    const clock = new FakeClock("2026-07-02T10:00:00.000Z");
    const repository = new InMemoryReminderRepository();
    const useCases = createReminderUseCases({
      clock,
      repository,
      idGenerator: { nextId: () => "reminder-1" }
    });
    await useCases.createOneTime({
      title: "Recent missed reminder",
      fireAtUtc: "2026-07-01T11:00:00.000Z"
    });

    const { loop, notifications } = createLoop(repository, clock);
    const first = await loop.reconcileOnce();
    const second = await loop.reconcileOnce();
    const reminder = await repository.getReminder("reminder-1");

    expect(first.actionsDispatched).toBe(1);
    expect(second.actionsCreated).toBe(0);
    expect(reminder?.status).toBe("due");
    expect(notifications.notifications).toHaveLength(1);
  });

  it("queues simultaneous due reminders through the scheduler loop", async () => {
    const clock = new FakeClock("2026-07-02T10:00:00.000Z");
    const repository = new InMemoryReminderRepository();
    let nextId = 0;
    const useCases = createReminderUseCases({
      clock,
      repository,
      idGenerator: { nextId: () => `id-${++nextId}` }
    });
    await useCases.createOneTime({
      title: "First",
      fireAtUtc: "2026-07-02T10:00:05.000Z"
    });
    await useCases.createOneTime({
      title: "Second",
      fireAtUtc: "2026-07-02T10:00:05.000Z"
    });

    const { loop, notifications } = createLoop(repository, clock);
    clock.advanceBySeconds(5);
    const report = await loop.reconcileOnce();

    expect(report.actionsCreated).toBe(2);
    expect(report.actionsDispatched).toBe(2);
    expect(notifications.notifications.map((notification) => notification.title)).toEqual([
      "First",
      "Second"
    ]);
  });
});

function createLoop(repository: InMemoryReminderRepository, clock: FakeClock): {
  loop: SchedulerLoop;
  notifications: MockNotificationAdapter;
} {
  const registry = new SchedulerRegistry();
  registry.addSource(new ReminderSchedulerSource(repository));
  const notifications = new MockNotificationAdapter();
  const loop = new SchedulerLoop({
    scheduler: registry,
    clock,
    notifications,
    dispatchStore: new InMemorySchedulerDispatchStore()
  });

  return { loop, notifications };
}
