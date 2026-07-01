import { CommandRegistry } from "@/kernel/commands/command-registry";
import type { FeatureRegistrationContext } from "@/kernel/feature-contract/feature-contract";
import { QueryRegistry } from "@/kernel/queries/query-registry";
import { NavigationRegistry } from "@/kernel/registries/navigation-registry";
import { RouteRegistry } from "@/kernel/registries/route-registry";
import { SettingsRegistry } from "@/kernel/registries/settings-registry";
import { SchedulerRegistry } from "@/kernel/scheduler/scheduler-registry";
import { MigrationRegistry } from "@/kernel/storage/migrations";

export interface AppRegistries {
  routes: RouteRegistry;
  navigation: NavigationRegistry;
  commands: CommandRegistry;
  queries: QueryRegistry;
  scheduler: SchedulerRegistry;
  settings: SettingsRegistry;
  migrations: MigrationRegistry;
}

export function createAppRegistries(): AppRegistries {
  return {
    routes: new RouteRegistry(),
    navigation: new NavigationRegistry(),
    commands: new CommandRegistry(),
    queries: new QueryRegistry(),
    scheduler: new SchedulerRegistry(),
    settings: new SettingsRegistry(),
    migrations: new MigrationRegistry()
  };
}

export function createFeatureRegistrationContext(
  registries: AppRegistries
): FeatureRegistrationContext {
  return registries;
}
