import { describe, expect, it } from "vitest";
import type { AppFeature } from "@/kernel/feature-contract/feature-contract";
import {
  createAppRegistries,
  createFeatureRegistrationContext
} from "@/kernel/registries/app-registries";

describe("feature registration context", () => {
  it("registers routes, navigation, commands, queries, scheduler sources, settings and migrations", () => {
    const registries = createAppRegistries();
    const context = createFeatureRegistrationContext(registries);

    const feature: AppFeature = {
      id: "dummy",
      title: "Dummy",
      version: "0.1.0",
      register(registration) {
        registration.routes.add({
          path: "/dummy",
          label: "Dummy",
          featureId: "dummy",
          component: {}
        });
        registration.navigation.add({
          path: "/dummy",
          label: "Dummy",
          featureId: "dummy",
          order: 1
        });
        registration.commands.add("dummy.command", () => ({ ok: true, value: "done" }));
        registration.queries.add("dummy.query", () => ({ ok: true, value: "value" }));
        registration.scheduler.addSource({
          id: "dummy.source",
          sourceType: "timer",
          async getNextFireAt() {
            return null;
          },
          async reconcile() {
            return [];
          }
        });
        registration.settings.add({
          key: "dummy.setting",
          featureId: "dummy",
          schemaVersion: 1,
          defaultValue: true
        });
        registration.migrations.add({
          id: "dummy.v1",
          description: "dummy",
          statements: ["select 1"]
        });
      }
    };

    feature.register(context);

    expect(registries.routes.get("/dummy")?.featureId).toBe("dummy");
    expect(registries.navigation.list()).toHaveLength(1);
    expect(registries.commands.list()).toEqual(["dummy.command"]);
    expect(registries.queries.list()).toEqual(["dummy.query"]);
    expect(registries.scheduler.listSources()).toHaveLength(1);
    expect(registries.settings.list()).toHaveLength(1);
    expect(registries.migrations.list()).toHaveLength(1);
  });
});
