import { describe, expect, it } from "vitest";
import { FakeClock } from "@/platform/clock/fake-clock";
import { markReminderDue } from "../../domain/reminder-state-machine";
import { InMemoryReminderRepository } from "../../persistence/in-memory-reminder-repository";
import { createReminderUseCases } from "../../use-cases/reminder-use-cases";

describe("reminder use cases", () => {
  it("creates, lists, disables, enables and deletes one-time reminders", async () => {
    const clock = new FakeClock("2026-07-02T10:00:00.000Z");
    const repository = new InMemoryReminderRepository();
    let idCounter = 0;
    const useCases = createReminderUseCases({
      clock,
      repository,
      idGenerator: { nextId: () => `id-${++idCounter}` }
    });

    const created = await useCases.createOneTime({
      title: " Call ",
      message: "Discuss release",
      fireAtUtc: "2026-07-02T10:30:00.000Z"
    });
    expect(created.ok && created.value.title).toBe("Call");
    if (!created.ok) return;

    const disabled = await useCases.disable({ id: created.value.id });
    expect(disabled.ok && disabled.value.status).toBe("disabled");

    const enabled = await useCases.enable({ id: created.value.id });
    expect(enabled.ok && enabled.value.status).toBe("enabled");

    const list = await useCases.list();
    expect(list.ok && list.value).toHaveLength(1);
    expect(list.ok && list.value[0]?.secondsUntilNext).toBe(1800);

    const deleted = await useCases.delete({ id: created.value.id });
    expect(deleted.ok && deleted.value.status).toBe("deleted");

    const afterDelete = await useCases.list();
    expect(afterDelete.ok && afterDelete.value).toEqual([]);
  });

  it("acknowledges and snoozes due reminders", async () => {
    const clock = new FakeClock("2026-07-02T10:00:00.000Z");
    const repository = new InMemoryReminderRepository();
    const useCases = createReminderUseCases({
      clock,
      repository,
      idGenerator: { nextId: () => "reminder-1" }
    });

    const created = await useCases.createOneTime({
      title: "Water",
      fireAtUtc: "2026-07-02T10:01:00.000Z"
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const stored = await repository.getReminder(created.value.id);
    expect(stored).toBeTruthy();
    if (!stored) return;

    const due = markReminderDue(stored, "2026-07-02T10:01:00.000Z");
    expect(due.ok).toBe(true);
    if (!due.ok) return;
    await repository.saveReminder(due.value);

    clock.set("2026-07-02T10:01:00.000Z");
    const snoozed = await useCases.snooze({ id: created.value.id, snoozeSeconds: 120 });
    expect(snoozed.ok && snoozed.value.status).toBe("snoozed");
    expect(snoozed.ok && snoozed.value.nextFireAtUtc).toBe("2026-07-02T10:03:00.000Z");

    const dueAgain = markReminderDue(
      (await repository.getReminder(created.value.id))!,
      "2026-07-02T10:03:00.000Z"
    );
    expect(dueAgain.ok).toBe(true);
    if (!dueAgain.ok) return;
    await repository.saveReminder(dueAgain.value);

    clock.set("2026-07-02T10:03:00.000Z");
    const done = await useCases.done({ id: created.value.id });
    expect(done.ok && done.value.status).toBe("done");
  });
});
