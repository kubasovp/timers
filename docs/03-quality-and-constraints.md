# 03. Качество и ограничения

Status: Draft  
Owner: github.com/kubasovp  
Last reviewed (UTC): 2026-07-01  
Scope: Ограничения стека, NFR, риски и проверка полноты  
Canonical: docs/03-quality-and-constraints.md

## 3.1 Архитектурные ограничения

- Desktop shell: Tauri.
- Frontend: Vue + TypeScript.
- Local DB: SQLite.
- MVP: offline-first по умолчанию (default), без обязательного внешнего backend для базовых сценариев.
- При доступной сети могут включаться online-функции (проверка обновлений, агрегированная телеметрия), но их отказ не влияет на базовые локальные сценарии.

## 3.1.1 Архитектурные принципы для расширяемости

Timers использует **plugin-first modular monolith**:

- `kernel` — минимальное ядро приложения: контракты, registry, command/query dispatch, scheduler registry, navigation registry;
- `features/*` — вертикальные бизнес-модули: Custom Timer, Pomodoro, Reminders;
- `platform` — конкретные desktop/OS/storage интеграции: Tauri, SQLite, notifications, clock, scheduler loop;
- `shared` — доменно-нейтральные primitives/utilities.

Базовые правила:

- UI не содержит бизнес-логики времени; UI вызывает commands/queries зарегистрированных feature-модулей.
- Бизнес-логика времени живёт внутри соответствующего feature-модуля.
- `kernel` не знает бизнес-деталей Pomodoro/Timer/Reminder.
- `kernel` не зависит от Vue/Tauri/SQLite.
- Feature-модули не импортируют внутренние файлы друг друга.
- SQLite — единый источник истины для persisted state таймеров/напоминаний/настроек.
- Любой новый интерфейс (GUI/CLI/daemon) работает через тот же command/query/scheduler contract.

### Development view (MVP baseline)

Модульные границы (обязательные):

- `kernel` — feature contract, registries, command/query contracts, scheduler contracts, общие app-level errors;
- `features/custom-timer` — быстрые таймеры, пресеты, active custom timer sessions;
- `features/pomodoro` — Pomodoro profiles, Pomodoro sessions, work/break transitions;
- `features/reminders` — one-time/daily/interval reminders, snooze, done/delete, missed events;
- `platform` — Tauri, SQLite, OS notifications, clock, migrations runner, scheduler loop, composition root;
- `shared` — нейтральные primitives: time/result/validation.

Dependency rule (обязательный):

- допускаются зависимости `features -> kernel/shared`;
- допускаются зависимости `platform -> kernel`;
- `platform/bootstrap` может импортировать feature-модули для composition root;
- `kernel` не импортирует `features`, `platform`, Vue, Tauri, SQLite;
- feature-модули не импортируют внутренние пути других feature-модулей;
- domain/use-case код feature-модулей не зависит от Vue/Tauri.

Контроль правила зависимостей:

- линтер/архитектурный тест в CI проверяет запрет обратных и межмодульных импортов;
- public entrypoint каждого feature-модуля: `src/features/<feature-id>/index.ts`.

Минимальный обязательный набор use-case команд:

- `timer.start`
- `timer.pause`
- `reminder.create`
- `reminder.list`

Анти-паттерн (не допускается):

```text
Vue component -> считает время -> пишет в local state/SQLite
```

Целевой поток:

```text
Vue component -> command/query -> feature use-case -> feature domain -> persistence port
```

Каноничные implementation-документы:

- `docs/implementation/development-view.md`
- `docs/implementation/feature-module-contract.md`
- `docs/implementation/scheduler-contract.md`
- `docs/implementation/data-model-v1.md`

## 3.1.2 Версионирование, миграции и релизный контур (MVP-ready)

- Версии приложения по SemVer (`0.1.0`, `0.2.0`, `1.0.0`).
- Отдельные миграции SQLite с явной фиксацией версии схемы.
- Feature-модули владеют своими миграциями, но исполняет их централизованный platform migrations runner.
- В `app_settings` хранятся `appVersion` и `dbSchemaVersion`.
- В релизный процесс включены:
  - публикация changelog;
  - сборка артефактов по платформам;
  - подготовка метаданных для будущего автообновления (`latest.json`, подписи пакетов).

## 3.2 Ключевые требования к качеству

### Надёжность времени

- Таймеры/напоминания не «теряются» после сна/перезапуска.
- Нет зависимости от «идеального» тика `setInterval`.
- Целевая задержка срабатывания уведомления: не более 1 секунды.
- Daily reminders в MVP работают в режиме `local-floating`.
- При DST spring-forward (локальное время отсутствует) событие сдвигается на ближайшее валидное локальное время.
- При DST fall-back (локальное время двусмысленно) выбирается первое вхождение времени; напоминание срабатывает один раз на локальную календарную дату.
- При смене timezone устройства:
  - `local-floating` пересчитывается в новой локальной timezone;
  - `fixed-zone` (future) остаётся привязанным к выбранной IANA timezone.

### Предсказуемость UX

- Ясные состояния активен/пауза/завершён/пропущен/skip.
- Платформенные ожидания: Windows/macOS ≠ Linux по поведению окна.
- При совпадении нескольких событий используется очередь уведомлений.

### Производительность

- Низкая нагрузка в фоне (особенно для интервальных напоминаний).
- Быстрый cold start с восстановлением состояния.

### Поддерживаемость

- Явная доменная модель времени внутри feature-модулей.
- Трассируемость требований (ID F-POM/F-TMR/F-REM/F-WIN).
- Явные feature/module boundaries, позволяющие подключить CLI и daemon без переписывания бизнес-логики.
- Минимальное kernel API без бизнес-деталей.

### Проверяемость (MVP quality gates)

- Обязательные сценарии до первого релиза:
  - happy-path;
  - sleep/resume;
  - reboot/restart reconcile;
  - DST boundary.
- Проверка SLA уведомлений (`<= 1 сек`):
  - инструментированные integration-тесты;
  - ручная валидация минимум на 2 платформах.

### Эксплуатационные метрики и тестовые бюджеты (MVP)

- `notification_drift_ms` (p95/p99): отклонение фактического времени показа уведомления от `endsAt`/`nextAt`.
- `startup_reconcile_latency_ms` (p95): длительность процедуры reconcile при cold start.
- `missed_reminders_recovered_count`: количество пропущенных напоминаний, корректно обработанных после сна/перезапуска.
- Тестовый бюджет long-sleep: проверка сценариев сна устройства не менее 8 часов.

## 3.3 Риски

- Неконсистентное поведение системных уведомлений в разных DE Linux.
- DST/смена timezone могут ломать ежедневные напоминания без чёткой политики.
- Трей в Linux нестабилен между окружениями; в MVP логично исключён.
- Неограниченная история (до 1 ГБ текстовых записей) требует контроля роста БД и обслуживания.
- Feature-first структура может создать дублирование между модулями, если преждевременно не выделять действительно общие primitives в `shared`.
- Слишком широкий `kernel` может превратиться в скрытый монолит; kernel API должен оставаться минимальным.

## 3.3.1 Управление ростом истории и обслуживанием БД

- История хранится полностью по умолчанию (MVP), пользователь может удалять записи вручную.
- При достижении порогов размера БД рекомендуется обслуживающий сценарий:
  - ручной cleanup старых записей history;
  - `VACUUM`/compaction во время обслуживания.
- Пороговые значения для предупреждений и auto-maintenance выносятся в post-MVP.

## 3.3.2 Минимальный контракт автообновления (post-MVP ready)

- Манифест `latest.json` должен содержать минимум:
  - `version`, `platform`, `url`, `checksum`, `signature`.
- Проверка подписи обязательна перед применением обновления.
- Базовый install mode: explicit install или install on restart (финальный выбор фиксируется в release policy).
- При недоступности сети/манифеста: локальные сценарии не деградируют, update-check помечается как soft-fail.

## 3.3.3 Политика телеметрии и приватности (MVP + post-MVP)

- MVP baseline: только server-side метрики загрузок без клиентских идентификаторов.
- Опциональные post-MVP события:
  - first-run event;
  - update-check как proxy активных установок.
- Для любых клиентских событий обязательны:
  - явный consent;
  - анонимизация данных;
  - ограниченный retention-период;
  - прозрачное описание в privacy notice.

## 3.4 Проверка полноты по 4+1 (чек-лист)

- **Logical view:** есть функциональные блоки и доменные сущности.
- **Development view:** структура кода переведена на plugin-first feature modules.
- **Process view:** описаны runtime-сценарии восстановления времени.
- **Physical view:** платформенные различия зафиксированы.
- **Scenarios (+1):** ключевые use cases перечислены.

Вывод: для полноценной 4+1-покрытости следующим шагом нужно синхронизировать data model и state-machine документы с feature-first layout.
