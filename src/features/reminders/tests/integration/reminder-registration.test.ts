import { describe, expect, it } from "vitest";
import { FakeClock } from "@/platform/clock/fake-clock";
import {
  createAppRegistries,
  createFeatureRegistrationContext
} from "@/kernel/registries/app-registries";
import {
  createReminderFeature,
  REMINDER_COMMANDS,
  REMINDER_QUERIES
} from "../..";
import { InMemoryReminderRepository } from "../../persistence/in-memory-reminder-repository";

describe("reminders feature registration", () => {
  it("registers route, navigation, commands, queries, scheduler source and migrations", () => {
    const registries = createAppRegistries();
    const context = createFeatureRegistrationContext(registries);

    createReminderFeature({
      clock: new FakeClock(),
      repository: new InMemoryReminderRepository()
    }).register(context);

    expect(registries.routes.get("/reminders")?.featureId).toBe("reminders");
    expect(registries.navigation.list().map((item) => item.path)).toEqual(["/reminders"]);
    expect(registries.commands.list()).toContain(REMINDER_COMMANDS.CREATE_ONE_TIME);
    expect(registries.commands.list()).toContain(REMINDER_COMMANDS.SNOOZE);
    expect(registries.queries.list()).toContain(REMINDER_QUERIES.LIST);
    expect(registries.scheduler.listSources().map((source) => source.sourceType)).toEqual([
      "reminder"
    ]);
    expect(registries.migrations.list().map((migration) => migration.id)).toEqual([
      "reminders.v1"
    ]);
  });
});
