# Open Items / To-Do for Architecture

Status: Draft  
Owner: github.com/kubasovp  
Last reviewed (UTC): 2026-05-06  
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
