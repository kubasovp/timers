# Schema v1 — Data Model

Status: Draft (logical schema baseline)  
Owner: github.com/kubasovp  
Last updated (UTC): 2026-07-01
Scope: Логическая модель данных MVP + правила эволюции  
Canonical: docs/implementation/data-model-v1.md

## 1) Принципы

- Уровень документа: **логическая схема**, без ORM/driver-специфики.
- Документ задаёт ориентиры для persistence design, а не жёсткий DDL-контракт. После реализации вертикального среза фактические migrations/repository contracts становятся источником точных колонок, индексов и storage split.
- Время хранения в БД: UTC (`*_at_utc`), локальные представления вычисляются на read-side.
- Явно разделяем: `active state`, `history/event log`, `presets/templates`, `occurrences/executions`.
- Перечисленные поля и индексы ниже можно корректировать по мере реализации, если сохраняются доменные инварианты: recoverability после restart/sleep, idempotency/dedup и возможность пересчитать future fire time из persisted rule.

## 2) Таблицы и ключевые поля

### A. Active state

1. `active_timer_sessions`
- `id` (PK)
- `session_type` (`focus` | `custom_timer`)
- `status` (`running` | `paused` | `completed` | `stopped` | `running_focus` | `running_break` | `paused_focus` | `paused_break`)
- `title` nullable
- `started_at_utc`, `ends_at_utc`, `paused_at_utc`, `completed_at_utc`, `stopped_at_utc` nullable
- `duration_total_sec`
- `remaining_sec_at_pause` nullable
- `input_hours`, `input_minutes`, `input_seconds` (пользовательский формат ввода для custom timer)
- `timer_preset_id` nullable (для custom timer)
- `profile_id` nullable (для focus)
- `focus_phase` nullable (`focus` | `short_break` | `long_break`)
- `focus_cycle_index` nullable (1-based текущий цикл)
- `focus_total_cycles` nullable
- `focus_completed_cycles` nullable
- `phase_started_at_utc`, `phase_ends_at_utc` nullable
- `phase_duration_sec` nullable
- `version` (optimistic concurrency)

`status` должен сохраняться без потерь относительно canonical state machines:
- custom timer: `running`/`paused`/`completed`/`stopped`;
- focus: `running_focus`/`running_break`/`paused_focus`/`paused_break`/`completed`/`stopped`.

Focus phase skip не является terminal session status. Он фиксируется отдельным `history_events.event_type = focus_phase_skipped` с payload текущей/следующей фазы.

Примечание: общая таблица `active_timer_sessions` и общий `status` enum — логический baseline, а не требование хранить focus/custom timer в одном физическом enum. Feature-модули могут разделить storage, если state machines и queries сохраняют тот же observable behavior.

2. `active_reminders`
- `id` (PK)
- `title`, `message` nullable
- `status` (`enabled` | `due` | `snoozed` | `done` | `disabled` | `deleted`)
- `schedule_type` (`one_time` | `daily` | `interval`)
- `time_semantics` schedule-specific (`local_floating` для daily в MVP; `fixed_zone` post-MVP)
- `one_time_fire_at_utc` nullable
- `daily_time_local` nullable (`HH:mm:ss`)
- `interval_seconds` nullable
- `interval_anchor_at_utc` nullable
- `next_fire_at_utc`
- `timezone_snapshot` (debug-only snapshot, nullable)
- `last_fired_at_utc` nullable
- `last_fired_local_date` nullable (`YYYY-MM-DD`, для daily dedup при DST fall-back и timezone jumps)
- `snoozed_until_utc` nullable
- `is_enabled` (bool)
- `deleted_at_utc` nullable
- `version`

Правило: `next_fire_at_utc` — materialized scheduler value, но не единственный source of truth. Для daily/interval reminders persisted schedule fields обязательны, чтобы после restart/timezone/DST можно было пересчитать следующее срабатывание из правила.

Time semantics baseline:
- one-time reminders use `one_time_fire_at_utc` as a fixed UTC instant; timezone changes do not recalculate it;
- daily reminders use `daily_time_local` as `local-floating` time in the current device timezone;
- interval reminders use `interval_seconds` + `interval_anchor_at_utc`; timezone changes do not redefine the interval anchor.

### B. Presets/templates

3. `focus_profiles`
- `id` (PK)
- `name` (unique)
- `focus_duration_sec`, `short_break_sec`, `long_break_sec`
- `cycles_before_long_break`
- `created_at_utc`, `updated_at_utc`

4. `timer_presets`
- `id` (PK)
- `name`
- `duration_total_sec`
- `description` nullable
- `category` nullable
- `created_at_utc`, `updated_at_utc`

5. `app_settings`
- `key` (PK)
- `value_json`
- `schema_version`
- `updated_at_utc`

MVP settings include at least:
- `visible_panels`
- `window_close_behavior`
- `default_snooze_sec`
- `sound_enabled`
- `sound_volume`
- `telemetry_consent`

### C. Occurrences/executions

6. `reminder_occurrences`
- `id` (PK)
- `reminder_id` (FK -> `active_reminders.id`)
- `scheduled_for_utc`
- `status` (`due` | `fired` | `snoozed` | `done` | `missed` | `skipped` | `failed`)
- `fired_at_utc` nullable
- `acknowledged_at_utc` nullable
- `snoozed_until_utc` nullable
- `local_date_key` nullable (`YYYY-MM-DD`, для daily dedup)
- `idempotency_key` (unique)

Recurring reminder `done` закрывает конкретный `reminder_occurrence`, но не завершает само recurring rule. После acknowledgement recurring reminder возвращается к `enabled` с новым `next_fire_at_utc`.

7. `scheduler_occurrences`
- `id` (PK)
- `source_type` (`timer` | `focus` | `reminder`)
- `source_id`
- `scheduled_for_utc`
- `processed_at_utc` nullable
- `result_status` (`fired` | `missed` | `skipped` | `failed`)
- `idempotency_key` (unique)

### D. History/event log

8. `history_events`
- `id` (PK)
- `aggregate_type` (`timer_session` | `reminder` | `profile`)
- `aggregate_id`
- `event_type`
- `event_payload_json`
- `occurred_at_utc`
- `causation_id` nullable
- `correlation_id` nullable

9. `notification_delivery_log`
- `id` (PK)
- `occurrence_id` (FK -> scheduler_occurrences.id)
- `channel` (`os_notification` | `sound`)
- `delivery_status` (`sent` | `failed` | `deduplicated`)
- `attempt_no`
- `created_at_utc`

## 3) Связи

- `active_timer_sessions.profile_id -> focus_profiles.id` (nullable FK).
- `active_timer_sessions.timer_preset_id -> timer_presets.id` (nullable FK).
- `reminder_occurrences.reminder_id -> active_reminders.id`.
- `notification_delivery_log.occurrence_id -> scheduler_occurrences.id`.
- Логические связи `scheduler_occurrences.source_id` к `active_*` (или архивным) сущностям валидируются приложением.

## 4) Индексы (минимум MVP)

- `active_reminders(next_fire_at_utc, is_enabled)`.
- `active_reminders(schedule_type, status, next_fire_at_utc)`.
- `active_timer_sessions(status, ends_at_utc)`.
- `active_timer_sessions(session_type, status)`.
- `timer_presets(category, name)`.
- `reminder_occurrences(reminder_id, scheduled_for_utc)`.
- Unique: `reminder_occurrences(idempotency_key)`.
- `scheduler_occurrences(source_type, source_id, scheduled_for_utc)`.
- `history_events(aggregate_type, aggregate_id, occurred_at_utc)`.
- Unique: `scheduler_occurrences(idempotency_key)`.

## 5) Enum-статусы

Статусы и их допустимые переходы должны соответствовать state-machine документам:
- `docs/state-machines/focus-session.md`
- `docs/state-machines/custom-timer.md`
- `docs/state-machines/reminder.md`

## 6) Правила удаления

- Active records: soft-delete предпочтителен для reminders (`is_enabled=false`) в MVP.
- Focus profiles: hard-delete разрешён, если нет активной зависимости.
- Timer presets: hard-delete разрешён, если нет активной зависимости; history не удаляется.
- History/occurrences: не удаляются синхронно с бизнес-удалением активной сущности.

## 7) Что считается history

History = неизменяемый log бизнес-событий и исполнения scheduler:
- domain events (`history_events`)
- факты попыток срабатывания (`scheduler_occurrences`)
- попытки доставки уведомлений (`notification_delivery_log`)

## 8) Idempotency constraints

Критично для scheduler:
- `idempotency_key = hash(source_type, source_id, scheduled_for_utc, logical_action)`.
- Повторная обработка того же occurrence должна приводить к no-op или `deduplicated`, но не к дублю уведомления.
- Outbox/dispatch операции должны быть безопасны к retry после crash.

## 9) Retention policy (MVP baseline)

- Автоматическая очистка history в MVP не выполняется.
- История таймеров управляется пользователем вручную через UI (stack history + удаление по кнопке).
- Удаление history timer entries: hard-delete.
- Retention SLA не задаётся: пользователь сам решает, что хранить и что удалять.

## 10) Версия схемы и миграции

- Текущая версия: `schema_v1`.
- Любое изменение структуры БД требует versioned migration (`v1.1`, `v1.2`, ...).
- Feature-модули владеют своими migrations (`src/features/<feature-id>/migrations/`), но выполняет их централизованный platform migrations runner.
- Общие системные таблицы (`app_settings`, migration metadata) принадлежат platform storage layer.
- Правила эволюции:
  1. Миграции должны быть backward-safe в пределах минорной версии.
  2. destructive changes — только через двухшаговую deprecation схему.
  3. Документ обновляется в одном PR с миграцией.

## 11) Решённые допущения MVP

- Отдельная таблица archival snapshots для completed timer sessions не нужна.
- Retention SLA для history не требуется; управление хранением полностью на стороне пользователя.

## 12) Open questions

- Нужна ли отдельная materialized read-модель для "часто используемых таймеров" (derived из history) или достаточно runtime-агрегации?
