<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import {
  localDateTimeInputToInstant,
  toRelativeLocalDateTimeInputValue
} from "@/shared/time/local-date-time";
import {
  REMINDER_COMMANDS,
  REMINDER_QUERIES,
  type CreateOneTimeReminderPayload,
  type ReminderView
} from "../use-cases/reminder-use-cases";
import { useFeatureRuntime } from "./use-feature-runtime";

const runtime = useFeatureRuntime();
const title = ref("");
const message = ref("");
const fireAtLocal = ref("");
const reminders = ref<ReminderView[]>([]);
const statusLine = ref("");
const statusIsError = ref(false);
const quickFireAtSeconds = ref(5 * 60);
const isFireAtRolling = ref(true);
let refreshId: ReturnType<typeof setInterval> | undefined;

const canCreate = computed(() => {
  return title.value.trim().length > 0 && fireAtLocal.value.length > 0;
});

onMounted(() => {
  updateRollingFireAt();
  void loadReminders();
  refreshId = setInterval(() => {
    updateRollingFireAt();
    void loadReminders();
  }, 1000);
});

onBeforeUnmount(() => {
  if (refreshId) {
    clearInterval(refreshId);
  }
});

async function loadReminders(): Promise<void> {
  const result = await runtime.queries.execute<void, ReminderView[]>(REMINDER_QUERIES.LIST);

  if (result.ok) {
    reminders.value = result.value;
  }
}

async function createReminder(): Promise<void> {
  const fireAtUtc = localDateTimeInputToInstant(fireAtLocal.value);

  if (!fireAtUtc) {
    showStatus("Reminder time is invalid.", true);
    return;
  }

  const payload: CreateOneTimeReminderPayload = {
    title: title.value,
    message: message.value,
    fireAtUtc
  };
  const result = await runtime.commands.execute<CreateOneTimeReminderPayload, ReminderView>(
    REMINDER_COMMANDS.CREATE_ONE_TIME,
    payload
  );

  if (!result.ok) {
    showStatus(result.error.message, true);
    return;
  }

  title.value = "";
  message.value = "";
  setRelativeFireAt(5 * 60);
  showStatus("Reminder created.", false);
  await loadReminders();
}

async function runReminderCommand(command: string, id: string): Promise<void> {
  const result = await runtime.commands.execute(command, { id });

  if (!result.ok) {
    showStatus(result.error.message, true);
    return;
  }

  showStatus("Reminder updated.", false);
  await loadReminders();
}

async function snoozeReminder(id: string, snoozeSeconds: number): Promise<void> {
  const result = await runtime.commands.execute(REMINDER_COMMANDS.SNOOZE, {
    id,
    snoozeSeconds
  });

  if (!result.ok) {
    showStatus(result.error.message, true);
    return;
  }

  showStatus("Reminder snoozed.", false);
  await loadReminders();
}

function setRelativeFireAt(seconds: number): void {
  quickFireAtSeconds.value = seconds;
  isFireAtRolling.value = true;
  updateRollingFireAt();
}

function updateRollingFireAt(): void {
  if (!isFireAtRolling.value) {
    return;
  }

  fireAtLocal.value = toRelativeLocalDateTimeInputValue(new Date(), quickFireAtSeconds.value);
}

function markFireAtEdited(): void {
  isFireAtRolling.value = false;
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(runtime.preferredLocale, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatCountdown(seconds: number): string {
  const safe = Math.max(0, seconds);
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;

  if (h > 0) {
    return `${h}h ${m}m`;
  }

  if (m > 0) {
    return `${m}m ${s}s`;
  }

  return `${s}s`;
}

function statusLabel(reminder: ReminderView): string {
  if (reminder.status === "snoozed") {
    return `snoozed until ${formatDateTime(reminder.nextFireAtUtc)}`;
  }

  if (reminder.status === "enabled") {
    return `in ${formatCountdown(reminder.secondsUntilNext)}`;
  }

  return reminder.status;
}

function showStatus(messageText: string, isError: boolean): void {
  statusLine.value = messageText;
  statusIsError.value = isError;
}
</script>

<template>
  <section class="page reminders-page">
    <header class="page-header">
      <div>
        <h1 class="page-title">Reminders</h1>
        <p class="page-subtitle">One-time reminders with snooze, done and restart recovery.</p>
      </div>
      <p class="status-line" :class="{ error: statusIsError }" role="status">
        {{ statusLine }}
      </p>
    </header>

    <div class="surface">
      <form class="section reminder-form" @submit.prevent="createReminder">
        <label class="field reminder-title-field">
          <span>Title</span>
          <input v-model="title" name="reminder-title" autocomplete="off" placeholder="Reminder title" />
        </label>
        <label class="field reminder-message-field">
          <span>Message</span>
          <input v-model="message" name="reminder-message" autocomplete="off" placeholder="Optional" />
        </label>
        <label class="field">
          <span>Time</span>
          <input
            v-model="fireAtLocal"
            name="reminder-time"
            type="datetime-local"
            @focus="markFireAtEdited"
            @input="markFireAtEdited"
          />
        </label>
        <button class="primary-button" type="submit" :disabled="!canCreate">Create</button>
      </form>

      <div class="section preset-row" aria-label="Reminder quick times">
        <button class="secondary-button" type="button" @click="setRelativeFireAt(5 * 60)">
          5m
        </button>
        <button class="secondary-button" type="button" @click="setRelativeFireAt(15 * 60)">
          15m
        </button>
        <button class="secondary-button" type="button" @click="setRelativeFireAt(60 * 60)">
          1h
        </button>
      </div>
    </div>

    <div class="surface section timer-panel">
      <div class="section-header">
        <h2>Scheduled</h2>
      </div>
      <div v-if="reminders.length === 0" class="empty-state">No reminders.</div>
      <div v-else class="timer-list" aria-label="Reminders">
        <article v-for="reminder in reminders" :key="reminder.id" class="timer-item reminder-item">
          <div class="timer-main">
            <p class="timer-title">{{ reminder.title }}</p>
            <div class="timer-meta">
              <span>{{ statusLabel(reminder) }}</span>
              <span>{{ formatDateTime(reminder.fireAtUtc) }}</span>
            </div>
            <p v-if="reminder.message" class="reminder-message">{{ reminder.message }}</p>
          </div>

          <div class="timer-actions">
            <button
              v-if="reminder.status === 'enabled'"
              class="secondary-button"
              type="button"
              @click="runReminderCommand(REMINDER_COMMANDS.DISABLE, reminder.id)"
            >
              Disable
            </button>
            <button
              v-if="reminder.status === 'disabled'"
              class="primary-button"
              type="button"
              @click="runReminderCommand(REMINDER_COMMANDS.ENABLE, reminder.id)"
            >
              Enable
            </button>
            <button
              v-if="reminder.status === 'snoozed'"
              class="secondary-button"
              type="button"
              @click="runReminderCommand(REMINDER_COMMANDS.DISABLE, reminder.id)"
            >
              Disable
            </button>
            <button
              v-if="reminder.status === 'due'"
              class="primary-button"
              type="button"
              @click="runReminderCommand(REMINDER_COMMANDS.DONE, reminder.id)"
            >
              Done
            </button>
            <button
              v-if="reminder.status === 'due'"
              class="secondary-button"
              type="button"
              @click="snoozeReminder(reminder.id, 5 * 60)"
            >
              Snooze 5m
            </button>
            <button
              v-if="reminder.status === 'due'"
              class="secondary-button"
              type="button"
              @click="snoozeReminder(reminder.id, 15 * 60)"
            >
              Snooze 15m
            </button>
            <button
              class="danger-button"
              type="button"
              @click="runReminderCommand(REMINDER_COMMANDS.DELETE, reminder.id)"
            >
              Delete
            </button>
          </div>
        </article>
      </div>
    </div>
  </section>
</template>
