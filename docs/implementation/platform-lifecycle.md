# Platform Lifecycle Contract

Status: Draft (runtime/platform contract)  
Owner: github.com/kubasovp  
Last updated (UTC): 2026-07-01
Scope: Startup/Shutdown/Recovery semantics  
Canonical: docs/implementation/platform-lifecycle.md

## 1) Startup order

1. Загрузка конфигурации и настроек видимости UI-панелей.
2. Инициализация storage (SQLite), проверка/применение миграций.
3. Инициализация adapters (clock, notifications, optional telemetry/update).
4. Wiring application services (composition root).
5. Первичный reconcile scheduler.
6. Переход приложения в `ready`.

Фактическая MVP-реализация:
- внутри Tauri runtime открывает `sqlite:timers.db` через `@tauri-apps/plugin-sql`;
- platform migration runner применяет system и feature migrations из registry до mount UI;
- custom timer repository и scheduler dispatch store используют SQLite;
- вне Tauri web/dev runtime использует browser/localStorage adapters как fallback.

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

## 6) Решения для MVP

- Режим `degraded-readonly` при повреждённой БД не вводится в MVP (избыточно для текущего scope).
- Явный user-visible recovery report после crash не вводится в MVP; достаточно внутреннего лога восстановления.
- Отдельный background service/daemon не вводится. Уведомления работают пока app process запущен; после полного закрытия пропущенные события восстанавливаются на следующем старте через reconcile.
