# M1-M3 Implementation Status

Status: Accepted with follow-up items  
Owner: github.com/kubasovp  
Last updated (UTC): 2026-07-01  
Scope: Фактическое состояние scaffold, runtime skeleton и custom timer vertical slice  
Canonical: docs/implementation/m1-m3-status.md

## 1) Summary

M1-M3 реализованы как первый рабочий вертикальный срез:

- Tauri + Vue + TypeScript scaffold;
- npm scripts для dev/build/test/lint/typecheck/e2e;
- `src/kernel`, `src/platform`, `src/features`, `src/shared`;
- feature/plugin-first registration contract;
- command/query registries and buses;
- scheduler source/action contracts;
- scheduler loop с dispatch deduplication;
- интерфейсы clock и notification adapters;
- fake clock и mock notification adapter для тестов;
- custom timer feature с domain state machine, use-cases, UI, scheduler source, persistence ports и migrations.

Фактический runtime на текущем срезе использует browser/localStorage repository для запускаемого приложения. SQL repository и migrations уже есть, но native SQLite connection/migration runner wiring остаётся follow-up до того, как storage можно считать полностью production-backed.

## 2) Implemented Scope By Milestone

### M1. Project scaffold

Status: Implemented.

Реализовано:
- Tauri shell under `src-tauri`;
- Vue/Vite application entry under `src`;
- TypeScript project references;
- npm + `package-lock.json`;
- Linux/Windows CI baseline workflow;
- registered shell navigation with Focus/Timers/Reminders panels;
- local web dev server and production web build.

### M2. Kernel and platform skeleton

Status: Implemented with storage follow-up.

Реализовано:
- `AppFeature` and `FeatureRegistrationContext`;
- route, navigation, command, query, scheduler, settings and migration registries;
- command/query result path and app errors;
- system clock and fake clock;
- browser notification adapter and mock notification adapter;
- scheduler loop skeleton with source reconcile and dispatch;
- scheduler dispatch store with idempotency/dedup records;
- database and migration contracts.

Follow-up:
- добавить concrete Tauri SQL connection adapter;
- добавить concrete migration runner, который применяет зарегистрированные migrations к SQLite.

### M3. Custom timer vertical slice

Status: Implemented with native storage follow-up.

Реализовано:
- `features/custom-timer`;
- domain state machine for `running`, `paused`, `completed`, `stopped`;
- commands: start, pause, resume, stop, restart, complete;
- queries: list active, list presets;
- active timer sessions, presets and history repository interfaces;
- in-memory, browser/localStorage and SQL repository implementations;
- custom timer migrations;
- scheduler source for `timer_end`;
- notification and sound dispatch through adapters;
- UI for starting timers, using presets, active timer list and controls;
- unit, integration and E2E smoke tests.

Follow-up:
- добавить explicit restart/recovery E2E test для persisted active timers;
- подключить runtime persistence к Tauri SQLite вместо browser/localStorage;
- заменить placeholder Tauri icon на полноценный app icon.

## 3) Verification

Verified on 2026-07-01:

| Check | Result |
|---|---|
| `npm run check` | Passed |
| `npm run build` | Passed |
| `npm run test:e2e` | Passed |
| `cargo check` in `src-tauri` | Passed after Linux WebKit/GTK development packages were installed |

Line count для implementation code under `src`, `src-tauri` and `tests`, excluding build outputs: 2942 lines.

## 4) Current Development Prerequisites

Node/Rust versions follow `docs/implementation/m0-preflight.md`.

Fedora Linux development packages used for native Tauri checks:

```bash
sudo dnf install -y webkit2gtk4.1-devel libappindicator-gtk3-devel librsvg2-devel glib2-devel
```

Эти `*-devel` packages являются development/build-time dependencies. Runtime application packages должны зависеть от соответствующих runtime libraries через выбранный Linux package format.

## 5) Recommended Next Tasks

1. UI iteration: уточнить timer screen layout, states, iconography, visual density и empty/error states.
2. Focus feature: реализовать profiles, session state machine, phase scheduler source и restore tests.
3. Reminders feature: начать с one-time reminders и notification queue до recurrence.
4. Sound experiments: развивать Web Audio API после стабилизации core time semantics.
5. Storage hardening: подключить Tauri SQLite adapter и migration runner до release-candidate hardening.
