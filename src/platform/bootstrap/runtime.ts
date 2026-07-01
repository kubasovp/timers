import { CommandBus } from "@/kernel/commands/command-registry";
import { QueryBus } from "@/kernel/queries/query-registry";
import {
  createAppRegistries,
  createFeatureRegistrationContext,
  type AppRegistries
} from "@/kernel/registries/app-registries";
import type { Migration } from "@/kernel/storage/migrations";
import { createCustomTimerFeature } from "@/features/custom-timer";
import { BrowserCustomTimerRepository } from "@/features/custom-timer/persistence/browser-custom-timer-repository";
import { SystemClock } from "@/platform/clock/system-clock";
import { BrowserNotificationAdapter } from "@/platform/notifications/browser-notification-adapter";
import { BrowserSchedulerDispatchStore } from "@/platform/scheduler-loop/scheduler-dispatch-store";
import { SchedulerLoop } from "@/platform/scheduler-loop/scheduler-loop";
import { systemMigrations } from "@/platform/sqlite/system-migrations";
import { registerShellPlaceholders } from "./shell-placeholders";

export interface AppRuntime {
  registries: AppRegistries;
  commands: CommandBus;
  queries: QueryBus;
  schedulerLoop: SchedulerLoop;
  migrations: Migration[];
}

export function createAppRuntime(): AppRuntime {
  const registries = createAppRegistries();
  const context = createFeatureRegistrationContext(registries);
  const clock = new SystemClock();
  const repository = new BrowserCustomTimerRepository();

  registerShellPlaceholders(context);

  createCustomTimerFeature({
    clock,
    repository
  }).register(context);

  registries.migrations.add(systemMigrations);

  const commands = new CommandBus(registries.commands);
  const queries = new QueryBus(registries.queries);
  const schedulerLoop = new SchedulerLoop({
    scheduler: registries.scheduler,
    clock,
    notifications: new BrowserNotificationAdapter(),
    dispatchStore: new BrowserSchedulerDispatchStore(),
    cadenceMs: 1000
  });

  return {
    registries,
    commands,
    queries,
    schedulerLoop,
    migrations: registries.migrations.list()
  };
}
