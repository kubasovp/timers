# ADR-003: Plugin-first modular monolith

Status: Accepted  
Date: 2026-07-01  
Owner: github.com/kubasovp  
Canonical: docs/adr/ADR-003-plugin-first-modular-monolith.md

## Context

Timers — локальное desktop-приложение для коротких временных сценариев:

- Pomodoro;
- custom timers;
- reminders.

На раннем этапе документация использовала привычную слоистую структуру `core/application/adapters/infra`. Такой подход хорошо фиксирует dependency rule, но хуже соответствует целевой идее продукта: минимальное ядро приложения + независимые подключаемые бизнес-модули.

Реализации ещё нет, поэтому архитектурную модель можно поменять без миграционной цены.

## Decision

Используем **plugin-first modular monolith**.

В MVP это означает:

- одна кодовая база;
- один desktop app bundle;
- внутренние feature-модули подключаются как плагины через `AppFeature.register(context)`;
- kernel остаётся минимальным и не содержит бизнес-логики;
- бизнес-функции живут вертикальными модулями в `src/features/*`;
- platform adapters живут отдельно и подключаются через composition root.

Базовые runtime-части:

```text
src/kernel      # feature contract, registries, command/query/scheduler contracts
src/features    # custom-timer, pomodoro, reminders
src/platform    # Tauri, SQLite, notifications, clock, scheduler loop, bootstrap
src/shared      # domain-neutral primitives/utilities
```

Слоистая архитектура не удаляется как принцип полностью. Она становится локальной дисциплиной внутри feature-модулей:

```text
feature/ui -> feature/use-cases -> feature/domain
feature/persistence -> feature/ports
feature/scheduler -> feature/use-cases|domain
```

## Considered options

### Option A: Layer-first clean/hexagonal architecture

```text
src/core
src/application
src/adapters
src/infra
```

Плюсы:
- привычно;
- хорошо объясняет dependency rule;
- просто для небольшого MVP.

Минусы:
- бизнес-модуль размазывается по слоям;
- Pomodoro/Timer/Reminder сложнее отключать и развивать независимо;
- выше риск скрытого монолита через общий application/core слой;
- хуже соответствует цели “ядро + подключаемые модули”.

### Option B: External plugin system

Плюсы:
- настоящие сторонние плагины;
- динамическая загрузка;
- потенциально расширяемая экосистема.

Минусы:
- преждевременная сложность;
- нужны sandbox, permissions, version compatibility, plugin SDK;
- для MVP нет пользовательской ценности;
- сильно увеличивает архитектурный налог.

### Option C: Plugin-first modular monolith

Плюсы:
- соответствует целевой модели “минимальное ядро + бизнес-модули”;
- проще внешней plugin system;
- хорошо подходит для pet-проекта без существующей реализации;
- позволяет тренировать реальные архитектурные границы;
- даёт возможность позже перейти к внешним плагинам, если появится реальная причина.

Минусы:
- требует дисциплины импортов;
- возможны дубли между feature-модулями;
- kernel может распухнуть, если не ограничивать его ответственность;
- сложнее стартовать, чем с простой layer-first структуры.

## Consequences

### Positive

- Pomodoro, Custom Timer и Reminders становятся самостоятельными вертикальными модулями.
- Новый модуль добавляется через один понятный contract.
- Scheduler работает через registered scheduler sources и не знает бизнес-деталей модулей.
- UI shell рендерит зарегистрированные routes/navigation и вызывает commands/queries.
- Composition root явно показывает, какие модули включены.

### Negative / risks

- Нужны архитектурные тесты на запрет неправильных импортов.
- Нельзя превращать `shared` в свалку.
- Нельзя превращать `kernel` в “бог-объект”.
- Нельзя использовать event bus как основной способ бизнес-связи, иначе зависимости станут невидимыми.

## Rules

1. `kernel` не импортирует `features`, `platform`, Vue, Tauri, SQLite.
2. Feature-модули не импортируют внутренности других feature-модулей.
3. `domain` и `use-cases` feature-модуля не зависят от Vue/Tauri.
4. Platform adapters не содержат бизнес-правила времени.
5. Composition root — единственное место, где выбирается список активных feature-модулей.
6. Event bus используется только для observability/history/metrics, не как основной бизнес-механизм.

## Follow-ups

- Обновить C4 container diagram под `kernel/features/platform`.
- Обновить development view под feature-first layout.
- Добавить `feature-module-contract.md`.
- Позже синхронизировать `data-model-v1.md` с feature-owned migrations.
- Позже добавить dependency-cruiser/ESLint boundaries.
