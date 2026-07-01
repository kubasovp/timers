import type { AppFeature } from "@/kernel/feature-contract/feature-contract";
import type { Clock } from "@/shared/time/clock";
import FocusPage from "./ui/FocusPage.vue";
import { focusManifest } from "./manifest";
import { focusMigrations } from "./migrations/v1";
import type { FocusRepository } from "./ports";
import { FocusSchedulerSource } from "./scheduler/focus-scheduler-source";
import {
  createFocusUseCases,
  FOCUS_COMMANDS,
  FOCUS_QUERIES
} from "./use-cases/focus-use-cases";

export interface FocusFeatureDependencies {
  repository: FocusRepository;
  clock: Clock;
}

export function createFocusFeature(dependencies: FocusFeatureDependencies): AppFeature {
  const useCases = createFocusUseCases(dependencies);

  return {
    id: focusManifest.id,
    title: focusManifest.title,
    version: focusManifest.version,
    register(context) {
      context.routes.add({
        path: "/focus",
        label: "Focus",
        featureId: focusManifest.id,
        component: FocusPage
      });
      context.navigation.add({
        path: "/focus",
        label: "Focus",
        featureId: focusManifest.id,
        order: 10
      });
      context.commands.add(FOCUS_COMMANDS.CREATE_PROFILE, useCases.createProfile);
      context.commands.add(FOCUS_COMMANDS.UPDATE_PROFILE, useCases.updateProfile);
      context.commands.add(FOCUS_COMMANDS.DELETE_PROFILE, useCases.deleteProfile);
      context.commands.add(FOCUS_COMMANDS.START_SESSION, useCases.startSession);
      context.commands.add(FOCUS_COMMANDS.PAUSE_SESSION, useCases.pauseSession);
      context.commands.add(FOCUS_COMMANDS.RESUME_SESSION, useCases.resumeSession);
      context.commands.add(FOCUS_COMMANDS.STOP_SESSION, useCases.stopSession);
      context.commands.add(FOCUS_COMMANDS.SKIP_PHASE, useCases.skipPhase);
      context.queries.add(FOCUS_QUERIES.LIST_PROFILES, useCases.listProfiles);
      context.queries.add(FOCUS_QUERIES.GET_ACTIVE_SESSION, useCases.getActiveSession);
      context.scheduler.addSource(new FocusSchedulerSource(dependencies.repository));
      context.migrations.add(focusMigrations);
    }
  };
}

export type {
  FocusPhase,
  FocusProfile,
  FocusSession,
  FocusSessionStatus
} from "./domain/focus-types";
export type { FocusRepository } from "./ports";
export { FOCUS_COMMANDS, FOCUS_QUERIES } from "./use-cases/focus-use-cases";
