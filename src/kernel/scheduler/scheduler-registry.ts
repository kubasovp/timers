import type { SchedulerSource } from "./scheduler-types";

export class SchedulerRegistry {
  private readonly sources = new Map<string, SchedulerSource>();

  addSource(source: SchedulerSource): void {
    if (this.sources.has(source.id)) {
      throw new Error(`Scheduler source already registered: ${source.id}`);
    }

    this.sources.set(source.id, source);
  }

  listSources(): SchedulerSource[] {
    return Array.from(this.sources.values()).sort((a, b) => a.id.localeCompare(b.id));
  }
}
