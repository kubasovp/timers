import { describe, expect, it } from "vitest";
import { FakeClock } from "@/platform/clock/fake-clock";
import {
  createAppRegistries,
  createFeatureRegistrationContext
} from "@/kernel/registries/app-registries";
import { createFocusFeature, FOCUS_COMMANDS, FOCUS_QUERIES } from "../..";
import { InMemoryFocusRepository } from "../../persistence/in-memory-focus-repository";

describe("focus feature registration", () => {
  it("registers route, navigation, commands, queries, scheduler source and migrations", () => {
    const registries = createAppRegistries();
    const context = createFeatureRegistrationContext(registries);

    createFocusFeature({
      clock: new FakeClock(),
      repository: new InMemoryFocusRepository([])
    }).register(context);

    expect(registries.routes.get("/focus")?.featureId).toBe("focus");
    expect(registries.navigation.list().map((item) => item.path)).toEqual(["/focus"]);
    expect(registries.commands.list()).toContain(FOCUS_COMMANDS.START_SESSION);
    expect(registries.commands.list()).toContain(FOCUS_COMMANDS.CREATE_PROFILE);
    expect(registries.queries.list()).toContain(FOCUS_QUERIES.GET_ACTIVE_SESSION);
    expect(registries.scheduler.listSources().map((source) => source.sourceType)).toEqual([
      "focus"
    ]);
    expect(registries.migrations.list().map((migration) => migration.id)).toEqual(["focus.v1"]);
  });
});
