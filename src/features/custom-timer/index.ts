import type { AppFeature } from "@/kernel/feature-contract/feature-contract";
import type { Clock } from "@/shared/time/clock";
import CustomTimerPage from "./ui/CustomTimerPage.vue";
import { customTimerManifest } from "./manifest";
import { customTimerMigrations } from "./migrations/v1";
import type { CustomTimerRepository } from "./ports";
import { CustomTimerSchedulerSource } from "./scheduler/custom-timer-scheduler-source";
import {
  createCustomTimerUseCases,
  CUSTOM_TIMER_COMMANDS,
  CUSTOM_TIMER_QUERIES
} from "./use-cases/custom-timer-use-cases";

export interface CustomTimerFeatureDependencies {
  repository: CustomTimerRepository;
  clock: Clock;
}

export function createCustomTimerFeature(
  dependencies: CustomTimerFeatureDependencies
): AppFeature {
  const useCases = createCustomTimerUseCases(dependencies);

  return {
    id: customTimerManifest.id,
    title: customTimerManifest.title,
    version: customTimerManifest.version,
    register(context) {
      context.routes.add({
        path: "/timers",
        label: "Timers",
        featureId: customTimerManifest.id,
        component: CustomTimerPage
      });
      context.navigation.add({
        path: "/timers",
        label: "Timers",
        featureId: customTimerManifest.id,
        order: 20
      });
      context.commands.add(CUSTOM_TIMER_COMMANDS.START, useCases.start);
      context.commands.add(CUSTOM_TIMER_COMMANDS.PAUSE, useCases.pause);
      context.commands.add(CUSTOM_TIMER_COMMANDS.RESUME, useCases.resume);
      context.commands.add(CUSTOM_TIMER_COMMANDS.STOP, useCases.stop);
      context.commands.add(CUSTOM_TIMER_COMMANDS.RESTART, useCases.restart);
      context.commands.add(CUSTOM_TIMER_COMMANDS.COMPLETE, useCases.complete);
      context.commands.add(CUSTOM_TIMER_COMMANDS.DELETE_COMPLETED, useCases.deleteCompleted);
      context.queries.add(CUSTOM_TIMER_QUERIES.LIST_ACTIVE, useCases.listActive);
      context.queries.add(CUSTOM_TIMER_QUERIES.LIST_COMPLETED, useCases.listCompleted);
      context.queries.add(CUSTOM_TIMER_QUERIES.LIST_PRESETS, useCases.listPresets);
      context.scheduler.addSource(new CustomTimerSchedulerSource(dependencies.repository));
      context.migrations.add(customTimerMigrations);
    }
  };
}

export type {
  CustomTimerPreset,
  CustomTimerSession,
  CustomTimerSessionStatus
} from "./domain/custom-timer-types";
export type { CustomTimerRepository } from "./ports";
export {
  CUSTOM_TIMER_COMMANDS,
  CUSTOM_TIMER_QUERIES
} from "./use-cases/custom-timer-use-cases";
