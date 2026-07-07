# M1-M3 Implementation Status

Status: Accepted
Owner: github.com/kubasovp  
Last updated (UTC): 2026-07-04
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
- нет открытых M1-M3 follow-up items; оставшиеся release checks отслеживаются в M8.

## 3) Verification

Verified on 2026-07-01:

| Check | Result |
|---|---|
| `npm run check` | Passed |
| `npm run build` | Passed |
| `npm run test:e2e` | Passed |
| `cargo check` in `src-tauri` | Passed after Linux WebKit/GTK development packages were installed |

Fedora packaging check on 2026-07-02:

| Check | Result |
|---|---|
| Fedora environment | Fedora 44 Workstation, Node `v24.15.0`, npm `11.12.1`, rustc `1.95.0`, cargo `1.95.0` |
| `npm run check` | Passed: typecheck, dependency boundary lint and 19 tests |
| `npm run tauri:build -- --bundles rpm` | Passed |
| RPM artifact | `src-tauri/target/release/bundle/rpm/Timers-0.1.0-1.x86_64.rpm` |
| RPM metadata | `timers 0.1.0-1`, `x86_64`; installs `/usr/bin/timers`, desktop entry and icon |
| Runtime dependencies reported by RPM | `libwebkit2gtk-4.1.so.0`, `libgtk-3.so.0` |
| Manual Fedora smoke | Raw Linux binary `src-tauri/target/release/timers` starts, UI is visible and multiple timers can be started successfully |

Tauri artifact layout:
- raw release binaries are placed directly under `src-tauri/target/release/` (`timers` on Linux, `timers.exe` on Windows);
- Linux package artifacts are placed under `src-tauri/target/release/bundle/<format>/`, for example `bundle/rpm/*.rpm` and `bundle/deb/*.deb`;
- in the current Fedora environment, full `targets: "all"` packaging produced `.deb` and `.rpm` before failing at AppImage with `Read-only file system (os error 30)`, so Fedora package smoke should use `npm run tauri:build -- --bundles rpm` until AppImage is explicitly needed and validated.

Pre-M8 recovery and Windows packaged smoke on 2026-07-04:

| Check | Result |
|---|---|
| `npm run test:e2e` | Passed: browser smoke includes active custom timer and focus session reload recovery |
| Windows `npm run tauri:build` | Passed: `src-tauri/target/release/timers.exe`, MSI and NSIS artifacts built |
| Windows raw packaged startup | Passed: `timers.exe` process started and responded |
| Windows native SQLite startup | Passed: `timers.db` exists in app data with migrations `system.v1`, `custom-timer.v1`, `focus.v1`, `reminders.v1` |
| App icon | Placeholder icon replaced with Timers-specific PNG/ICO assets |

Cargo manifest note:
- `tauri build` normalizes `tauri` and `tauri-build` dependency entries to include explicit `features = []`;
- keep this normalized form committed to avoid dirty working trees after local Windows/Fedora builds;
- `features = []` is not `default-features = false`, so it does not disable Tauri default features.

Line count для source/test code under `src`, `src-tauri/src`, `src-tauri/capabilities` and `tests`, excluding generated schemas, lockfiles and build outputs: 3643 lines.

## 4) Current Development Prerequisites

Node/Rust versions follow `docs/implementation/m0-preflight.md`.

Fedora Linux development packages used for native Tauri checks:

```bash
sudo dnf install -y webkit2gtk4.1-devel libappindicator-gtk3-devel librsvg2-devel glib2-devel
```

Эти `*-devel` packages являются development/build-time dependencies. Runtime application packages должны зависеть от соответствующих runtime libraries через выбранный Linux package format.

Fedora RPM packaging command:

```bash
npm run tauri:build -- --bundles rpm
```

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

1. M8 packaged smoke on Linux RPM and Windows installer/raw binary: closed by `docs/implementation/m8-status.md`.
2. Manual upgrade smoke for persisted SQLite user data: closed for Windows MSI, Linux raw-binary and Linux installed RPM transaction profiles by `docs/implementation/m8-status.md`.
3. Sound experiments: развивать Web Audio API после стабилизации core time semantics.
