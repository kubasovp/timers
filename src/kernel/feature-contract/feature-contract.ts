import type { CommandRegistry } from "@/kernel/commands/command-registry";
import type { QueryRegistry } from "@/kernel/queries/query-registry";
import type { NavigationRegistry } from "@/kernel/registries/navigation-registry";
import type { RouteRegistry } from "@/kernel/registries/route-registry";
import type { SettingsRegistry } from "@/kernel/registries/settings-registry";
import type { SchedulerRegistry } from "@/kernel/scheduler/scheduler-registry";
import type { MigrationRegistry } from "@/kernel/storage/migrations";

export type FeatureId = string;

export interface AppFeature {
  id: FeatureId;
  title: string;
  version: string;
  dependencies?: FeatureId[];
  register(context: FeatureRegistrationContext): void;
}

export interface FeatureRegistrationContext {
  routes: RouteRegistry;
  navigation: NavigationRegistry;
  commands: CommandRegistry;
  queries: QueryRegistry;
  scheduler: SchedulerRegistry;
  settings: SettingsRegistry;
  migrations: MigrationRegistry;
}
