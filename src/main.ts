import { createApp } from "vue";
import App from "./App.vue";
import "./styles.css";
import { APP_RUNTIME_INJECTION_KEY } from "@/kernel/runtime/ui-runtime";
import { createAppRuntime } from "@/platform/bootstrap/runtime";

const runtime = createAppRuntime();
const app = createApp(App, { runtime });

app.provide(APP_RUNTIME_INJECTION_KEY, {
  commands: runtime.commands,
  queries: runtime.queries
});

app.mount("#app");

void runtime.schedulerLoop.reconcileOnce();
runtime.schedulerLoop.start();

window.addEventListener("beforeunload", () => {
  runtime.schedulerLoop.stop();
});
