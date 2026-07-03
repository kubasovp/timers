# Implementation Roadmap

Status: Draft  
Owner: github.com/kubasovp  
Last updated (UTC): 2026-07-03
Scope: Порядок реализации MVP и контрольные точки качества  
Canonical: docs/implementation/roadmap.md

## 1) Принципы реализации

- Идём вертикальными срезами, а не горизонтальным заполнением всех слоёв сразу.
- Первый срез должен проверить feature contract, storage, scheduler, notification dispatch и UI shell на минимальном сценарии.
- Новые контракты сначала закрепляются тестами и документацией, затем расширяются на следующий feature-модуль.
- Reminders откладываются после custom timers и focus, потому что там максимальный риск: recurrence, snooze, missed events, DST/timezone и dedup.
- Архитектурные boundary checks включаются до роста второго feature-модуля.

## 2) Milestones

### M0. Specification preflight

Status: Closed by `docs/implementation/m0-preflight.md`.

Цель: закрыть решения, которые могут привести к переделке схемы или контрактов после старта.

Deliverables:
- зафиксирован package manager, версии Tauri/Vue/TypeScript и базовый test stack;
- выбран `dependency-cruiser` как инструмент architecture boundary checks;
- уточнена `data-model-v1` для timer presets, app settings, reminder schedule rules, focus progress/cycles и sound delivery;
- уточнён `SchedulerAction` contract: payload, scheduled time, idempotency key, notification/sound action, retry metadata;
- зафиксирована MVP support matrix: Linux + Windows, macOS post-MVP.

Exit gate:
- нет blocker в `docs/open-items.md` для первого vertical slice;
- roadmap и canonical docs согласованы между собой.

### M1. Project scaffold

Status: Implemented. See `docs/implementation/m1-m3-status.md`.

Цель: получить запускаемое desktop-приложение с пустым shell и базовыми проверками.

Deliverables:
- Tauri + Vue + TypeScript scaffold;
- базовые scripts для dev/build/test/lint/typecheck;
- структура `src/kernel`, `src/platform`, `src/features`, `src/shared`;
- минимальный app shell с registered navigation placeholders;
- CI baseline для Linux и Windows.

Exit gate:
- приложение стартует локально;
- unit test, typecheck и lint запускаются одной командой;
- пустой shell не содержит business logic.

### M2. Kernel and platform skeleton

Status: Implemented; native storage follow-up closed after M4. See `docs/implementation/m1-m3-status.md`.

Цель: реализовать минимальный runtime contract без привязки к конкретному feature.

Deliverables:
- `AppFeature` и `FeatureRegistrationContext`;
- registries для routes, navigation, commands, queries, scheduler sources, settings, migrations;
- command/query result types и app errors;
- clock adapter с fake clock для тестов;
- notification adapter interface + mock adapter;
- scheduler loop skeleton с registered sources;
- SQLite connection/migration runner contract.

Exit gate:
- тест регистрации dummy feature;
- scheduler loop умеет вызвать fake source и вернуть actions;
- platform adapters не знают business details feature-модулей.

### M3. Custom timer vertical slice

Status: Implemented; native runtime persistence follow-up closed after M4. See `docs/implementation/m1-m3-status.md`.

Цель: проверить архитектуру на самом простом пользовательском сценарии end-to-end.

Deliverables:
- `features/custom-timer` с domain state machine;
- commands/queries: start, pause, resume, stop, restart, list active;
- migration и repository для active timer sessions, presets и history;
- scheduler source для `timer_end`;
- notification/sound dispatch через adapter;
- UI для запуска, активного списка и управления таймерами;
- unit/integration/e2e smoke tests.

Exit gate:
- таймер можно запустить, поставить на паузу, продолжить, остановить и дождаться завершения;
- restart/reconcile восстанавливает активный таймер из persisted state;
- повторный reconcile не создаёт дубль уведомления.

### M4. Architecture checkpoint

Status: Closed by `docs/implementation/m4-status.md`.

Цель: остановиться после первого среза и проверить, что выбранная архитектура и документация не расползаются.

Deliverables:
- включён dependency boundary check в CI;
- проверено, что `kernel` не содержит business logic;
- проверено, что feature imports идут только через public entrypoints;
- применено правило "один контракт = одно каноничное место" для implementation docs;
- `data-model-v1` сверена с фактическим storage опытом первого vertical slice и оставлена как логическая модель, а не преждевременный DDL;
- обновлены feature module DoD и docs при необходимости.

Exit gate:
- boundary checks зелёные;
- нет скрытой связанности между `custom-timer`, `platform` и `kernel`.
- нет дублирующихся копий feature/scheduler контрактов в implementation docs.

### M5. Focus feature

Status: Implemented. See `docs/implementation/m5-status.md`.

Цель: добавить второй feature-модуль и проверить повторяемость plugin-first подхода.

Deliverables:
- focus profiles CRUD;
- focus session domain state machine;
- phase/cycle progress persistence;
- scheduler source для phase transitions;
- UI для профилей, активной сессии, pause/resume/stop/skip;
- tests на phase transitions, skip semantics и restore.

Exit gate:
- одновременно активна только одна focus session;
- focus/break phases корректно переходят после sleep/restart;
- phase-level skip фиксируется отдельно от completed.

### M6. Reminders v1: one-time and queue

Status: Implemented. See `docs/implementation/m6-status.md`.

Цель: реализовать базовые reminders без recurrence complexity.

Deliverables:
- one-time reminders create/enable/disable/delete;
- due state, done/acknowledge и snooze;
- notification queue для одновременных событий;
- misfire policy и dedup для one-time reminders;
- tests на due, snooze, missed/skipped и duplicate prevention.

Exit gate:
- one-time reminder срабатывает, не дублируется и восстанавливается после restart;
- старые missed reminders не создают notification storm.

### M7. Reminders v2: recurrence and time semantics

Status: Implemented. See `docs/implementation/m7-status.md` and `docs/implementation/m7-roadmap.md`.

Цель: закрыть daily/interval reminders и ADR-002.

Deliverables:
- pure recurrence planner with explicit timezone test harness;
- daily `local-floating` schedule rules;
- interval schedule rules;
- recalculation of `next_fire_at_utc`;
- DST spring-forward/fall-back tests;
- timezone switch tests;
- tests for daily local-floating candidate already in the past: grace fire, skip-to-tomorrow and local-date dedup;
- default snooze preset settings.

Exit gate:
- daily reminder fires once per local calendar date;
- interval reminders do not drift unexpectedly after sleep/restart;
- recurrence rules can reconstruct future `next_fire_at_utc` from persisted data.

### M8. MVP hardening and release candidate

Цель: довести продукт до release-candidate качества.

Deliverables:
- full MVP P0 test pass;
- manual smoke on Linux and Windows;
- package/build artifacts;
- release checklist dry run;
- privacy/update policy linked from settings if relevant;
- known limitations documented.

Exit gate:
- все P0 из `docs/testing/mvp-test-plan.md` зелёные;
- нет high-severity дефектов по recovery/time semantics;
- MVP можно собрать и запустить на целевых платформах.

## 3) Near-term backlog after M3

1. UI iteration: закрыто. Shell layout использует header во всю ширину и три равные колонки Focus/Timers/Reminders без sidebar navigation.
2. Native storage hardening: закрыто. Tauri runtime подключает SQLite, зарегистрированные migrations и SQL-backed scheduler dispatch store.
3. Focus feature: закрыто. Реализованы profiles, session state machine, phase scheduler source и restore tests.
4. Reminders v1: начать с one-time reminders, queue, snooze/done и dedup.
5. Sound experiments: расширять Web Audio API после стабилизации core time semantics.
6. Добавить side-by-side `typecheck:ts7` и собрать фактическую совместимость TypeScript 7 RC.

## 4) Recommended task granularity

- Один PR/итерация должен закрывать один проверяемый behavior или один инфраструктурный contract.
- Не смешивать scaffold, DB migrations и UI polish в одной крупной итерации.
- После каждого milestone обновлять canonical docs только в местах, где изменился контракт или пользовательское поведение.
