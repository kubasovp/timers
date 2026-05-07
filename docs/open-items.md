# Open Items / To-Do for Architecture

Status: Draft  
Owner: github.com/kubasovp  
Last reviewed (UTC): 2026-05-07  
Scope: Список архитектурных вопросов и решений, требующих фиксации  
Canonical: docs/open-items.md

## Что нужно сделать

1. **Статусы и жизненный цикл сущностей требуют формализации.**
   - Желательно отдельная state machine для Pomodoro, Timer, Reminder.

2. **Не определена политика timezone/DST.**
   - Критично для ежедневных напоминаний.

3. **Нужны эксплуатационные метрики и тестовые бюджеты.**
   - drift, startup-reconcile latency, поведение при длительном сне устройства.

4. **Нужна стратегия работы с ростом истории.**
   - Контроль размера БД, архивирование, vacuum/compaction.

5. **Нужно зафиксировать runtime-модель уведомлений для CLI-сценариев.**
   - Варианты:
     - A: CLI только пишет в SQLite, уведомления показывает desktop app при запуске.
     - B: Отдельный `timers-daemon`, который наблюдает БД и показывает уведомления.
     - C: Системные планировщики (systemd user timers / Task Scheduler / launchd).
   - Для MVP выбрать A или B и явно описать ограничения UX.

6. **Нужно зафиксировать минимальный контракт автообновления (без полной реализации в MVP).**
   - Формат `latest.json` и поля версии/платформы/checksum/signature.
   - Политика проверки подписи и install mode (on restart / explicit install).
   - Что происходит при недоступности сети/манифеста.

7. **Нужно зафиксировать политику телеметрии и приватности.**
   - Слой 1: server-side downloads (без клиентских идентификаторов).
   - Слой 2 (опционально): first-run event.
   - Слой 3 (опционально): update-check как прокси активных установок.
   - Явные правила consent, анонимизации и retention.

8. **Нужен development view с модульными границами и зависимостями.**
   - Минимум: `core`, `application/use-cases`, `adapters (ui/cli/notifications/storage)`.
   - Зафиксировать dependency rule: outer layers зависят от inner layers, но не наоборот.
