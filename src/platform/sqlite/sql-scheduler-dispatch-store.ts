import type { SchedulerAction } from "@/kernel/scheduler/scheduler-types";
import type { DatabaseConnection } from "@/kernel/storage/database";
import { DefaultIdGenerator, type IdGenerator } from "@/shared/id/create-id";
import type {
  SchedulerBeginDispatchResult,
  SchedulerDeliveryRecord,
  SchedulerDispatchStore
} from "@/platform/scheduler-loop/scheduler-dispatch-store";

interface OccurrenceRow extends Record<string, unknown> {
  id: string;
}

export class SqlSchedulerDispatchStore implements SchedulerDispatchStore {
  constructor(
    private readonly db: DatabaseConnection,
    private readonly idGenerator: IdGenerator = new DefaultIdGenerator()
  ) {}

  async beginDispatch(action: SchedulerAction): Promise<SchedulerBeginDispatchResult> {
    const existing = await this.findOccurrence(action.occurrence.idempotencyKey);

    if (existing) {
      return { status: "deduplicated", occurrenceId: existing.id };
    }

    try {
      await this.db.execute(
        `insert into scheduler_occurrences (
          id, source_type, source_id, scheduled_for_utc, processed_at_utc,
          result_status, idempotency_key
        ) values (?, ?, ?, ?, null, ?, ?)`,
        [
          action.occurrence.occurrenceId,
          action.source.sourceType,
          action.source.sourceId,
          action.occurrence.scheduledForUtc,
          "created",
          action.occurrence.idempotencyKey
        ]
      );
    } catch (error) {
      const concurrentlyInserted = await this.findOccurrence(action.occurrence.idempotencyKey);

      if (concurrentlyInserted) {
        return { status: "deduplicated", occurrenceId: concurrentlyInserted.id };
      }

      throw error;
    }

    return { status: "created", occurrenceId: action.occurrence.occurrenceId };
  }

  async recordDelivery(record: SchedulerDeliveryRecord): Promise<void> {
    await this.db.execute(
      `insert into notification_delivery_log (
        id, occurrence_id, channel, delivery_status, attempt_no, created_at_utc
      ) values (?, ?, ?, ?, ?, ?)`,
      [
        this.idGenerator.nextId(),
        record.occurrenceId,
        record.channel,
        record.deliveryStatus,
        record.attemptNo,
        record.createdAtUtc
      ]
    );
    await this.db.execute(
      `update scheduler_occurrences
       set processed_at_utc = ?, result_status = ?
       where id = ?`,
      [record.createdAtUtc, record.deliveryStatus, record.occurrenceId]
    );
  }

  private async findOccurrence(idempotencyKey: string): Promise<OccurrenceRow | null> {
    const rows = await this.db.select<OccurrenceRow>(
      `select id from scheduler_occurrences where idempotency_key = ?`,
      [idempotencyKey]
    );

    return rows[0] ?? null;
  }
}
