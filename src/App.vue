<script setup lang="ts">
import { computed, ref, type Component } from "vue";
import type { AppRuntime } from "@/platform/bootstrap/runtime";

const props = defineProps<{
  runtime: AppRuntime;
}>();

const navigationItems = computed(() => props.runtime.registries.navigation.list());
const currentPath = ref(navigationItems.value[0]?.path ?? "/timers");

const activeRoute = computed(() => {
  return (
    props.runtime.registries.routes.get(currentPath.value) ??
    props.runtime.registries.routes.list()[0]
  );
});

const activeComponent = computed(() => activeRoute.value?.component as Component | undefined);
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar" aria-label="Primary">
      <div class="brand">
        <span class="brand-mark" aria-hidden="true"></span>
        <span>Timers</span>
      </div>

      <nav class="nav-list">
        <button
          v-for="item in navigationItems"
          :key="item.path"
          class="nav-item"
          :class="{ active: item.path === currentPath }"
          type="button"
          @click="currentPath = item.path"
        >
          {{ item.label }}
        </button>
      </nav>
    </aside>

    <main class="workspace">
      <component
        :is="activeComponent"
        v-if="activeComponent && activeRoute"
        v-bind="activeRoute.props"
      />
    </main>
  </div>
</template>
