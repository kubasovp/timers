import type { SchedulerAction } from "@/kernel/scheduler/scheduler-types";
import { toInstant, type Instant } from "@/shared/time/instant";

export type SchedulerBeginDispatchResult =
  | { status: "created"; occurrenceId: string }
  | { status: "deduplicated"; occurrenceId: string };

export interface SchedulerDeliveryRecord {
  occurrenceId: string;
  channel: "os_notification" | "sound";
  deliveryStatus: "sent" | "failed" | "deduplicated";
  attemptNo: number;
  createdAtUtc: Instant;
}

export interface SchedulerDispatchStore {
  beginDispatch(action: SchedulerAction): Promise<SchedulerBeginDispatchResult>;
  recordDelivery(record: SchedulerDeliveryRecord): Promise<void>;
}

interface StoredOccurrence {
  occurrenceId: string;
  idempotencyKey: string;
  sourceType: SchedulerAction["source"]["sourceType"];
  sourceId: string;
  scheduledForUtc: Instant;
}

export class InMemorySchedulerDispatchStore implements SchedulerDispatchStore {
  private readonly occurrences = new Map<string, StoredOccurrence>();
  private readonly deliveries: SchedulerDeliveryRecord[] = [];

  async beginDispatch(action: SchedulerAction): Promise<SchedulerBeginDispatchResult> {
    const existing = this.occurrences.get(action.occurrence.idempotencyKey);

    if (existing) {
      return { status: "deduplicated", occurrenceId: existing.occurrenceId };
    }

    const occurrence: StoredOccurrence = {
      occurrenceId: action.occurrence.occurrenceId,
      idempotencyKey: action.occurrence.idempotencyKey,
      sourceType: action.source.sourceType,
      sourceId: action.source.sourceId,
      scheduledForUtc: action.occurrence.scheduledForUtc
    };

    this.occurrences.set(action.occurrence.idempotencyKey, occurrence);
    return { status: "created", occurrenceId: occurrence.occurrenceId };
  }

  async recordDelivery(record: SchedulerDeliveryRecord): Promise<void> {
    this.deliveries.push(record);
  }

  listDeliveries(): SchedulerDeliveryRecord[] {
    return [...this.deliveries];
  }
}

export class BrowserSchedulerDispatchStore implements SchedulerDispatchStore {
  private readonly fallback = new InMemorySchedulerDispatchStore();

  constructor(private readonly storageKey = "timers.scheduler.dispatch.v1") {}

  async beginDispatch(action: SchedulerAction): Promise<SchedulerBeginDispatchResult> {
    const storage = getLocalStorage();

    if (!storage) {
      return this.fallback.beginDispatch(action);
    }

    const state = readState(storage, this.storageKey);
    const existing = state.occurrences[action.occurrence.idempotencyKey];

    if (existing) {
      return { status: "deduplicated", occurrenceId: existing.occurrenceId };
    }

    const occurrence: StoredOccurrence = {
      occurrenceId: action.occurrence.occurrenceId,
      idempotencyKey: action.occurrence.idempotencyKey,
      sourceType: action.source.sourceType,
      sourceId: action.source.sourceId,
      scheduledForUtc: action.occurrence.scheduledForUtc
    };

    state.occurrences[action.occurrence.idempotencyKey] = occurrence;
    writeState(storage, this.storageKey, state);

    return { status: "created", occurrenceId: occurrence.occurrenceId };
  }

  async recordDelivery(record: SchedulerDeliveryRecord): Promise<void> {
    const storage = getLocalStorage();

    if (!storage) {
      await this.fallback.recordDelivery(record);
      return;
    }

    const state = readState(storage, this.storageKey);
    state.deliveries.push(record);
    writeState(storage, this.storageKey, state);
  }
}

interface BrowserStoreState {
  occurrences: Record<string, StoredOccurrence>;
  deliveries: SchedulerDeliveryRecord[];
}

function getLocalStorage(): Storage | null {
  return typeof globalThis.localStorage === "undefined" ? null : globalThis.localStorage;
}

function readState(storage: Storage, key: string): BrowserStoreState {
  const raw = storage.getItem(key);

  if (!raw) {
    return { occurrences: {}, deliveries: [] };
  }

  return JSON.parse(raw) as BrowserStoreState;
}

function writeState(storage: Storage, key: string, state: BrowserStoreState): void {
  storage.setItem(key, JSON.stringify(state));
}

export function createDeliveryRecord(input: {
  occurrenceId: string;
  channel: "os_notification" | "sound";
  deliveryStatus: "sent" | "failed" | "deduplicated";
  attemptNo?: number;
}): SchedulerDeliveryRecord {
  return {
    occurrenceId: input.occurrenceId,
    channel: input.channel,
    deliveryStatus: input.deliveryStatus,
    attemptNo: input.attemptNo ?? 1,
    createdAtUtc: toInstant(new Date())
  };
}
