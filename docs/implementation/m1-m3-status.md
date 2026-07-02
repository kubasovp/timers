# M1-M3 Implementation Status

Status: Accepted with follow-up items  
Owner: github.com/kubasovp  
Last updated (UTC): 2026-07-02  
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

Post-M4 update: запускаемый Tauri runtime теперь использует SQLite connection, migration runner, SQL custom timer repository и SQL-backed scheduler dispatch store. Browser/localStorage repository остаётся fallback для web/dev режима вне Tauri.

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

Status: Implemented; native storage follow-up closed after M4.

Реализовано:
- `AppFeature` and `FeatureRegistrationContext`;
- route, navigation, command, query, scheduler, settings and migration registries;
- command/query result path and app errors;
- system clock and fake clock;
- browser notification adapter and mock notification adapter;
- scheduler loop skeleton with source reconcile and dispatch;
- scheduler dispatch store with idempotency/dedup records;
- database and migration contracts;
- concrete Tauri SQL connection adapter;
- concrete migration runner, который применяет зарегистрированные migrations к SQLite.

### M3. Custom timer vertical slice

Status: Implemented; native runtime persistence follow-up closed after M4.

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
- заменить placeholder Tauri icon на полноценный app icon.

## 3) Verification

Verified on 2026-07-01:

| Check | Result |
|---|---|
| `npm run check` | Passed |
| `npm run build` | Passed |
| `npm run test:e2e` | Passed |
| `cargo check` in `src-tauri` | Passed after Linux WebKit/GTK development packages were installed |

Line count для source/test code under `src`, `src-tauri/src`, `src-tauri/capabilities` and `tests`, excluding generated schemas, lockfiles and build outputs: 3643 lines.

## 4) Current Development Prerequisites

Node/Rust versions follow `docs/implementation/m0-preflight.md`.

Fedora Linux development packages used for native Tauri checks:

```bash
sudo dnf install -y webkit2gtk4.1-devel libappindicator-gtk3-devel librsvg2-devel glib2-devel
```

Эти `*-devel` packages являются development/build-time dependencies. Runtime application packages должны зависеть от соответствующих runtime libraries через выбранный Linux package format.

Windows 11 development prerequisites validated on 2026-07-01:
- Node.js and npm are managed through Volta and follow `.nvmrc` / `docs/implementation/m0-preflight.md` (`node v24.15.0`, `npm 11.12.1`);
- project JS dependencies are installed with `npm ci`;
- Playwright browser binaries are installed with `npx playwright install chromium`;
- Rust is installed through Rustup with `stable-x86_64-pc-windows-msvc` (`rustc 1.96.1`, `cargo 1.96.1` in the checked Windows environment);
- native Tauri checks require Microsoft Visual Studio 2022 Build Tools with the C++ workload;
- Windows Tauri resource generation requires `src-tauri/icons/icon.ico` in addition to the PNG icon;
- packaged Windows builds require explicit `bundle.icon` entries in `src-tauri/tauri.conf.json`;
- native SQLite startup requires `sql:allow-execute` in `src-tauri/capabilities/default.json`; `sql:default` only covers `load`, `close` and `select`, while migrations and repositories use `execute`.

## 5) Recommended Next Tasks

1. Focus feature: реализовать profiles, session state machine, phase scheduler source и restore tests.
2. Reminders feature: начать с one-time reminders и notification queue до recurrence.
3. Sound experiments: развивать Web Audio API после стабилизации core time semantics.
4. Добавить explicit restart/recovery E2E test для persisted active timers.
5. Заменить placeholder Tauri icon на полноценный app icon.
