import {
  createSchedulerIdempotencyKey,
  type SchedulerAction,
  type SchedulerSource
} from "@/kernel/scheduler/scheduler-types";
import { compareInstants, type Instant } from "@/shared/time/instant";
import { completeCustomTimer } from "../domain/custom-timer-state-machine";
import type { CustomTimerSession } from "../domain/custom-timer-types";
import type { CustomTimerRepository } from "../ports";

export class CustomTimerSchedulerSource implements SchedulerSource {
  readonly id = "custom-timer.timer-end";
  readonly sourceType = "timer";

  constructor(private readonly repository: CustomTimerRepository) {}

  async getNextFireAt(): Promise<Instant | null> {
    const active = await this.repository.listActiveSessions();
    const running = active
      .filter((session) => session.status === "running")
      .sort((a, b) => compareInstants(a.endsAtUtc, b.endsAtUtc));

    return running[0]?.endsAtUtc ?? null;
  }

  async reconcile(now: Instant): Promise<SchedulerAction[]> {
    const dueSessions = await this.repository.listDueRunningSessions(now);
    const actions: SchedulerAction[] = [];

    for (const session of dueSessions) {
      const completed = completeCustomTimer(session, now);

      if (!completed.ok) {
        continue;
      }

      await this.repository.saveSession(completed.value);
      await this.repository.appendHistoryEvent({
        id: `${session.id}:timer_completed:${session.endsAtUtc}`,
        sessionId: session.id,
        eventType: "timer_completed",
        eventPayload: {
          status: "completed",
          scheduledForUtc: session.endsAtUtc
        },
        occurredAtUtc: now
      });
      actions.push(createTimerEndAction(session, now));
    }

    return actions;
  }
}

function createTimerEndAction(session: CustomTimerSession, detectedAtUtc: Instant): SchedulerAction {
  const idempotencyKey = createSchedulerIdempotencyKey({
    sourceType: "timer",
    sourceId: session.id,
    scheduledForUtc: session.endsAtUtc,
    kind: "user_alert"
  });

  return {
    kind: "user_alert",
    source: {
      sourceType: "timer",
      sourceId: session.id
    },
    occurrence: {
      occurrenceId: `${session.id}:timer_end:${session.endsAtUtc}`,
      scheduledForUtc: session.endsAtUtc,
      detectedAtUtc,
      idempotencyKey
    },
    delivery: {
      channels: ["os_notification", "sound"],
      notification: {
        title: "Timer complete",
        body: session.title ? `${session.title} finished.` : "Your timer finished.",
        urgency: "normal"
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
      policy: "fifo_by_scheduled_time",
      groupKey: "custom-timer"
    }
  };
}
