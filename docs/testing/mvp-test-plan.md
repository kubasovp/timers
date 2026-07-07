# MVP Test Plan

Status: Draft  
Owner: github.com/kubasovp  
Last updated (UTC): 2026-07-07
Scope: Acceptance gates для MVP реализации  
Canonical: docs/testing/mvp-test-plan.md

## 1) Acceptance gates

### P0 (must pass)

1. Таймеры и фокус-сессии корректно стартуют/пауза/резюм/стоп.
2. Reminder one-time/daily/interval срабатывает по контракту времени.
3. После restart/sleep выполняется reconcile без потери активного состояния.
4. Misfire и dedup работают: нет дублей уведомлений.
5. Daily local-floating reminder корректно обрабатывает timezone switch, где локальное время текущей даты уже прошло: grace fire или skip-to-tomorrow без дублей.
6. Миграции schema v1 применяются на чистой и обновляемой БД.
7. Packaged desktop app starts on Linux and Windows and reaches ready state with native SQLite enabled.
8. Manual upgrade smoke preserves SQLite user data from version `N` to version `N+1`.

### P1 (желательно)

1. Корректные сообщения деградации UI при временном сбое adapters.
2. Базовые метрики и логи scheduler доступны и читаемы.
3. CI-прогон проходит на Linux и Windows.

## 2) Non-functional smoke checks

- Latency: собрать `scheduler_reconcile_lag_ms` p95; фиксированный upper bound в MVP заранее не задаётся.
- Reliability: повторный запуск после crash не приводит к потере запланированных событий.
- Resource: scheduler в idle не вызывает заметной CPU-нагрузки.

## 3) Traceability matrix (контракт -> тесты)

| Контракт | Минимальные тесты |
|---|---|
| `implementation/scheduler-contract.md` | unit: misfire/retry/dedup; integration: crash-restart reconcile |
| `implementation/data-model-v1.md` | migration tests; repository contract tests; uniqueness/idempotency tests |
| `implementation/platform-lifecycle.md` | startup ordering test; graceful shutdown test; readiness gating test |
| `state-machines/*.md` | transition tests для focus/custom/reminder |

## 4) Минимальный набор тестовых уровней

- Unit: domain transitions + use-case handlers.
- Integration: SQLite repos + scheduler loop + notifier adapter mock.
- E2E smoke (desktop): запуск, активная сессия, reminder firing, restart recover.
- Packaged smoke: build native artifacts, launch `src-tauri/target/release/timers` on Linux, `src-tauri/target/release/timers.exe` on Windows or an installed bundle artifact, then verify that UI does not show startup fallback such as `Failed to start Timers` and at least one timer/focus command reaches persisted native storage.
- Upgrade smoke: install version `N`, create persisted timer/focus/reminder data, install version `N+1` over it, and verify that SQLite data remains in user app data rather than the install directory and is still visible/editable after restart.

Current automated coverage note:
- Browser E2E includes reload recovery for active custom timer and focus session.
- Browser E2E also covers suppression of the WebView default context menu.
- M8 automated gate on 2026-07-07 passed `npm run check` and `npm run test:e2e`.

Current manual smoke note:
- Windows MSI upgrade smoke from `0.1.0` to temporary `0.1.1` passed on 2026-07-04: active focus session, active custom timer, completed timer, and one-time/daily/interval reminders remained visible after upgrade. Follow-up packaged Windows smoke with temporary `0.1.2`/`0.1.3` confirmed the release binary uses the `Windows GUI` subsystem and no longer opens a console window.
- Fedora Linux RPM smoke passed on 2026-07-07: `npm run tauri:build -- --bundles rpm` produced `src-tauri/target/release/bundle/rpm/Timers-0.1.0-1.x86_64.rpm`; the raw release binary started with native SQLite enabled, created `timers.db`, and applied `custom-timer.v1`, `focus.v1`, `reminders.v1` and `system.v1`.
- Fedora Linux upgrade smoke from `0.1.0` to temporary `0.1.1` passed both with raw release binaries in a temporary XDG profile and through a GUI RPM install/update transaction. Created reminders remained present and active timers preserved state after upgrade.

## 5) Exit criteria для MVP

MVP готов к релиз-кандидату, если:
1. Все P0 зелёные.
2. Нет open blocker в traceability по контрактам.
3. Нет high-severity дефектов по crash/recovery/time semantics.

## 6) Решения для MVP

- Обязательные платформы CI: Linux + Windows.
- Nightly longevity smoke (долгий прогон scheduler) в MVP не обязателен.
