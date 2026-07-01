import type { FeatureRegistrationContext } from "@/kernel/feature-contract/feature-contract";
import PlaceholderPanel from "./PlaceholderPanel.vue";

export function registerShellPlaceholders(context: FeatureRegistrationContext): void {
  context.routes.add({
    path: "/reminders",
    label: "Reminders",
    featureId: "shell",
    component: PlaceholderPanel,
    props: {
      title: "Reminders",
      summary: "One-time and recurring reminders are scheduled after focus."
    }
  });
  context.navigation.add({
    path: "/reminders",
    label: "Reminders",
    featureId: "shell",
    order: 30
  });
}
