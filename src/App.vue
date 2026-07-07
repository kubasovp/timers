<script setup lang="ts">
import { computed, type Component } from "vue";
import type { AppRuntime } from "@/platform/bootstrap/runtime";
import packageInfo from "../package.json";

const props = defineProps<{
  runtime: AppRuntime;
}>();

const appVersion = import.meta.env.VITE_APP_VERSION ?? packageInfo.version;
const panels = computed(() =>
  props.runtime.registries.navigation
    .list()
    .map((item) => {
      const route = props.runtime.registries.routes.get(item.path);

      return route
        ? {
            item,
            route,
            component: route.component as Component
          }
        : null;
    })
    .filter((panel): panel is NonNullable<typeof panel> => panel !== null)
);
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <div class="brand">
        <span>Timers</span>
        <span class="app-version">v{{ appVersion }}</span>
      </div>
    </header>

    <main class="workspace">
      <section
        v-for="panel in panels"
        :key="panel.item.path"
        class="workspace-panel"
        :aria-label="panel.item.label"
      >
        <component :is="panel.component" v-bind="panel.route.props" />
      </section>
    </main>
  </div>
</template>
