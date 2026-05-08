# Schema v1 — Data Model

Status: Draft (logical schema baseline)  
Owner: github.com/kubasovp  
Last updated (UTC): 2026-05-08  
Scope: Логическая модель данных MVP + правила эволюции  
Canonical: docs/implementation/data-model-v1.md

## 1) Принципы

- Уровень документа: **логическая схема**, без ORM/driver-специфики.
- Время хранения в БД: UTC (`*_at_utc`), локальные представления вычисляются на read-side.
- Явно разделяем: `active state`, `history/event log`, `presets/templates`, `occurrences/executions`.

## 2) Таблицы и ключевые поля

### A. Active state

1. `active_timer_sessions`
- `id` (PK)
- `session_type` (`pomodoro` | `custom_timer`)
- `status` (`running` | `paused` | `completed` | `cancelled`)
- `started_at_utc`, `ends_at_utc`, `paused_at_utc` nullable
- `profile_id` nullable (для pomodoro)
- `version` (optimistic concurrency)

2. `active_reminders`
- `id` (PK)
- `title`, `message` nullable
- `schedule_type` (`one_time` | `daily` | `interval`)
- `time_semantics` (`local_floating`) для MVP
- `next_fire_at_utc`
- `timezone_snapshot` (debug-only snapshot, nullable)
- `is_enabled` (bool)
- `version`

### B. Presets/templates

3. `pomodoro_profiles`
- `id` (PK)
- `name` (unique)
- `work_duration_sec`, `short_break_sec`, `long_break_sec`
- `cycles_before_long_break`
- `created_at_utc`, `updated_at_utc`

4. `timer_presets`
- `id` (PK)
- `name` (unique)
- `duration_sec`
- `created_at_utc`, `updated_at_utc`

### C. Occurrences/executions

5. `scheduler_occurrences`
- `id` (PK)
- `source_type` (`timer` | `reminder`)
- `source_id`
- `scheduled_for_utc`
- `processed_at_utc` nullable
- `result_status` (`fired` | `missed` | `skipped` | `failed`)
- `idempotency_key` (unique)

### D. History/event log

6. `history_events`
- `id` (PK)
- `aggregate_type` (`timer_session` | `reminder` | `profile`)
- `aggregate_id`
- `event_type`
- `event_payload_json`
- `occurred_at_utc`
- `causation_id` nullable
- `correlation_id` nullable

7. `notification_delivery_log`
- `id` (PK)
- `occurrence_id` (FK -> scheduler_occurrences.id)
- `channel` (`os_notification`)
- `delivery_status` (`sent` | `failed` | `deduplicated`)
- `attempt_no`
- `created_at_utc`

## 3) Связи

- `active_timer_sessions.profile_id -> pomodoro_profiles.id` (nullable FK).
- `notification_delivery_log.occurrence_id -> scheduler_occurrences.id`.
- Логические связи `scheduler_occurrences.source_id` к `active_*` (или архивным) сущностям валидируются приложением.

## 4) Индексы (минимум MVP)

- `active_reminders(next_fire_at_utc, is_enabled)`.
- `active_timer_sessions(status, ends_at_utc)`.
- `scheduler_occurrences(source_type, source_id, scheduled_for_utc)`.
- `history_events(aggregate_type, aggregate_id, occurred_at_utc)`.
- Unique: `scheduler_occurrences(idempotency_key)`.

## 5) Enum-статусы

Статусы и их допустимые переходы должны соответствовать state-machine документам:
- `docs/state-machines/pomodoro.md`
- `docs/state-machines/custom-timer.md`
- `docs/state-machines/reminder.md`

## 6) Правила удаления

- Active records: soft-delete предпочтителен для reminders (`is_enabled=false`) в MVP.
- Presets/profiles: hard-delete разрешён, если нет активной зависимости.
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

- `history_events`: 180 дней (по умолчанию), далее агрегировать/архивировать.
- `scheduler_occurrences`: 90 дней.
- `notification_delivery_log`: 90 дней.
- Очистка выполняется фоновым maintenance-job не чаще 1 раза в сутки.

## 10) Версия схемы и миграции

- Текущая версия: `schema_v1`.
- Любое изменение структуры БД требует versioned migration (`v1.1`, `v1.2`, ...).
- Правила эволюции:
  1. Миграции должны быть backward-safe в пределах минорной версии.
  2. destructive changes — только через двухшаговую deprecation схему.
  3. Документ обновляется в одном PR с миграцией.

## 11) Open questions

- Нужна ли отдельная таблица archival snapshots для completed timer sessions в MVP?
- Какой фактический retention SLA требуется пользователю: 90/180 дней или настраиваемый?
