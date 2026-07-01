import type { CommandBus } from "@/kernel/commands/command-registry";
import type { QueryBus } from "@/kernel/queries/query-registry";

export const APP_RUNTIME_INJECTION_KEY = "app-runtime";

export interface FeatureUiRuntime {
  commands: CommandBus;
  queries: QueryBus;
}
