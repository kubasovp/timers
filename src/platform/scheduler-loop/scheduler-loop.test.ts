import { describe, expect, it } from "vitest";
import { SchedulerRegistry } from "@/kernel/scheduler/scheduler-registry";
import {
  createSchedulerIdempotencyKey,
  type SchedulerAction
} from "@/kernel/scheduler/scheduler-types";
import { FakeClock } from "@/platform/clock/fake-clock";
import { MockNotificationAdapter } from "@/platform/notifications/mock-notification-adapter";
import { InMemorySchedulerDispatchStore } from "./scheduler-dispatch-store";
import { SchedulerLoop } from "./scheduler-loop";

describe("SchedulerLoop", () => {
  it("reconciles sources, dispatches alerts and deduplicates by idempotency key", async () => {
    const clock = new FakeClock("2026-07-01T10:00:00.000Z");
    const scheduler = new SchedulerRegistry();
    const notifications = new MockNotificationAdapter();
    const dispatchStore = new InMemorySchedulerDispatchStore();
    const action: SchedulerAction = {
      kind: "user_alert",
      source: { sourceType: "timer", sourceId: "timer-1" },
      occurrence: {
        occurrenceId: "timer-1:end",
        scheduledForUtc: "2026-07-01T10:00:00.000Z",
        detectedAtUtc: clock.now(),
        idempotencyKey: createSchedulerIdempotencyKey({
          sourceType: "timer",
          sourceId: "timer-1",
          scheduledForUtc: "2026-07-01T10:00:00.000Z",
          kind: "user_alert"
        })
      },
      delivery: {
        channels: ["os_notification", "sound"],
        notification: { title: "Timer complete" },
        sound: { soundId: "timer-end", volume: 0.5 }
      },
      retry: { maxAttempts: 3, backoffMs: [1000, 5000, 15000] },
      queue: { policy: "fifo_by_scheduled_time" }
    };

    scheduler.addSource({
      id: "fake",
      sourceType: "timer",
      async getNextFireAt() {
        return action.occurrence.scheduledForUtc;
      },
      async reconcile() {
        return [action];
      }
    });

    const loop = new SchedulerLoop({ scheduler, clock, notifications, dispatchStore });

    const first = await loop.reconcileOnce();
    const second = await loop.reconcileOnce();

    expect(first.actionsDispatched).toBe(1);
    expect(second.deduplicated).toBe(1);
    expect(notifications.notifications).toHaveLength(1);
    expect(notifications.sounds).toHaveLength(1);
    expect(dispatchStore.listDeliveries().map((record) => record.deliveryStatus)).toEqual([
      "sent",
      "sent",
      "deduplicated",
      "deduplicated"
    ]);
  });
});
