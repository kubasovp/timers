<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import {
  CUSTOM_TIMER_COMMANDS,
  CUSTOM_TIMER_QUERIES,
  type CustomTimerView,
  type StartCustomTimerPayload
} from "../use-cases/custom-timer-use-cases";
import type { CustomTimerPreset } from "../domain/custom-timer-types";
import { useFeatureRuntime } from "./use-feature-runtime";

const runtime = useFeatureRuntime();
const title = ref("");
const hours = ref(0);
const minutes = ref(1);
const seconds = ref(0);
const statusLine = ref("");
const statusIsError = ref(false);
const activeTimers = ref<CustomTimerView[]>([]);
const presets = ref<CustomTimerPreset[]>([]);
let refreshId: ReturnType<typeof setInterval> | undefined;

const canStart = computed(() => {
  return totalSeconds.value > 0;
});

const totalSeconds = computed(() => {
  return sanitizeNumber(hours.value) * 3600 + sanitizeNumber(minutes.value) * 60 + sanitizeNumber(seconds.value);
});

onMounted(() => {
  void loadAll();
  refreshId = setInterval(() => {
    void loadActiveTimers();
  }, 500);
});

onBeforeUnmount(() => {
  if (refreshId) {
    clearInterval(refreshId);
  }
});

async function loadAll(): Promise<void> {
  await Promise.all([loadActiveTimers(), loadPresets()]);
}

async function loadActiveTimers(): Promise<void> {
  const result = await runtime.queries.execute<void, CustomTimerView[]>(
    CUSTOM_TIMER_QUERIES.LIST_ACTIVE
  );

  if (result.ok) {
    activeTimers.value = result.value;
  }
}

async function loadPresets(): Promise<void> {
  const result = await runtime.queries.execute<void, CustomTimerPreset[]>(
    CUSTOM_TIMER_QUERIES.LIST_PRESETS
  );

  if (result.ok) {
    presets.value = result.value;
  }
}

async function startTimer(payload?: Partial<StartCustomTimerPayload>): Promise<void> {
  const command: StartCustomTimerPayload = {
    title: title.value,
    hours: sanitizeNumber(hours.value),
    minutes: sanitizeNumber(minutes.value),
    seconds: sanitizeNumber(seconds.value),
    ...payload
  };

  const result = await runtime.commands.execute<StartCustomTimerPayload, CustomTimerView>(
    CUSTOM_TIMER_COMMANDS.START,
    command
  );

  if (!result.ok) {
    showStatus(result.error.message, true);
    return;
  }

  showStatus("Timer started.", false);
  title.value = "";
  await loadActiveTimers();
}

async function runTimerCommand(command: string, id: string): Promise<void> {
  const result = await runtime.commands.execute(command, { id });

  if (!result.ok) {
    showStatus(result.error.message, true);
    return;
  }

  showStatus("Timer updated.", false);
  await loadActiveTimers();
}

function applyPreset(preset: CustomTimerPreset): void {
  hours.value = Math.floor(preset.durationTotalSec / 3600);
  minutes.value = Math.floor((preset.durationTotalSec % 3600) / 60);
  seconds.value = preset.durationTotalSec % 60;
  void startTimer({
    title: preset.name,
    durationTotalSec: preset.durationTotalSec,
    presetId: preset.id
  });
}

function formatRemaining(value: number): string {
  const safe = Math.max(0, value);
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;

  return h > 0
    ? `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
    : `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDuration(value: number): string {
  const m = Math.floor(value / 60);
  const s = value % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function sanitizeNumber(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function showStatus(message: string, isError: boolean): void {
  statusLine.value = message;
  statusIsError.value = isError;
}
</script>

<template>
  <section class="page">
    <header class="page-header">
      <div>
        <h1 class="page-title">Timers</h1>
        <p class="page-subtitle">Run multiple custom timers and recover them after restart.</p>
      </div>
      <p class="status-line" :class="{ error: statusIsError }" role="status">
        {{ statusLine }}
      </p>
    </header>

    <div class="surface">
      <form class="section form-grid" @submit.prevent="startTimer()">
        <label class="field">
          <span>Title</span>
          <input v-model="title" name="title" autocomplete="off" placeholder="Optional" />
        </label>
        <label class="field">
          <span>Hours</span>
          <input v-model.number="hours" name="hours" type="number" min="0" max="99" />
        </label>
        <label class="field">
          <span>Minutes</span>
          <input v-model.number="minutes" name="minutes" type="number" min="0" max="59" />
        </label>
        <label class="field">
          <span>Seconds</span>
          <input v-model.number="seconds" name="seconds" type="number" min="0" max="59" />
        </label>
        <button class="primary-button" type="submit" :disabled="!canStart">Start</button>
      </form>

      <div class="section preset-row" aria-label="Timer presets">
        <button
          v-for="preset in presets"
          :key="preset.id"
          class="secondary-button"
          type="button"
          @click="applyPreset(preset)"
        >
          {{ preset.name }}
        </button>
      </div>
    </div>

    <div class="surface section">
      <div v-if="activeTimers.length === 0" class="empty-state">No active timers.</div>
      <div v-else class="timer-list" aria-label="Active timers">
        <article v-for="timer in activeTimers" :key="timer.id" class="timer-item">
          <div class="timer-main">
            <p class="timer-title">{{ timer.title }}</p>
            <div class="timer-meta">
              <span>{{ timer.status }}</span>
              <span>{{ formatDuration(timer.durationTotalSec) }}</span>
            </div>
          </div>

          <div class="timer-remaining">{{ formatRemaining(timer.remainingSeconds) }}</div>

          <div class="timer-actions">
            <button
              v-if="timer.status === 'running'"
              class="secondary-button"
              type="button"
              @click="runTimerCommand(CUSTOM_TIMER_COMMANDS.PAUSE, timer.id)"
            >
              Pause
            </button>
            <button
              v-if="timer.status === 'paused'"
              class="primary-button"
              type="button"
              @click="runTimerCommand(CUSTOM_TIMER_COMMANDS.RESUME, timer.id)"
            >
              Resume
            </button>
            <button
              class="secondary-button"
              type="button"
              @click="runTimerCommand(CUSTOM_TIMER_COMMANDS.RESTART, timer.id)"
            >
              Restart
            </button>
            <button
              class="danger-button"
              type="button"
              @click="runTimerCommand(CUSTOM_TIMER_COMMANDS.STOP, timer.id)"
            >
              Stop
            </button>
          </div>
        </article>
      </div>
    </div>
  </section>
</template>
