import { describe, expect, it } from "vitest";
import { FakeClock } from "@/platform/clock/fake-clock";
import { InMemoryCustomTimerRepository } from "../../persistence/in-memory-custom-timer-repository";
import { createCustomTimerUseCases } from "../../use-cases/custom-timer-use-cases";

describe("custom timer use cases", () => {
  it("starts, pauses, resumes, restarts and stops a timer through handlers", async () => {
    const clock = new FakeClock("2026-07-01T10:00:00.000Z");
    const repository = new InMemoryCustomTimerRepository();
    let idCounter = 0;
    const useCases = createCustomTimerUseCases({
      clock,
      repository,
      idGenerator: {
        nextId: () => `id-${++idCounter}`
      }
    });

    const started = await useCases.start({ title: "Tea", minutes: 2 });
    expect(started.ok && started.value.remainingSeconds).toBe(120);
    if (!started.ok) return;

    clock.advanceBySeconds(30);
    const paused = await useCases.pause({ id: started.value.id });
    expect(paused.ok && paused.value.status).toBe("paused");
    expect(paused.ok && paused.value.remainingSeconds).toBe(90);

    clock.advanceBySeconds(30);
    const resumed = await useCases.resume({ id: started.value.id });
    expect(resumed.ok && resumed.value.status).toBe("running");

    const restarted = await useCases.restart({ id: started.value.id });
    expect(restarted.ok && restarted.value.remainingSeconds).toBe(120);

    const stopped = await useCases.stop({ id: started.value.id });
    expect(stopped.ok && stopped.value.status).toBe("stopped");
    expect(await repository.getSession(started.value.id)).toBeNull();

    const active = await useCases.listActive();
    expect(active.ok && active.value).toEqual([]);
    expect(await repository.listHistory()).toHaveLength(5);
  });

  it("keeps completed timers available to run again or delete", async () => {
    const clock = new FakeClock("2026-07-01T10:00:00.000Z");
    const repository = new InMemoryCustomTimerRepository([]);
    let idCounter = 0;
    const useCases = createCustomTimerUseCases({
      clock,
      repository,
      idGenerator: {
        nextId: () => `id-${++idCounter}`
      }
    });

    const started = await useCases.start({ title: "Pasta", minutes: 8 });
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    clock.advanceBySeconds(480);
    const completed = await useCases.complete({ id: started.value.id });
    expect(completed.ok && completed.value.status).toBe("completed");

    const active = await useCases.listActive();
    expect(active.ok && active.value).toEqual([]);

    const completedList = await useCases.listCompleted();
    expect(completedList.ok && completedList.value).toHaveLength(1);
    if (!completedList.ok) return;
    expect(completedList.value[0]).toMatchObject({
      title: "Pasta",
      durationTotalSec: 480,
      remainingSeconds: 0
    });

    const restarted = await useCases.restart({ id: completedList.value[0].id });
    expect(restarted.ok && restarted.value.status).toBe("running");
    expect(restarted.ok && restarted.value.id).toBe(started.value.id);

    const completedAfterRestart = await useCases.listCompleted();
    expect(completedAfterRestart.ok && completedAfterRestart.value).toEqual([]);

    const stoppedReusable = await useCases.stop({ id: started.value.id });
    expect(stoppedReusable.ok && stoppedReusable.value.status).toBe("completed");

    const completedAfterReusableStop = await useCases.listCompleted();
    expect(completedAfterReusableStop.ok && completedAfterReusableStop.value).toHaveLength(1);

    const restartedAgain = await useCases.restart({ id: started.value.id });
    expect(restartedAgain.ok && restartedAgain.value.status).toBe("running");

    clock.advanceBySeconds(480);
    const completedAgain = await useCases.complete({ id: started.value.id });
    expect(completedAgain.ok && completedAgain.value.status).toBe("completed");

    const completedAfterSecondRun = await useCases.listCompleted();
    expect(completedAfterSecondRun.ok && completedAfterSecondRun.value).toHaveLength(1);

    const deleted = await useCases.deleteCompleted({ id: started.value.id });
    expect(deleted.ok).toBe(true);

    const completedAfterDelete = await useCases.listCompleted();
    expect(completedAfterDelete.ok && completedAfterDelete.value).toEqual([]);
  });
});
