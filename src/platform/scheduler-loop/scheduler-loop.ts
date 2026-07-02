import type { SchedulerRegistry } from "@/kernel/scheduler/scheduler-registry";
import type { SchedulerAction } from "@/kernel/scheduler/scheduler-types";
import { compareInstants, type Instant } from "@/shared/time/instant";
import type { Clock } from "@/shared/time/clock";
import type { NotificationAdapter } from "@/platform/notifications/notification-adapter";
import {
  createDeliveryRecord,
  type SchedulerDispatchStore
} from "./scheduler-dispatch-store";

export interface SchedulerLoopReport {
  reconciledSources: number;
  actionsCreated: number;
  actionsDispatched: number;
  deduplicated: number;
  errors: string[];
}

export class SchedulerLoop {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private inFlight = false;

  constructor(
    private readonly dependencies: {
      scheduler: SchedulerRegistry;
      clock: Clock;
      notifications: NotificationAdapter;
      dispatchStore: SchedulerDispatchStore;
      cadenceMs?: number;
      dispatchTimeoutMs?: number;
    }
  ) {}

  start(): void {
    if (this.intervalId) {
      return;
    }

    this.intervalId = setInterval(() => {
      void this.reconcileOnce();
    }, this.dependencies.cadenceMs ?? 1000);
  }

  stop(): void {
    if (!this.intervalId) {
      return;
    }

    clearInterval(this.intervalId);
    this.intervalId = null;
  }

  async reconcileOnce(now: Instant = this.dependencies.clock.now()): Promise<SchedulerLoopReport> {
    if (this.inFlight) {
      return {
        reconciledSources: 0,
        actionsCreated: 0,
        actionsDispatched: 0,
        deduplicated: 0,
        errors: ["scheduler.tick_already_in_flight"]
      };
    }

    this.inFlight = true;

    try {
      const report: SchedulerLoopReport = {
        reconciledSources: 0,
        actionsCreated: 0,
        actionsDispatched: 0,
        deduplicated: 0,
        errors: []
      };
      const actions: SchedulerAction[] = [];

      for (const source of this.dependencies.scheduler.listSources()) {
        try {
          actions.push(...(await source.reconcile(now)));
          report.reconciledSources += 1;
        } catch (error) {
          report.errors.push(error instanceof Error ? error.message : String(error));
        }
      }

      actions.sort((a, b) =>
        compareInstants(a.occurrence.scheduledForUtc, b.occurrence.scheduledForUtc)
      );
      report.actionsCreated = actions.length;

      for (const action of actions) {
        const begin = await this.dependencies.dispatchStore.beginDispatch(action);

        if (begin.status === "deduplicated") {
          report.deduplicated += 1;
          for (const channel of action.delivery.channels) {
            await this.dependencies.dispatchStore.recordDelivery(
              createDeliveryRecord({
                occurrenceId: begin.occurrenceId,
                channel,
                deliveryStatus: "deduplicated"
              })
            );
          }
          continue;
        }

        await this.dispatchAction(action, begin.occurrenceId, report);
      }

      return report;
    } finally {
      this.inFlight = false;
    }
  }

  private async dispatchAction(
    action: SchedulerAction,
    occurrenceId: string,
    report: SchedulerLoopReport
  ): Promise<void> {
    for (const channel of action.delivery.channels) {
      try {
        if (channel === "os_notification") {
          await this.withDispatchTimeout(
            this.dependencies.notifications.sendNotification({
              id: action.occurrence.idempotencyKey,
              ...action.delivery.notification
            }),
            channel
          );
        } else {
          await this.withDispatchTimeout(
            this.dependencies.notifications.playSound(action.delivery.sound ?? {}),
            channel
          );
        }

        await this.dependencies.dispatchStore.recordDelivery(
          createDeliveryRecord({
            occurrenceId,
            channel,
            deliveryStatus: "sent"
          })
        );
      } catch (error) {
        report.errors.push(error instanceof Error ? error.message : String(error));
        await this.dependencies.dispatchStore.recordDelivery(
          createDeliveryRecord({
            occurrenceId,
            channel,
            deliveryStatus: "failed"
          })
        );
      }
    }

    report.actionsDispatched += 1;
  }

  private async withDispatchTimeout<T>(operation: Promise<T>, channel: string): Promise<T> {
    const timeoutMs = this.dependencies.dispatchTimeoutMs ?? 3000;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    try {
      return await Promise.race([
        operation,
        new Promise<never>((_resolve, reject) => {
          timeoutId = setTimeout(() => {
            reject(new Error(`scheduler.dispatch_timeout:${channel}`));
          }, timeoutMs);
        })
      ]);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }
}
