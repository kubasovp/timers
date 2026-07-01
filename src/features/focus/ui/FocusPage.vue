<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import type { FocusProfile } from "../domain/focus-types";
import {
  FOCUS_COMMANDS,
  FOCUS_QUERIES,
  type FocusProfilePayload,
  type FocusSessionView,
  type UpdateFocusProfilePayload
} from "../use-cases/focus-use-cases";
import { useFeatureRuntime } from "./use-feature-runtime";

const runtime = useFeatureRuntime();
const profiles = ref<FocusProfile[]>([]);
const activeSession = ref<FocusSessionView | null>(null);
const selectedProfileId = ref("");
const editingProfileId = ref<string | null>(null);
const profileName = ref("");
const focusMinutes = ref(25);
const shortBreakMinutes = ref(5);
const longBreakMinutes = ref(15);
const cyclesBeforeLongBreak = ref(4);
const statusLine = ref("");
const statusIsError = ref(false);
let refreshId: ReturnType<typeof setInterval> | undefined;

const selectedProfile = computed(() => {
  return profiles.value.find((profile) => profile.id === selectedProfileId.value) ?? null;
});

const isEditing = computed(() => editingProfileId.value !== null);

const canSaveProfile = computed(() => {
  return (
    profileName.value.trim().length > 0 &&
    sanitizeNumber(focusMinutes.value) > 0 &&
    sanitizeNumber(shortBreakMinutes.value) > 0 &&
    sanitizeNumber(longBreakMinutes.value) > 0 &&
    sanitizeNumber(cyclesBeforeLongBreak.value) > 0
  );
});

const isRunningSession = computed(() => {
  return (
    activeSession.value?.status === "running_focus" ||
    activeSession.value?.status === "running_break"
  );
});

const isPausedSession = computed(() => {
  return (
    activeSession.value?.status === "paused_focus" ||
    activeSession.value?.status === "paused_break"
  );
});

const skipButtonLabel = computed(() => {
  return activeSession.value?.currentPhase === "focus" ? "Skip phase" : "Skip break";
});

const phaseProgressPercent = computed(() => {
  const session = activeSession.value;

  if (!session || session.phaseDurationSec <= 0) {
    return 0;
  }

  const elapsed = Math.max(0, session.phaseDurationSec - session.remainingSeconds);
  return Math.min(100, Math.round((elapsed / session.phaseDurationSec) * 100));
});

onMounted(() => {
  void loadAll();
  refreshId = setInterval(() => {
    void loadActiveSession();
  }, 500);
});

onBeforeUnmount(() => {
  if (refreshId) {
    clearInterval(refreshId);
  }
});

async function loadAll(): Promise<void> {
  await Promise.all([loadProfiles(), loadActiveSession()]);
}

async function loadProfiles(): Promise<void> {
  const result = await runtime.queries.execute<void, FocusProfile[]>(
    FOCUS_QUERIES.LIST_PROFILES
  );

  if (!result.ok) {
    showStatus(result.error.message, true);
    return;
  }

  profiles.value = result.value;

  if (!selectedProfileId.value || !result.value.some((profile) => profile.id === selectedProfileId.value)) {
    selectedProfileId.value = result.value[0]?.id ?? "";
  }
}

async function loadActiveSession(): Promise<void> {
  const result = await runtime.queries.execute<void, FocusSessionView | null>(
    FOCUS_QUERIES.GET_ACTIVE_SESSION
  );

  if (result.ok) {
    activeSession.value = result.value;
  }
}

async function startSession(profileId = selectedProfileId.value): Promise<void> {
  if (!profileId) {
    showStatus("Create a focus profile first.", true);
    return;
  }

  const result = await runtime.commands.execute<{ profileId: string }, FocusSessionView>(
    FOCUS_COMMANDS.START_SESSION,
    { profileId }
  );

  if (!result.ok) {
    showStatus(result.error.message, true);
    return;
  }

  showStatus("Focus session started.", false);
  activeSession.value = result.value;
}

async function runSessionCommand(command: string): Promise<void> {
  const session = activeSession.value;

  if (!session) {
    return;
  }

  const result = await runtime.commands.execute(command, { id: session.id });

  if (!result.ok) {
    showStatus(result.error.message, true);
    return;
  }

  showStatus("Focus session updated.", false);
  await loadActiveSession();
}

async function submitProfile(): Promise<void> {
  const payload = buildProfilePayload();
  const result = editingProfileId.value
    ? await runtime.commands.execute<UpdateFocusProfilePayload, FocusProfile>(
        FOCUS_COMMANDS.UPDATE_PROFILE,
        { id: editingProfileId.value, ...payload }
      )
    : await runtime.commands.execute<FocusProfilePayload, FocusProfile>(
        FOCUS_COMMANDS.CREATE_PROFILE,
        payload
      );

  if (!result.ok) {
    showStatus(result.error.message, true);
    return;
  }

  showStatus(editingProfileId.value ? "Focus profile updated." : "Focus profile created.", false);
  resetProfileForm();
  await loadProfiles();
}

async function deleteProfile(profile: FocusProfile): Promise<void> {
  const result = await runtime.commands.execute(FOCUS_COMMANDS.DELETE_PROFILE, { id: profile.id });

  if (!result.ok) {
    showStatus(result.error.message, true);
    return;
  }

  showStatus("Focus profile deleted.", false);
  if (selectedProfileId.value === profile.id) {
    selectedProfileId.value = "";
  }
  await loadProfiles();
}

function editProfile(profile: FocusProfile): void {
  editingProfileId.value = profile.id;
  profileName.value = profile.name;
  focusMinutes.value = secondsToMinutes(profile.focusDurationSec);
  shortBreakMinutes.value = secondsToMinutes(profile.shortBreakSec);
  longBreakMinutes.value = secondsToMinutes(profile.longBreakSec);
  cyclesBeforeLongBreak.value = profile.cyclesBeforeLongBreak;
}

function resetProfileForm(): void {
  editingProfileId.value = null;
  profileName.value = "";
  focusMinutes.value = 25;
  shortBreakMinutes.value = 5;
  longBreakMinutes.value = 15;
  cyclesBeforeLongBreak.value = 4;
}

function buildProfilePayload(): FocusProfilePayload {
  return {
    name: profileName.value,
    focusDurationSec: sanitizeNumber(focusMinutes.value) * 60,
    shortBreakSec: sanitizeNumber(shortBreakMinutes.value) * 60,
    longBreakSec: sanitizeNumber(longBreakMinutes.value) * 60,
    cyclesBeforeLongBreak: sanitizeNumber(cyclesBeforeLongBreak.value)
  };
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
  const minutes = Math.floor(value / 60);
  return minutes >= 60
    ? `${Math.floor(minutes / 60)}h ${minutes % 60}m`
    : `${minutes}m`;
}

function formatPhase(phase: FocusSessionView["currentPhase"]): string {
  if (phase === "focus") {
    return "Focus";
  }

  return phase === "short_break" ? "Short break" : "Long break";
}

function secondsToMinutes(value: number): number {
  return Math.max(1, Math.round(value / 60));
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
  <section class="page focus-page">
    <header class="page-header">
      <div>
        <h1 class="page-title">Focus</h1>
        <p class="page-subtitle">Profiles, cycles and phase recovery.</p>
      </div>
      <p class="status-line" :class="{ error: statusIsError }" role="status">
        {{ statusLine }}
      </p>
    </header>

    <div class="surface section">
      <div v-if="activeSession" class="focus-session">
        <div class="focus-session-main">
          <div>
            <p class="timer-title">{{ activeSession.title }}</p>
            <div class="timer-meta">
              <span>{{ formatPhase(activeSession.currentPhase) }}</span>
              <span>Cycle {{ activeSession.cycleIndex }}/{{ activeSession.totalCycles }}</span>
              <span>{{ activeSession.status }}</span>
            </div>
          </div>
          <div class="focus-time">{{ formatRemaining(activeSession.remainingSeconds) }}</div>
        </div>

        <div class="progress-track" aria-hidden="true">
          <div class="progress-fill" :style="{ width: `${phaseProgressPercent}%` }"></div>
        </div>

        <div class="timer-actions">
          <button
            v-if="isRunningSession"
            class="secondary-button"
            type="button"
            @click="runSessionCommand(FOCUS_COMMANDS.PAUSE_SESSION)"
          >
            Pause
          </button>
          <button
            v-if="isPausedSession"
            class="primary-button"
            type="button"
            @click="runSessionCommand(FOCUS_COMMANDS.RESUME_SESSION)"
          >
            Resume
          </button>
          <button
            v-if="isRunningSession"
            class="secondary-button"
            type="button"
            @click="runSessionCommand(FOCUS_COMMANDS.SKIP_PHASE)"
          >
            {{ skipButtonLabel }}
          </button>
          <button
            class="danger-button"
            type="button"
            @click="runSessionCommand(FOCUS_COMMANDS.STOP_SESSION)"
          >
            Stop session
          </button>
        </div>
      </div>

      <div v-else class="focus-start">
        <label class="field">
          <span>Profile</span>
          <select v-model="selectedProfileId" name="profile">
            <option v-for="profile in profiles" :key="profile.id" :value="profile.id">
              {{ profile.name }}
            </option>
          </select>
        </label>
        <div v-if="selectedProfile" class="profile-summary">
          <span>{{ formatDuration(selectedProfile.focusDurationSec) }} focus</span>
          <span>{{ formatDuration(selectedProfile.shortBreakSec) }} short</span>
          <span>{{ formatDuration(selectedProfile.longBreakSec) }} long</span>
          <span>{{ selectedProfile.cyclesBeforeLongBreak }} cycles</span>
        </div>
        <button
          class="primary-button"
          type="button"
          :disabled="!selectedProfileId"
          @click="startSession()"
        >
          Start
        </button>
      </div>
    </div>

    <div class="surface">
      <form class="section profile-form" @submit.prevent="submitProfile()">
        <label class="field profile-name-field">
          <span>Name</span>
          <input v-model="profileName" name="profile-name" autocomplete="off" placeholder="Profile name" />
        </label>
        <label class="field">
          <span>Focus min</span>
          <input v-model.number="focusMinutes" name="focus-minutes" type="number" min="1" max="240" />
        </label>
        <label class="field">
          <span>Short min</span>
          <input v-model.number="shortBreakMinutes" name="short-break-minutes" type="number" min="1" max="120" />
        </label>
        <label class="field">
          <span>Long min</span>
          <input v-model.number="longBreakMinutes" name="long-break-minutes" type="number" min="1" max="240" />
        </label>
        <label class="field">
          <span>Cycles</span>
          <input v-model.number="cyclesBeforeLongBreak" name="cycles-before-long-break" type="number" min="1" max="24" />
        </label>
        <div class="profile-form-actions">
          <button class="primary-button" type="submit" :disabled="!canSaveProfile">
            {{ isEditing ? "Save" : "Create" }}
          </button>
          <button v-if="isEditing" class="secondary-button" type="button" @click="resetProfileForm">
            Cancel
          </button>
        </div>
      </form>

      <div class="section">
        <div v-if="profiles.length === 0" class="empty-state">No focus profiles.</div>
        <div v-else class="profile-list" aria-label="Focus profiles">
          <article v-for="profile in profiles" :key="profile.id" class="profile-item">
            <div class="timer-main">
              <p class="timer-title">{{ profile.name }}</p>
              <div class="timer-meta">
                <span>{{ formatDuration(profile.focusDurationSec) }}</span>
                <span>{{ formatDuration(profile.shortBreakSec) }}</span>
                <span>{{ formatDuration(profile.longBreakSec) }}</span>
                <span>{{ profile.cyclesBeforeLongBreak }} cycles</span>
              </div>
            </div>
            <div class="timer-actions">
              <button
                class="secondary-button"
                type="button"
                :disabled="activeSession !== null"
                @click="startSession(profile.id)"
              >
                Start
              </button>
              <button
                class="secondary-button"
                type="button"
                :disabled="activeSession?.profileId === profile.id"
                @click="editProfile(profile)"
              >
                Edit
              </button>
              <button
                class="danger-button"
                type="button"
                :disabled="activeSession?.profileId === profile.id"
                @click="deleteProfile(profile)"
              >
                Delete
              </button>
            </div>
          </article>
        </div>
      </div>
    </div>
  </section>
</template>
