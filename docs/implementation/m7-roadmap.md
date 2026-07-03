# M7 Roadmap — Reminders Recurrence and Time Semantics

Status: Implemented  
Owner: github.com/kubasovp  
Last updated (UTC): 2026-07-03  
Scope: План реализации M7, test matrix и порядок снижения риска для recurring reminders  
Canonical: docs/implementation/m7-roadmap.md

## 0) Implementation Result

M7 is implemented in the application code and verified by automated tests.

Delivered:
- pure recurrence planner for daily local-floating and interval rules;
- explicit IANA timezone test harness for planner scenarios without changing OS timezone;
- daily DST spring-forward/fall-back behavior from ADR-002;
- local-date dedup for daily reminders through `last_fired_local_date`;
- interval elapsed-UTC cadence from `interval_anchor_at_utc`;
- scheduler integration for enabled and snoozed recurring reminders;
- daily recurring `Done` returns the rule to `enabled`, while one-time `Done` remains terminal;
- interval alerts stay active and reschedule automatically until explicitly stopped;
- recurring `Snooze` refires the current logical occurrence with an explicit snooze occurrence key for command-level compatibility;
- UI create controls for one-time, daily and interval reminders;
- default snooze preset setting definition `reminders.snoozePresetsSeconds`.

Verification:
- `npm run test`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run test:e2e`

## 1) Boundaries

Этот документ является каноничным для порядка реализации M7 и таблицы planner-сценариев.

Каноничные правила времени остаются в:
- `docs/adr/ADR-002-time-semantics-for-reminders.md`;
- `docs/implementation/scheduler-contract.md`.

M7 не меняет one-time reminders: они остаются `fixed_utc` и не пересчитываются при смене timezone.

Не входит в M7:
- post-MVP `fixed-zone` reminders с ручным выбором IANA timezone;
- background service/daemon, который будит приложение после полного закрытия;
- проверка DST через изменение timezone реальной ОС в автоматических тестах.

## 2) Implementation Strategy

Основной риск M7 должен жить в чистом planner-модуле, а не в `ReminderSchedulerSource`.

Planner принимает persisted reminder rule, `nowUtc` и явную `currentTimeZone`, затем возвращает решение:
- `none`: user-visible alert не нужен, нужно только сохранить будущий `nextFireAtUtc`;
- `fire`: нужно создать occurrence/action и пересчитать следующий fire time;
- `skip`: нужно записать skipped occurrence/history и пересчитать следующий fire time.

Тесты planner не должны менять timezone машины. Все timezone/DST сценарии должны передавать IANA timezone явно, например `Europe/Berlin`, `America/New_York`, `UTC`.

Production scheduler остаётся оболочкой:
1. получает `nowUtc`;
2. получает текущую timezone устройства;
3. загружает enabled/snoozed reminders;
4. вызывает planner;
5. сохраняет reminder/occurrence/history;
6. возвращает `SchedulerAction[]` для user-visible delivery.

## 3) Phased Roadmap

### M7.0. Planner contract and test harness

Цель: до feature-кода закрыть форму решения planner и тестовую стратегию.

Deliverables:
- типы planner input/output для daily и interval;
- timezone resolver с явным IANA timezone в input;
- тестовые fixtures для DST gap/overlap без изменения timezone ОС;
- решение по interval misfire policy;
- обновление `docs/state-machines/reminder.md` для recurring `done`/`snooze`.

Exit gate:
- test matrix из раздела 4 перенесена в unit-тесты как pending/failing или реализованные тесты;
- scheduler source ещё не содержит DST/recurrence математику.

### M7.1. Daily local-floating planner

Цель: реализовать daily `local-floating` без UI и без repository side effects.

Deliverables:
- вычисление today/tomorrow candidate по `dailyTimeLocal`;
- DST spring-forward: nonexistent local time shifts to nearest valid local time;
- DST fall-back: ambiguous local time uses first occurrence;
- local-date dedup через `lastFiredLocalDate`;
- grace/skip policy для candidate in the past.

Exit gate:
- daily planner покрыт D01-D12 из test matrix;
- planner может восстановить будущий `nextFireAtUtc` только из persisted rule/state.

### M7.2. Daily integration

Цель: подключить daily planner к use-cases, repositories и scheduler.

Deliverables:
- create/list/enable/disable/delete для daily reminders;
- repository mapping для `daily_time_local`, `next_fire_at_utc`, `timezone_snapshot`, `last_fired_local_date`;
- scheduler reconcile для daily reminders;
- occurrence/history записи для fired/skipped daily occurrences;
- idempotency key, включающий logical scheduled occurrence.

Exit gate:
- daily reminder fires once per local calendar date;
- restart/reconcile не создаёт дубль daily alert;
- timezone switch пересчитывает `nextFireAtUtc` из rule/state.

### M7.3. Interval planner and integration

Цель: реализовать interval reminders без wall-clock drift.

Proposed MVP semantics:
- interval считается по elapsed UTC от `intervalAnchorAtUtc`;
- anchor не сдвигается на `now` после sleep/restart;
- scheduler не создаёт notification storm за пропущенные интервалы;
- при reconcile может быть создан максимум один user-visible alert на reminder.

Deliverables:
- вычисление latest due interval occurrence от anchor;
- вычисление next future occurrence от anchor;
- interval grace/skip policy;
- scheduler/repository/use-case integration;
- idempotency key по scheduled interval occurrence.

Exit gate:
- interval reminder не дрейфует после sleep/restart;
- повторный reconcile не создаёт дубль;
- старые пропущенные interval occurrences не спамят пользователя.

### M7.4. Recurring occurrence acknowledgement

Цель: отделить acknowledgement occurrence от terminal one-time `done`.

Required behavior:
- one-time `Done` остаётся terminal: reminder становится `done`, `isEnabled=false`;
- daily recurring `Done` закрывает текущий occurrence и возвращает reminder в `enabled` с пересчитанным будущим `nextFireAtUtc`;
- interval occurrence при alert записывается и сразу возвращает правило в `enabled` с будущим `nextFireAtUtc`;
- recurring `Snooze` переносит текущий occurrence, а не создаёт новую logical daily/interval дату;
- `Disable` выключает всё правило, включая snoozed occurrence.

Exit gate:
- one-time поведение M6 не ломается;
- recurring due/snoozed/done сценарии покрыты state-machine и use-case тестами.

### M7.5. UI, settings and release checks

Цель: вывести recurrence в UI только после стабилизации planner и state machine.

Deliverables:
- UI create controls для one-time/daily/interval;
- отображение schedule summary;
- default snooze preset settings;
- e2e smoke для daily/interval happy path;
- docs/status update.

Exit gate:
- `npm run check`, `npm run build`, `npm run test:e2e`;
- MVP P0 из `docs/testing/mvp-test-plan.md` по reminders закрыты или имеют documented limitation.

## 4) Planner Test Matrix

### Daily local-floating

Baseline unless stated otherwise:
- `dailyTimeLocal = 10:00`;
- `dailyLocalGraceWindow = 1h`;
- reminder is enabled;
- `lastFiredLocalDate` is absent.

| ID | Scenario | Timezone / Inputs | Expected planner result | Must prove |
|---|---|---|---|---|
| D01 | Candidate is still future today | `Europe/Berlin`, local now `2026-07-03 09:00` | `none`, `nextFireAtUtc = today 10:00 local` | Future daily reminders do not fire early |
| D02 | Candidate is due inside grace | `Europe/Berlin`, local now `2026-07-03 10:15` | `fire`, local date key `2026-07-03`, next tomorrow | Missed-by-minutes reminder fires once |
| D03 | Candidate is missed outside grace | `Europe/Berlin`, local now `2026-07-03 12:30` | `skip`, local date key `2026-07-03`, next tomorrow | Old daily miss does not alert late |
| D04 | Already fired today | `lastFiredLocalDate = 2026-07-03`, local now `2026-07-03 10:30` | `none`, next tomorrow | Local-date dedup prevents duplicate alert |
| D05 | Persisted `nextFireAtUtc` is stale after restart | persisted next is yesterday, local now `2026-07-03 09:00` | `none`, next today 10:00 | Rule/state can reconstruct next fire |
| D06 | Spring-forward nonexistent local time | `Europe/Berlin`, `dailyTimeLocal = 02:30`, date `2026-03-29` | candidate shifts to nearest valid local time, expected `03:00 local` | DST gap has deterministic behavior |
| D07 | Fall-back ambiguous local time | `Europe/Berlin`, `dailyTimeLocal = 02:30`, date `2026-10-25` | first local occurrence is selected | DST overlap chooses first occurrence |
| D08 | Fall-back second occurrence reconcile | same as D07, after first occurrence fired, local clock shows `02:45` again | `none`, next next-day candidate | Local-date dedup closes fall-back duplicate |
| D09 | Timezone switch, candidate still future | same rule, current TZ changes to `America/New_York`, local now `2026-07-03 09:30` | `none`, next today 10:00 in new TZ | Local-floating follows current device TZ |
| D10 | Timezone switch, candidate passed inside grace | current TZ `Asia/Tokyo`, local now `2026-07-03 10:15` | `fire`, local date key `2026-07-03` | Timezone switch can grace-fire today's candidate |
| D11 | Timezone switch, candidate passed outside grace | current TZ `Asia/Tokyo`, local now `2026-07-03 12:30` | `skip`, next tomorrow | Timezone switch does not create stale alerts |
| D12 | Local date differs from UTC date | current TZ `Pacific/Auckland`, local now `2026-01-01 00:15` | local date key is `2026-01-01` | Dedup key is local calendar date, not UTC date |

### Interval

Baseline unless stated otherwise:
- `intervalSeconds = 3600`;
- `intervalAnchorAtUtc = 2026-07-03T08:00:00.000Z`;
- interval calculations use elapsed UTC, not local wall-clock time.

| ID | Scenario | Inputs | Expected planner result | Must prove |
|---|---|---|---|---|
| I01 | Next interval is future | `nowUtc = 2026-07-03T08:30:00.000Z` | `none`, next `09:00Z` | No early fire |
| I02 | Exact due interval | `nowUtc = 2026-07-03T09:00:00.000Z` | `fire`, scheduled `09:00Z`, next `10:00Z` | Exact boundary fires once |
| I03 | Sleep/restart with latest due inside grace | `nowUtc = 2026-07-03T11:05:00.000Z` | at most one `fire`, scheduled `11:00Z`, next `12:00Z` | No catch-up storm |
| I04 | Old latest due outside grace | long interval, latest due older than interval grace | `skip`, next future occurrence | Late interval alerts can be skipped |
| I05 | Repeated reconcile after fire | same `nowUtc` and persisted occurrence exists | `none` | Idempotency prevents duplicate |
| I06 | DST transition during interval schedule | anchor before DST transition, current TZ any | UTC cadence remains unchanged | Interval does not drift with DST |

### Recurring acknowledgement and snooze

| ID | Scenario | Inputs | Expected behavior | Must prove |
|---|---|---|---|---|
| R01 | Daily occurrence acknowledged with Done | reminder is `due`, schedule type `daily` | current occurrence becomes `done`, reminder returns to `enabled`, next is future daily candidate | Recurring Done is not terminal |
| R02 | Interval occurrence fires | reminder is `enabled`, schedule type `interval` | current occurrence is recorded, alert is delivered, reminder stays `enabled`, next is future interval candidate | Interval does not wait for acknowledgement |
| R03 | Daily occurrence snoozed | due daily occurrence snoozed 5m | reminder is `snoozed`, `nextFireAtUtc = snoozedUntilUtc`, logical local date preserved | Snooze does not create second daily occurrence |
| R04 | Snoozed recurring occurrence fires | snoozed daily/interval reaches snooze time | same logical occurrence fires again with stable idempotency key or explicit snooze key policy; interval returns to `enabled` | Snooze refire is deterministic |
| R05 | Disable snoozed recurring reminder | reminder is `snoozed` | reminder becomes `disabled`, no recurrence or snooze alert fires | Disable owns the whole rule |

## 5) Verification Plan

Minimum automated checks for M7:
- planner unit tests for all rows in section 4;
- state-machine tests for one-time vs recurring `Done` and `Snooze`;
- use-case tests for create/list/enable/disable/delete daily and interval reminders;
- scheduler integration tests for due, missed/skipped, dedup and restart-style repeated reconcile;
- SQL repository tests for new/activated recurrence fields;
- e2e smoke for basic daily and interval creation/notification state.

Manual/native checks remain useful, but they should validate integration only. They must not be the primary proof for DST/timezone correctness.
