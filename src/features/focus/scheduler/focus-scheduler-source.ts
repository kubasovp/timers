import {
  createSchedulerIdempotencyKey,
  type SchedulerAction,
  type SchedulerSource
} from "@/kernel/scheduler/scheduler-types";
import { type Instant } from "@/shared/time/instant";
import {
  advanceFocusPhase,
  isRunningFocusSession
} from "../domain/focus-state-machine";
import type { FocusProfile, FocusSession } from "../domain/focus-types";
import type { FocusRepository } from "../ports";

export class FocusSchedulerSource implements SchedulerSource {
  readonly id = "focus.phase-end";
  readonly sourceType = "focus";

  constructor(private readonly repository: FocusRepository) {}

  async getNextFireAt(): Promise<Instant | null> {
    const active = await this.repository.getActiveSession();

    if (!active || !isRunningFocusSession(active)) {
      return null;
    }

    return active.phaseEndsAtUtc;
  }

  async reconcile(now: Instant): Promise<SchedulerAction[]> {
    const dueSessions = await this.repository.listDueRunningSessions(now);
    const actions: SchedulerAction[] = [];

    for (const session of dueSessions) {
      const profile = await this.repository.getProfile(session.profileId);

      if (!profile) {
        continue;
      }

      const advanced = advanceFocusPhase(session, profile);

      if (!advanced.ok) {
        continue;
      }

      await this.repository.saveSession(advanced.value);
      await this.repository.appendHistoryEvent({
        id: `${session.id}:phase_ended:${session.phaseEndsAtUtc}`,
        aggregateType: "timer_session",
        aggregateId: session.id,
        eventType:
          advanced.value.status === "completed"
            ? "focus_session_completed"
            : "focus_phase_advanced",
        eventPayload: {
          fromPhase: session.currentPhase,
          toPhase: advanced.value.currentPhase,
          status: advanced.value.status,
          scheduledForUtc: session.phaseEndsAtUtc,
          cycleIndex: advanced.value.cycleIndex,
          completedCycles: advanced.value.completedCycles
        },
        occurredAtUtc: now
      });
      actions.push(createPhaseEndAction(session, advanced.value, profile, now));
    }

    return actions;
  }
}

function createPhaseEndAction(
  previous: FocusSession,
  next: FocusSession,
  profile: FocusProfile,
  detectedAtUtc: Instant
): SchedulerAction {
  const idempotencyKey = createSchedulerIdempotencyKey({
    sourceType: "focus",
    sourceId: previous.id,
    scheduledForUtc: previous.phaseEndsAtUtc,
    kind: "user_alert"
  });
  const notification = getNotification(previous, next, profile);

  return {
    kind: "user_alert",
    source: {
      sourceType: "focus",
      sourceId: previous.id
    },
    occurrence: {
      occurrenceId: `${previous.id}:phase_end:${previous.phaseEndsAtUtc}`,
      scheduledForUtc: previous.phaseEndsAtUtc,
      detectedAtUtc,
      idempotencyKey
    },
    delivery: {
      channels: ["os_notification", "sound"],
      notification,
      sound: {
        soundId: "focus-phase",
        volume: 0.5
      }
    },
    retry: {
      maxAttempts: 3,
      backoffMs: [1000, 5000, 15000]
    },
    queue: {
      policy: "fifo_by_scheduled_time",
      groupKey: "focus"
    }
  };
}

function getNotification(
  previous: FocusSession,
  next: FocusSession,
  profile: FocusProfile
): SchedulerAction["delivery"]["notification"] {
  if (previous.currentPhase === "focus") {
    return {
      title: "Focus complete",
      body:
        next.currentPhase === "long_break"
          ? `${profile.name}: long break started.`
          : `${profile.name}: short break started.`,
      urgency: "normal"
    };
  }

  if (next.status === "completed") {
    return {
      title: "Focus session complete",
      body: `${profile.name} completed.`,
      urgency: "normal"
    };
  }

  return {
    title: "Break complete",
    body: `${profile.name}: cycle ${next.cycleIndex} started.`,
    urgency: "normal"
  };
}
