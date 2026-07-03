import type { AppFeature } from "@/kernel/feature-contract/feature-contract";
import type { Clock } from "@/shared/time/clock";
import { reminderMigrations } from "./migrations/v1";
import { remindersManifest } from "./manifest";
import type { ReminderRepository } from "./ports";
import { ReminderSchedulerSource } from "./scheduler/reminder-scheduler-source";
import RemindersPage from "./ui/RemindersPage.vue";
import {
  DEFAULT_SNOOZE_PRESET_SECONDS,
  createReminderUseCases,
  REMINDER_COMMANDS,
  REMINDER_QUERIES
} from "./use-cases/reminder-use-cases";

export interface ReminderFeatureDependencies {
  repository: ReminderRepository;
  clock: Clock;
}

export function createReminderFeature(dependencies: ReminderFeatureDependencies): AppFeature {
  const useCases = createReminderUseCases(dependencies);

  return {
    id: remindersManifest.id,
    title: remindersManifest.title,
    version: remindersManifest.version,
    register(context) {
      context.routes.add({
        path: "/reminders",
        label: "Reminders",
        featureId: remindersManifest.id,
        component: RemindersPage
      });
      context.navigation.add({
        path: "/reminders",
        label: "Reminders",
        featureId: remindersManifest.id,
        order: 30
      });
      context.commands.add(REMINDER_COMMANDS.CREATE_ONE_TIME, useCases.createOneTime);
      context.commands.add(REMINDER_COMMANDS.CREATE_DAILY, useCases.createDaily);
      context.commands.add(REMINDER_COMMANDS.CREATE_INTERVAL, useCases.createInterval);
      context.commands.add(REMINDER_COMMANDS.ENABLE, useCases.enable);
      context.commands.add(REMINDER_COMMANDS.DISABLE, useCases.disable);
      context.commands.add(REMINDER_COMMANDS.DELETE, useCases.delete);
      context.commands.add(REMINDER_COMMANDS.DONE, useCases.done);
      context.commands.add(REMINDER_COMMANDS.SNOOZE, useCases.snooze);
      context.queries.add(REMINDER_QUERIES.LIST, useCases.list);
      context.settings.add({
        key: "reminders.snoozePresetsSeconds",
        featureId: remindersManifest.id,
        schemaVersion: 1,
        defaultValue: [...DEFAULT_SNOOZE_PRESET_SECONDS]
      });
      context.scheduler.addSource(new ReminderSchedulerSource(dependencies.repository));
      context.migrations.add(reminderMigrations);
    }
  };
}

export type {
  Reminder,
  ReminderOccurrence,
  ReminderStatus
} from "./domain/reminder-types";
export type { ReminderRepository } from "./ports";
export { REMINDER_COMMANDS, REMINDER_QUERIES } from "./use-cases/reminder-use-cases";
