# C4 Level 2 — Container

Status: Draft  
Owner: github.com/kubasovp  
Last reviewed (UTC): 2026-07-01  
Scope: Контейнеры приложения и ключевые связи  
Canonical: docs/L2-container.md

```mermaid
flowchart TB
  USER[User]

  SHELL[Desktop App Shell\nTauri + Vue]
  KERNEL[App Kernel\nfeature contract + registries]

  CUSTOM[Feature Module\nCustom Timer]
  POM[Feature Module\nPomodoro]
  REM[Feature Module\nReminders]

  PLATFORM[Platform Adapters\nTauri bridge + SQLite + notifications + clock]
  SCHED[Scheduler Loop\nregistered scheduler sources + reconcile dispatcher]

  DB[(SQLite)]
  NOTIF[OS Notifications]
  UPDATE[Update Check Adapter\nfuture optional]
  TELEMETRY[Telemetry Adapter\nfuture optional]

  USER --> SHELL

  SHELL --> KERNEL
  KERNEL --> CUSTOM
  KERNEL --> POM
  KERNEL --> REM

  CUSTOM --> KERNEL
  POM --> KERNEL
  REM --> KERNEL

  SCHED --> KERNEL
  KERNEL --> PLATFORM
  PLATFORM --> DB
  PLATFORM --> NOTIF

  PLATFORM --> UPDATE
  PLATFORM --> TELEMETRY
```

### Пояснения к контейнерам

- `Desktop App Shell` — desktop UI и Tauri WebView. Shell рендерит зарегистрированные routes/navigation и вызывает commands/queries через kernel.
- `App Kernel` — минимальное ядро: feature contract, registries, command/query contracts, scheduler contracts. Kernel не содержит бизнес-логики Pomodoro/Timer/Reminder.
- `Feature Module: Custom Timer` — быстрые таймеры, пресеты, active custom timer sessions.
- `Feature Module: Pomodoro` — Pomodoro profiles, work/break cycles, Pomodoro session state machine.
- `Feature Module: Reminders` — one-time/daily/interval reminders, snooze, missed events, reminder state machine.
- `Platform Adapters` — конкретные интеграции с Tauri, SQLite, OS notifications, clock и runtime config.
- `Scheduler Loop` — общий loop, который работает с зарегистрированными scheduler sources. Scheduler не знает бизнес-деталей модулей.
- `Update Check Adapter` и `Telemetry Adapter` — будущие optional-adapters. Их отказ не должен ломать локальные сценарии.

### Архитектурное правило

Feature-модули подключаются к приложению через `AppFeature.register(context)`. Они не импортируют внутренности друг друга и не зависят напрямую от platform adapters.

Composition root находится в `platform/bootstrap` и является единственным местом, где выбирается список активных feature-модулей.
