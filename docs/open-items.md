# Open Items / To-Do for Architecture

Status: Draft
Owner: github.com/kubasovp
Last reviewed (UTC): 2026-05-07
Scope: Список архитектурных вопросов и решений, требующих фиксации
Canonical: docs/open-items.md

## Перенесённые решения

Следующие пункты уже перенесены в профильные документы и не требуют отдельной фиксации здесь:
- state machine подход (формат + политика некорректных команд);
- timezone/DST политика для MVP;
- development view и dependency rule;
- метрики/тестовые бюджеты (MVP baseline);
- стратегия роста истории БД (MVP baseline);
- минимальный контракт автообновления (post-MVP ready baseline);
- политика телеметрии/приватности (MVP baseline + post-MVP).

## Decision Index

Файл сохранён как индекс решений и ссылок на canonical документы.

### Architecture & Domain
- Functional overview: `docs/02-functional-overview.md`
- State machines:
  - `docs/state-machines/pomodoro.md`
  - `docs/state-machines/custom-timer.md`
  - `docs/state-machines/reminder.md`
- Quality & constraints: `docs/03-quality-and-constraints.md`
- ADR-002 timezone/DST: `docs/adr/ADR-002-time-semantics-for-reminders.md`

### Operations
- Release/update policy (draft): `docs/release-and-update-policy.md`
- Privacy/telemetry policy (draft): `docs/privacy-telemetry-policy.md`

### Next review checkpoint
- После стабилизации state machine и policy-документов проверить, можно ли удалить этот индекс или оставить как навигационный entrypoint.
