# Open Items / To-Do for Architecture

Status: Draft  
Owner: github.com/kubasovp  
Last reviewed (UTC): 2026-07-01  
Scope: Список архитектурных вопросов и решений, требующих фиксации  
Canonical: docs/open-items.md

## Перенесённые решения

Следующие пункты уже перенесены в профильные документы и не требуют отдельной фиксации здесь:

- state machine подход (формат + политика некорректных команд);
- timezone/DST политика для MVP;
- plugin-first modular monolith как базовая архитектура;
- feature module contract (`AppFeature.register(context)`);
- development view и dependency rule;
- метрики/тестовые бюджеты (MVP baseline);
- стратегия роста истории БД (MVP baseline);
- минимальный контракт автообновления (post-MVP ready baseline);
- политика телеметрии/приватности (MVP baseline + post-MVP);
- M0 preflight: toolchain, TypeScript 7 RC policy, dependency-cruiser, platform matrix, data-model/scheduler clarifications.

## Decision Index

Файл сохранён как индекс решений и ссылок на canonical документы.

### Architecture & Domain

- Functional overview: `docs/02-functional-overview.md`
- Quality & constraints: `docs/03-quality-and-constraints.md`
- M0 preflight: `docs/implementation/m0-preflight.md`
- Roadmap: `docs/implementation/roadmap.md`
- Development view: `docs/implementation/development-view.md`
- Feature module contract: `docs/implementation/feature-module-contract.md`
- ADR-002 timezone/DST: `docs/adr/ADR-002-time-semantics-for-reminders.md`
- ADR-003 plugin-first modular monolith: `docs/adr/ADR-003-plugin-first-modular-monolith.md`
- State machines:
  - `docs/state-machines/focus-session.md`
  - `docs/state-machines/custom-timer.md`
  - `docs/state-machines/reminder.md`

### Operations

- Release/update policy (draft): `docs/release-and-update-policy.md`
- Privacy/telemetry policy (draft): `docs/privacy-telemetry-policy.md`

## Remaining open items

### After first vertical slice

Следующие вопросы не блокируют старт первого vertical slice, но требуют отдельной фиксации по мере реализации:

- Решить, нужны ли materialized read models для часто используемых таймеров или достаточно runtime-агрегации из history.
- Проверить TypeScript 7 RC (`typescript@rc`) как side-by-side `typecheck:ts7` после scaffold и решить, можно ли продвигать его в primary CI.

## Next review checkpoint

После первого вертикального среза `features/custom-timer` проверить, не распухает ли `kernel` и не появляется ли скрытая межмодульная связанность.
