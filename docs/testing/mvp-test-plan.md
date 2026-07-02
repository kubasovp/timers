# MVP Test Plan

Status: Draft  
Owner: github.com/kubasovp  
Last updated (UTC): 2026-07-02
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

## 5) Exit criteria для MVP

MVP готов к релиз-кандидату, если:
1. Все P0 зелёные.
2. Нет open blocker в traceability по контрактам.
3. Нет high-severity дефектов по crash/recovery/time semantics.

## 6) Решения для MVP

- Обязательные платформы CI: Linux + Windows.
- Nightly longevity smoke (долгий прогон scheduler) в MVP не обязателен.
