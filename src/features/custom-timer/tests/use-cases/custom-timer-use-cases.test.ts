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

    const active = await useCases.listActive();
    expect(active.ok && active.value).toEqual([]);
    expect(await repository.listHistory()).toHaveLength(5);
  });
});
