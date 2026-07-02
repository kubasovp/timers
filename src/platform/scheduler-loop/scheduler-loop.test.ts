import { describe, expect, it } from "vitest";
import { SchedulerRegistry } from "@/kernel/scheduler/scheduler-registry";
import {
  createSchedulerIdempotencyKey,
  type SchedulerAction
} from "@/kernel/scheduler/scheduler-types";
import { FakeClock } from "@/platform/clock/fake-clock";
import { MockNotificationAdapter } from "@/platform/notifications/mock-notification-adapter";
import type {
  NotificationAdapter,
  NotificationRequest,
  SoundRequest
} from "@/platform/notifications/notification-adapter";
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

  it("times out a hanging dispatch channel and keeps later ticks unblocked", async () => {
    const clock = new FakeClock("2026-07-01T10:00:00.000Z");
    const scheduler = new SchedulerRegistry();
    const notifications = new HangingSoundNotificationAdapter();
    const dispatchStore = new InMemorySchedulerDispatchStore();
    const soundAction = createTestAction({
      sourceId: "timer-1",
      occurrenceId: "timer-1:end",
      scheduledForUtc: "2026-07-01T10:00:00.000Z",
      channels: ["sound"]
    });
    const reminderAction = createTestAction({
      sourceType: "reminder",
      sourceId: "reminder-1",
      occurrenceId: "reminder-1:due",
      scheduledForUtc: "2026-07-01T10:00:01.000Z",
      channels: ["os_notification"]
    });

    scheduler.addSource({
      id: "fake",
      sourceType: "timer",
      async getNextFireAt() {
        return soundAction.occurrence.scheduledForUtc;
      },
      async reconcile() {
        return [soundAction, reminderAction];
      }
    });

    const loop = new SchedulerLoop({
      scheduler,
      clock,
      notifications,
      dispatchStore,
      dispatchTimeoutMs: 1
    });

    const first = await loop.reconcileOnce();
    const second = await loop.reconcileOnce();

    expect(first.actionsDispatched).toBe(2);
    expect(first.errors).toContain("scheduler.dispatch_timeout:sound");
    expect(second.errors).not.toContain("scheduler.tick_already_in_flight");
    expect(second.deduplicated).toBe(2);
    expect(notifications.notifications).toHaveLength(1);
    expect(dispatchStore.listDeliveries().map((record) => record.deliveryStatus)).toEqual([
      "failed",
      "sent",
      "deduplicated",
      "deduplicated"
    ]);
  });
});

function createTestAction(input: {
  sourceType?: SchedulerAction["source"]["sourceType"];
  sourceId: string;
  occurrenceId: string;
  scheduledForUtc: string;
  channels: SchedulerAction["delivery"]["channels"];
}): SchedulerAction {
  const sourceType = input.sourceType ?? "timer";

  return {
    kind: "user_alert",
    source: {
      sourceType,
      sourceId: input.sourceId
    },
    occurrence: {
      occurrenceId: input.occurrenceId,
      scheduledForUtc: input.scheduledForUtc,
      detectedAtUtc: input.scheduledForUtc,
      idempotencyKey: createSchedulerIdempotencyKey({
        sourceType,
        sourceId: input.sourceId,
        scheduledForUtc: input.scheduledForUtc,
        kind: "user_alert"
      })
    },
    delivery: {
      channels: input.channels,
      notification: {
        title: "Done"
      },
      sound: {
        soundId: "timer-end",
        volume: 0.5
      }
    },
    retry: {
      maxAttempts: 3,
      backoffMs: [1000, 5000, 15000]
    },
    queue: {
      policy: "fifo_by_scheduled_time"
    }
  };
}

class HangingSoundNotificationAdapter implements NotificationAdapter {
  readonly notifications: NotificationRequest[] = [];

  async sendNotification(request: NotificationRequest): Promise<void> {
    this.notifications.push(request);
  }

  async playSound(_request: SoundRequest): Promise<void> {
    await new Promise<void>(() => undefined);
  }
}
