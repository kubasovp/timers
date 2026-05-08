# Platform Lifecycle Contract

Status: Draft (runtime/platform contract)  
Owner: github.com/kubasovp  
Last updated (UTC): 2026-05-08  
Scope: Startup/Shutdown/Recovery semantics  
Canonical: docs/implementation/platform-lifecycle.md

## 1) Startup order

1. Загрузка конфигурации и feature flags.
2. Инициализация storage (SQLite), проверка/применение миграций.
3. Инициализация adapters (clock, notifications, optional telemetry/update).
4. Wiring application services (composition root).
5. Первичный reconcile scheduler.
6. Переход приложения в `ready`.

## 2) Readiness/Liveness semantics

- `liveness`: процесс жив и event-loop отвечает.
- `readiness`: storage доступен, миграции завершены, scheduler сделал initial reconcile.
- UI показывает статус деградации, если liveness=true, readiness=false.

## 3) Graceful shutdown budget

- Целевой бюджет остановки: до 5 секунд.
- На shutdown:
  1) stop intake новых команд;
  2) завершить in-flight операции scheduler/dispatch;
  3) flush logs/telemetry buffer (если включено);
  4) корректно закрыть DB connections.

Если бюджет исчерпан — принудительное завершение с гарантией crash-safe восстановления после restart.

## 4) Recovery after crash/restart

- При старте обязателен reconcile active state и due reminders по UTC.
- Незавершённые dispatch attempts учитываются через idempotency и delivery log.
- Пропущенные события обрабатываются по misfire policy из scheduler contract.

## 5) Clock/timezone assumptions

- Системные вычисления scheduler — только в UTC.
- Локальная таймзона используется для user-facing представления и local-floating правил.
- Поведение на DST и timezone switch следует ADR-002.

## 6) Open questions

- Требуется ли режим degraded-readonly при повреждённой БД, чтобы UI мог показать экспорт/восстановление?
- Нужен ли явный user-visible recovery report после crash (например, "обработано N пропущенных событий")?
