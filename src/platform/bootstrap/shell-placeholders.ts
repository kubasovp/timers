import type { FeatureRegistrationContext } from "@/kernel/feature-contract/feature-contract";
import PlaceholderPanel from "./PlaceholderPanel.vue";

export function registerShellPlaceholders(context: FeatureRegistrationContext): void {
  context.routes.add({
    path: "/focus",
    label: "Focus",
    featureId: "shell",
    component: PlaceholderPanel,
    props: {
      title: "Focus",
      summary: "Profiles and phase sessions arrive after the custom timer slice."
    }
  });
  context.navigation.add({
    path: "/focus",
    label: "Focus",
    featureId: "shell",
    order: 10
  });

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
