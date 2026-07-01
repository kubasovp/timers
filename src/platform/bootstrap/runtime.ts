import { isTauri } from "@tauri-apps/api/core";
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
import { createDefaultTimerPresets } from "@/features/custom-timer/persistence/default-presets";
import { SqlCustomTimerRepository } from "@/features/custom-timer/persistence/sql-custom-timer-repository";
import type { CustomTimerRepository } from "@/features/custom-timer/ports";
import { createFocusFeature } from "@/features/focus";
import { BrowserFocusRepository } from "@/features/focus/persistence/browser-focus-repository";
import { createDefaultFocusProfiles } from "@/features/focus/persistence/default-profiles";
import { SqlFocusRepository } from "@/features/focus/persistence/sql-focus-repository";
import type { FocusRepository } from "@/features/focus/ports";
import { SystemClock } from "@/platform/clock/system-clock";
import { BrowserNotificationAdapter } from "@/platform/notifications/browser-notification-adapter";
import {
  BrowserSchedulerDispatchStore,
  type SchedulerDispatchStore
} from "@/platform/scheduler-loop/scheduler-dispatch-store";
import { SchedulerLoop } from "@/platform/scheduler-loop/scheduler-loop";
import { SqliteMigrationRunner } from "@/platform/sqlite/migration-runner";
import { SqlSchedulerDispatchStore } from "@/platform/sqlite/sql-scheduler-dispatch-store";
import { systemMigrations } from "@/platform/sqlite/system-migrations";
import {
  openTauriSqliteDatabase,
  type TauriSqliteDatabaseConnection
} from "@/platform/sqlite/tauri-sqlite-database";
import { registerShellPlaceholders } from "./shell-placeholders";

export interface AppRuntime {
  registries: AppRegistries;
  commands: CommandBus;
  queries: QueryBus;
  schedulerLoop: SchedulerLoop;
  migrations: Migration[];
  storageMode: "browser" | "native-sqlite";
  dispose(): Promise<void>;
}

interface RuntimeStorage {
  mode: AppRuntime["storageMode"];
  customTimerRepository: CustomTimerRepository;
  focusRepository: FocusRepository;
  schedulerDispatchStore: SchedulerDispatchStore;
  migrationRunner?: SqliteMigrationRunner;
  database?: TauriSqliteDatabaseConnection;
}

export async function createAppRuntime(): Promise<AppRuntime> {
  const registries = createAppRegistries();
  const context = createFeatureRegistrationContext(registries);
  const clock = new SystemClock();
  const storage = await createRuntimeStorage();

  registerShellPlaceholders(context);

  createFocusFeature({
    clock,
    repository: storage.focusRepository
  }).register(context);

  createCustomTimerFeature({
    clock,
    repository: storage.customTimerRepository
  }).register(context);

  registries.migrations.add(systemMigrations);
  const migrations = registries.migrations.list();

  if (storage.migrationRunner) {
    await storage.migrationRunner.apply(migrations);
    await ensureFocusProfiles(storage.focusRepository, clock);
    await ensureCustomTimerPresets(storage.customTimerRepository, clock);
  }

  const commands = new CommandBus(registries.commands);
  const queries = new QueryBus(registries.queries);
  const schedulerLoop = new SchedulerLoop({
    scheduler: registries.scheduler,
    clock,
    notifications: new BrowserNotificationAdapter(),
    dispatchStore: storage.schedulerDispatchStore,
    cadenceMs: 1000
  });

  return {
    registries,
    commands,
    queries,
    schedulerLoop,
    migrations,
    storageMode: storage.mode,
    async dispose() {
      schedulerLoop.stop();
      await storage.database?.close();
    }
  };
}

async function createRuntimeStorage(): Promise<RuntimeStorage> {
  if (!isTauri()) {
    return {
      mode: "browser",
      customTimerRepository: new BrowserCustomTimerRepository(),
      focusRepository: new BrowserFocusRepository(),
      schedulerDispatchStore: new BrowserSchedulerDispatchStore()
    };
  }

  const database = await openTauriSqliteDatabase();

  return {
    mode: "native-sqlite",
    customTimerRepository: new SqlCustomTimerRepository(database),
    focusRepository: new SqlFocusRepository(database),
    schedulerDispatchStore: new SqlSchedulerDispatchStore(database),
    migrationRunner: new SqliteMigrationRunner(database),
    database
  };
}

async function ensureFocusProfiles(
  repository: FocusRepository,
  clock: SystemClock
): Promise<void> {
  const profiles = await repository.listProfiles();

  if (profiles.length > 0) {
    return;
  }

  await Promise.all(
    createDefaultFocusProfiles(clock.now()).map((profile) => repository.saveProfile(profile))
  );
}

async function ensureCustomTimerPresets(
  repository: CustomTimerRepository,
  clock: SystemClock
): Promise<void> {
  const presets = await repository.listPresets();

  if (presets.length > 0) {
    return;
  }

  await Promise.all(
    createDefaultTimerPresets(clock.now()).map((preset) => repository.savePreset(preset))
  );
}
