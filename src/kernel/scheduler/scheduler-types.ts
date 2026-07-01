import type { Instant } from "@/shared/time/instant";

export type SchedulerSourceType = "timer" | "focus" | "reminder";

export interface SchedulerSource {
  id: string;
  sourceType: SchedulerSourceType;
  getNextFireAt(now: Instant): Promise<Instant | null>;
  reconcile(now: Instant): Promise<SchedulerAction[]>;
}

export interface SchedulerAction {
  kind: "user_alert";
  source: {
    sourceType: SchedulerSourceType;
    sourceId: string;
  };
  occurrence: {
    occurrenceId: string;
    scheduledForUtc: Instant;
    detectedAtUtc: Instant;
    idempotencyKey: string;
  };
  delivery: {
    channels: Array<"os_notification" | "sound">;
    notification: {
      title: string;
      body?: string;
      urgency?: "normal" | "high";
    };
    sound?: {
      soundId?: string;
      volume?: number;
    };
  };
  retry: {
    maxAttempts: 3;
    backoffMs: [1000, 5000, 15000];
  };
  queue: {
    policy: "fifo_by_scheduled_time";
    groupKey?: string;
  };
}

export function createSchedulerIdempotencyKey(input: {
  sourceType: SchedulerSourceType;
  sourceId: string;
  scheduledForUtc: Instant;
  kind: SchedulerAction["kind"];
}): string {
  return `${input.sourceType}:${input.sourceId}:${input.scheduledForUtc}:${input.kind}`;
}
