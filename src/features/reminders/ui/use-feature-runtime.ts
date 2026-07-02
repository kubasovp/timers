import { inject } from "vue";
import {
  APP_RUNTIME_INJECTION_KEY,
  type FeatureUiRuntime
} from "@/kernel/runtime/ui-runtime";

export function useFeatureRuntime(): FeatureUiRuntime {
  const runtime = inject<FeatureUiRuntime>(APP_RUNTIME_INJECTION_KEY);

  if (!runtime) {
    throw new Error("Feature runtime was not provided.");
  }

  return runtime;
}
