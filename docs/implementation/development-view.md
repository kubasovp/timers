# Implementation Blueprint — Development View

Status: Draft (feature/plugin-first baseline)  
Owner: github.com/kubasovp  
Last updated (UTC): 2026-07-01  
Scope: Техническая структура кода, feature-модули и правила зависимостей  
Canonical: docs/implementation/development-view.md

## 1) Цель

Документ фиксирует **минимально достаточный** technical baseline для начала реализации Timers, чтобы:

- приложение не превратилось в запутанный монолит;
- бизнес-функции подключались предсказуемо;
- Focus, Custom Timer и Reminders не мешали друг другу;
- ядро оставалось минимальным и не знало бизнес-деталей;
- каждый новый модуль добавлялся через один понятный контракт.

Базовый архитектурный стиль: **plugin-first modular monolith**.

Это не внешняя plugin system и не marketplace расширений. В MVP все модули находятся в одной кодовой базе, но подключаются к приложению как внутренние feature-плагины.

Каноничный контракт модулей: `docs/implementation/feature-module-contract.md`.

## 2) Главная структура runtime-кода

```text
src/
  kernel/                              # минимальное ядро приложения
    feature-contract/                  # AppFeature, FeatureRegistrationContext
    registries/                        # command/query/route/navigation/scheduler/settings registries
    commands/                          # command bus contracts and result types
    scheduler/                         # scheduler source/action contracts
    storage/                           # storage/database contracts, без SQLite details
    errors/                            # app-level errors without business details

  platform/                            # конкретные desktop/OS/storage интеграции
    bootstrap/                         # composition root / module loading / DI wiring
    tauri/                             # Tauri host bridge
    sqlite/                            # SQLite connection, migrations runner, low-level DB tools
    notifications/                     # OS notifications adapter
    clock/                             # system clock adapter
    scheduler-loop/                    # общий loop/reconcile dispatcher
    config/                            # runtime config

  features/                            # вертикальные бизнес-модули
    custom-timer/
      index.ts                         # exports AppFeature
      manifest.ts
      domain/
      use-cases/
      ports.ts
      ui/
      persistence/
      scheduler/
      migrations/
      tests/

    focus/
      index.ts
      manifest.ts
      domain/
      use-cases/
      ports.ts
      ui/
      persistence/
      scheduler/
      migrations/
      tests/

    reminders/
      index.ts
      manifest.ts
      domain/
      use-cases/
      ports.ts
      ui/
      persistence/
      scheduler/
      migrations/
      tests/

  shared/                              # доменно-нейтральные primitives/utilities
    time/
    result/
    validation/
```

Главная единица структуры — `feature`, а не слой.

Слои остаются как **внутренняя дисциплина модуля**:

```text
feature/ui -> feature/use-cases -> feature/domain
feature/persistence -> feature/ports
feature/scheduler -> feature/use-cases|feature/domain
```

## 3) Ответственность частей системы

### `kernel`

Минимальное ядро приложения.

Отвечает за:
- контракты feature-модулей;
- registry для routes/navigation/commands/queries/scheduler/settings/migrations;
- общие result/error-типы;
- общие интерфейсы scheduler source/action.

Не отвечает за:
- Focus-логику;
- custom timer-логику;
- reminder-логику;
- SQLite-запросы;
- Tauri API;
- Vue-компоненты.

### `features/*`

Вертикальные бизнес-модули.

Каждый модуль владеет своей бизнес-функцией полностью:
- domain rules;
- state machine;
- use-cases;
- UI screens/components;
- persistence mapping;
- scheduler integration;
- migrations;
- tests.

### `platform`

Внешняя среда и runtime.

Отвечает за:
- Tauri bridge;
- SQLite connection;
- migrations runner;
- OS notifications;
- system clock;
- scheduler loop;
- composition root.

Tauri/Rust часть в MVP остаётся platform boundary. Бизнес-логика времени, state machines и use-cases живут в TypeScript feature-модулях.

### `shared`

Только доменно-нейтральные вещи:
- `Instant`, `Duration`, time helpers;
- `Result`/`Option`-подобные типы;
- простые validators;
- pure utilities.

`shared` не должен становиться свалкой бизнес-логики.

## 4) Composition root

Composition root живёт в:

```text
src/platform/bootstrap/
```

Только здесь приложение выбирает статический набор feature-модулей и передаёт им registration context.

```ts
const appFeatures = [
  customTimerFeature,
  focusFeature,
  remindersFeature,
];

for (const feature of appFeatures) {
  feature.register(featureRegistrationContext);
}
```

В MVP список активных бизнес-модулей статичен. Пользовательская настройка "отключить модуль" реализуется как UI-настройка видимости панели/навигации:

```ts
const visiblePanels = userSettings.visiblePanels;
```

Скрытие панели не выгружает модуль и не отключает его scheduler sources. Например, скрытая панель reminders не должна отключать уже созданные напоминания.

Настоящее runtime-отключение feature-модулей откладывается до post-MVP и требует отдельного решения по scheduler behavior, миграциям, данным и recovery.

## 5) Разрешённые направления импортов

Разрешено:

```text
platform/bootstrap -> features/*
platform/* -> kernel/*
platform/sqlite -> kernel/storage contracts
features/* -> kernel/*
features/* -> shared/*
features/<id>/ui -> Vue
features/<id>/persistence -> kernel/storage contracts
features/<id>/scheduler -> kernel/scheduler contracts
```

Внутри feature-модуля:

```text
ui -> use-cases -> domain
scheduler -> use-cases|domain
persistence -> ports|domain value objects
```

Запрещено:

```text
kernel -> features/*
kernel -> platform/*
kernel -> Vue|Tauri|SQLite
features/<id>/domain -> Vue|Tauri|SQLite
features/<id>/use-cases -> Vue|Tauri
features/<id>/persistence -> concrete platform/sqlite implementation
features/A -> features/B/internal/*
platform/scheduler-loop -> features/*/ui
```

## 6) Публичная поверхность модуля

Каждый feature-модуль имеет единственный public entrypoint:

```text
src/features/<feature-id>/index.ts
```

Он экспортирует:
- `AppFeature`;
- публичные типы, если они нужны другим модулям;
- публичный contract/API, если зависимость между модулями действительно нужна.

Другим модулям запрещено импортировать файлы глубже public entrypoint без отдельного архитектурного решения.

Плохо:

```ts
import { reminderRepository } from '@/features/reminders/persistence/reminderRepository';
```

Допустимо:

```ts
import { remindersFeature } from '@/features/reminders';
```

Допустимо при явной зависимости:

```ts
import type { ReminderId } from '@/features/reminders';
```

## 7) Inter-feature communication

Приоритет способов связи:

1. **Не связывать модули**, если сценарий можно оставить внутри одного feature.
2. **Command/query registry**, если один модуль должен запросить действие приложения.
3. **Публичный API модуля**, если есть настоящая стабильная зависимость.
4. **Domain/app events** только для history, logs, metrics, не как основной бизнес-механизм.

Event bus не является основным способом бизнес-взаимодействия в MVP.

Если post-MVP появится общий обзор всех сценариев, он должен быть отдельным feature-модулем (`features/overview`) и читать данные через публичные queries/contracts, не импортируя внутренности Focus/Timer/Reminder.

## 8) Scheduler loop

Scheduler loop живёт в:

```text
src/platform/scheduler-loop/
```

Scheduler loop не знает бизнес-деталей Focus/Timer/Reminder. Он работает с `SchedulerSource`, зарегистрированными модулями:

```ts
export interface SchedulerSource {
  id: string;
  sourceType: 'timer' | 'focus' | 'reminder';

  getNextFireAt(now: Instant): Promise<Instant | null>;
  reconcile(now: Instant): Promise<SchedulerAction[]>;
}
```

Feature-модули сами реализуют правила reconcile своей области.

Общий scheduler отвечает за:
- tick loop;
- вызов registered sources;
- idempotency/dedup на уровне dispatch;
- retry/failure policy;
- передачу notification requests в platform notifications adapter.

Поведение loop должно быть согласовано с `docs/implementation/scheduler-contract.md`.

## 9) Где живут use-case команды

Use-cases живут внутри конкретного feature-модуля:

```text
src/features/custom-timer/use-cases/startTimer.ts
src/features/focus/use-cases/startFocusSession.ts
src/features/reminders/use-cases/createReminder.ts
```

Регистрация команд происходит в `feature.register(context)`:

```ts
context.commands.add('timer.start', startTimer);
context.commands.add('focus.start', startFocusSession);
context.commands.add('reminder.create', createReminder);
```

Один command handler = один пользовательский или runtime-сценарий.

## 10) Где живут DB migrations

Миграции принадлежат feature-модулям, но исполняются централизованно platform migrations runner.

```text
src/features/custom-timer/migrations/
src/features/focus/migrations/
src/features/reminders/migrations/
```

Модуль регистрирует свои миграции через:

```ts
context.migrations.add(customTimerMigrations);
```

Это позволяет скрывать UI модуля без автоматического удаления пользовательских данных.

## 11) UI structure

UI shell живёт в platform/app shell части и рендерит зарегистрированные routes/navigation.

Feature UI живёт внутри модуля:

```text
src/features/custom-timer/ui/
src/features/focus/ui/
src/features/reminders/ui/
```

Анти-паттерн:

```text
Vue component -> считает время -> пишет в local state/SQLite
```

Целевой поток:

```text
Vue component -> command/query -> feature use-case -> feature domain -> persistence port
```

## 12) Архитектурные проверки

Минимальные проверки в CI:

1. `kernel` не импортирует `features`, `platform`, `Vue`, `Tauri`, `SQLite`.
2. `features/*/domain` не импортирует `Vue`, `Tauri`, `SQLite`.
3. `features/*/use-cases` не импортирует `Vue`, `Tauri`.
4. `features/A` не импортирует внутренние пути `features/B/*`, кроме public entrypoint.
5. `platform/scheduler-loop` не импортирует UI.

Для MVP выбран `dependency-cruiser` как основной инструмент architecture boundary checks. ESLint можно добавить позже для style/correctness/Vue-specific linting, но не как M0 boundary tool.

## 13) Definition of Done для нового feature-модуля

Новый feature-модуль считается завершённым, если:

1. Есть `index.ts` с `AppFeature`.
2. Есть `manifest.ts` с `id`, `title`, `version`, `dependencies`.
3. Все routes/navigation/commands/queries/scheduler sources регистрируются через `register(context)`.
4. Нет импортов из внутренних файлов другого модуля.
5. Есть unit-тесты на domain/use-cases.
6. Есть integration test на регистрацию модуля в composition root.
7. Если модуль хранит данные — есть migrations и описание схемы.
8. Если модуль участвует в scheduler — есть тесты reconcile/idempotency.
9. Обновлены docs/release notes при изменении пользовательского поведения.

## 14) Решение по структуре MVP

MVP реализуется как три feature-модуля:

```text
features/custom-timer
features/focus
features/reminders
```

Рекомендуемый порядок реализации:

1. `custom-timer` — первый вертикальный срез и проверка feature contract.
2. `focus` — второй модуль с отдельной state machine и профилями.
3. `reminders` — самый сложный модуль из-за повторов, snooze, missed events, DST/timezone и очереди уведомлений.

Отдельная глобальная структура `core/application/adapters` в MVP не используется как главный layout. Чистые зависимости сохраняются внутри каждого feature-модуля и через `kernel/platform` boundary.
