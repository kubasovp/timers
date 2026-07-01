<script setup lang="ts">
defineProps<{
  title: string;
  summary: string;
}>();
</script>

<template>
  <section class="page placeholder">
    <header class="page-header">
      <div>
        <h1 class="page-title">{{ title }}</h1>
        <p class="page-subtitle">{{ summary }}</p>
      </div>
    </header>

    <div class="surface section">
      <p class="empty-state">This panel is registered as a shell placeholder for the MVP roadmap.</p>
    </div>
  </section>
</template>
