# MVP Test Plan

Status: Draft  
Owner: github.com/kubasovp  
Last updated (UTC): 2026-05-08  
Scope: Acceptance gates для MVP реализации  
Canonical: docs/testing/mvp-test-plan.md

## 1) Acceptance gates

### P0 (must pass)

1. Таймеры и помодоро корректно стартуют/пауза/резюм/стоп.
2. Reminder one-time/daily/interval срабатывает по контракту времени.
3. После restart/sleep выполняется reconcile без потери активного состояния.
4. Misfire и dedup работают: нет дублей уведомлений.
5. Миграции schema v1 применяются на чистой и обновляемой БД.

### P1 (желательно)

1. Корректные сообщения деградации UI при временном сбое adapters.
2. Базовые метрики и логи scheduler доступны и читаемы.
3. Retention cleanup job отрабатывает без влияния на активные сценарии.

## 2) Non-functional smoke checks

- Latency: reconcile tick p95 в пределах целевого бюджета (уточнить).
- Reliability: повторный запуск после crash не приводит к потере запланированных событий.
- Resource: scheduler в idle не вызывает заметной CPU-нагрузки.

## 3) Traceability matrix (контракт -> тесты)

| Контракт | Минимальные тесты |
|---|---|
| `implementation/scheduler-contract.md` | unit: misfire/retry/dedup; integration: crash-restart reconcile |
| `implementation/data-model-v1.md` | migration tests; repository contract tests; uniqueness/idempotency tests |
| `implementation/platform-lifecycle.md` | startup ordering test; graceful shutdown test; readiness gating test |
| `state-machines/*.md` | transition tests для pomodoro/custom/reminder |

## 4) Минимальный набор тестовых уровней

- Unit: domain transitions + use-case handlers.
- Integration: SQLite repos + scheduler loop + notifier adapter mock.
- E2E smoke (desktop): запуск, активная сессия, reminder firing, restart recover.

## 5) Exit criteria для MVP

MVP готов к релиз-кандидату, если:
1. Все P0 зелёные.
2. Нет open blocker в traceability по контрактам.
3. Нет high-severity дефектов по crash/recovery/time semantics.

## 6) Open questions

- Какие платформы обязательны в CI для MVP: Linux only или Linux+Windows?
- Нужен ли nightly longevity smoke (например, 8-часовой прогон scheduler)?
