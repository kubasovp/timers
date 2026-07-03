import { createApp } from "vue";
import App from "./App.vue";
import "./styles.css";
import { APP_RUNTIME_INJECTION_KEY } from "@/kernel/runtime/ui-runtime";
import { createAppRuntime } from "@/platform/bootstrap/runtime";

async function bootstrap(): Promise<void> {
  const runtime = await createAppRuntime();
  await runtime.schedulerLoop.reconcileOnce();

  const app = createApp(App, { runtime });

  app.provide(APP_RUNTIME_INJECTION_KEY, {
    commands: runtime.commands,
    queries: runtime.queries,
    preferredLocale: runtime.preferredLocale
  });

  if (runtime.preferredLocale) {
    document.documentElement.lang = runtime.preferredLocale;
  }

  app.mount("#app");
  runtime.schedulerLoop.start();

  window.addEventListener("beforeunload", () => {
    void runtime.dispose();
  });
}

void bootstrap().catch((error) => {
  console.error(error);

  const root = document.getElementById("app");

  if (root) {
    root.textContent = "Failed to start Timers.";
  }
});
