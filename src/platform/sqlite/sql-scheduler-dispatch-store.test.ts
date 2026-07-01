import { describe, expect, it } from "vitest";
import type { SchedulerAction } from "@/kernel/scheduler/scheduler-types";
import type { DatabaseConnection, SqlValue } from "@/kernel/storage/database";
import { createDeliveryRecord } from "@/platform/scheduler-loop/scheduler-dispatch-store";
import { SqlSchedulerDispatchStore } from "./sql-scheduler-dispatch-store";

describe("SqlSchedulerDispatchStore", () => {
  it("creates scheduler occurrences once and deduplicates repeated dispatches", async () => {
    const db = new FakeDispatchDatabase();
    const store = new SqlSchedulerDispatchStore(db, { nextId: () => "delivery-1" });
    const action = createAction();

    const first = await store.beginDispatch(action);
    const second = await store.beginDispatch(action);

    expect(first).toEqual({ status: "created", occurrenceId: "occurrence-1" });
    expect(second).toEqual({ status: "deduplicated", occurrenceId: "occurrence-1" });
    expect(db.occurrences).toHaveLength(1);
  });

  it("records delivery attempts and updates occurrence status", async () => {
    const db = new FakeDispatchDatabase();
    const store = new SqlSchedulerDispatchStore(db, { nextId: () => "delivery-1" });

    await store.beginDispatch(createAction());
    await store.recordDelivery(
      createDeliveryRecord({
        occurrenceId: "occurrence-1",
        channel: "os_notification",
        deliveryStatus: "sent"
      })
    );

    expect(db.deliveries).toEqual([
      {
        id: "delivery-1",
        occurrenceId: "occurrence-1",
        channel: "os_notification",
        deliveryStatus: "sent",
        attemptNo: 1
      }
    ]);
    expect(db.occurrences[0]?.resultStatus).toBe("sent");
    expect(db.occurrences[0]?.processedAtUtc).toBeTruthy();
  });
});

interface StoredOccurrence {
  id: string;
  idempotencyKey: string;
  resultStatus: string;
  processedAtUtc: string | null;
}

interface StoredDelivery {
  id: string;
  occurrenceId: string;
  channel: string;
  deliveryStatus: string;
  attemptNo: number;
}

class FakeDispatchDatabase implements DatabaseConnection {
  readonly occurrences: StoredOccurrence[] = [];
  readonly deliveries: StoredDelivery[] = [];

  async execute(sql: string, params: SqlValue[] = []): Promise<void> {
    const normalized = normalizeSql(sql);

    if (normalized.startsWith("insert into scheduler_occurrences")) {
      this.occurrences.push({
        id: String(params[0]),
        idempotencyKey: String(params[5]),
        resultStatus: String(params[4]),
        processedAtUtc: null
      });
      return;
    }

    if (normalized.startsWith("insert into notification_delivery_log")) {
      this.deliveries.push({
        id: String(params[0]),
        occurrenceId: String(params[1]),
        channel: String(params[2]),
        deliveryStatus: String(params[3]),
        attemptNo: Number(params[4])
      });
      return;
    }

    if (normalized.startsWith("update scheduler_occurrences")) {
      const occurrence = this.occurrences.find((item) => item.id === params[2]);

      if (occurrence) {
        occurrence.processedAtUtc = String(params[0]);
        occurrence.resultStatus = String(params[1]);
      }
    }
  }

  async select<TRow extends Record<string, unknown>>(
    _sql: string,
    params: SqlValue[] = []
  ): Promise<TRow[]> {
    const row = this.occurrences.find((item) => item.idempotencyKey === params[0]);
    return row ? ([{ id: row.id }] as unknown as TRow[]) : [];
  }
}

function createAction(): SchedulerAction {
  return {
    kind: "user_alert",
    source: {
      sourceType: "timer",
      sourceId: "timer-1"
    },
    occurrence: {
      occurrenceId: "occurrence-1",
      scheduledForUtc: "2026-07-01T10:00:00.000Z",
      detectedAtUtc: "2026-07-01T10:00:00.000Z",
      idempotencyKey: "timer:timer-1:2026-07-01T10:00:00.000Z:user_alert"
    },
    delivery: {
      channels: ["os_notification"],
      notification: {
        title: "Done"
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

function normalizeSql(sql: string): string {
  return sql.trim().replace(/\s+/g, " ");
}
