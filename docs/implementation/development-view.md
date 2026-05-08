# Implementation Blueprint — Development View

Status: Draft (implementation-ready baseline)  
Owner: github.com/kubasovp  
Last updated (UTC): 2026-05-08  
Scope: Техническая структура кода и правила зависимостей  
Canonical: docs/implementation/development-view.md

## 1) Цель

Документ фиксирует **минимально достаточный** technical baseline для начала реализации, чтобы:
- не разъехалась архитектура по слоям;
- импорты оставались контролируемыми;
- каждый новый модуль добавлялся предсказуемо (tests + wiring + docs).

## 2) Предлагаемая структура папок

```text
src/
  core/
    domain/
      timer/
      pomodoro/
      reminder/
      shared/
  application/
    use-cases/
      commands/
      queries/
    ports/
  adapters/
    primary/
      ui/
      cli/                 # future
    secondary/
      sqlite/
      notifications/
      clock/
  infra/
    scheduler/
      loop/
      reconcile/
    bootstrap/
      wiring/
      config/
```

## 3) Ответственность слоёв

- `core/domain`: сущности, value objects, инварианты, доменные переходы состояний; без UI/DB/OS деталей.
- `application`: orchestration use-cases, транзакционные boundaries, application ports.
- `adapters`: реализация внешних интерфейсов (UI, SQLite, OS notifications, clock).
- `infra`: runtime lifecycle, scheduler loop, dependency wiring, process-level concerns.

Согласовано с текущим C4-направлением: ядро + scheduler как platform-agnostic, outer layers как адаптеры.

## 4) Разрешённые направления импортов

Разрешённый граф (внутрь):
- `infra -> application -> core`
- `adapters -> application`
- `adapters -> core` (только read-only contracts/value objects; без orchestration)

Запрещено:
- `core -> application|adapters|infra`
- `application -> infra`
- `application -> UI framework / Tauri / SQLite SDK`

## 5) Где живут use-case команды

- `src/application/use-cases/commands/*`.
- Один файл = один use-case command handler (например, `start_timer`, `pause_timer`, `create_reminder`).
- Read side (`queries`) не меняет state и может использовать отдельные read-model interfaces.

## 6) Где живёт scheduler loop

- `src/infra/scheduler/loop/*`.
- Scheduler reconcile logic может вызывать application-level use-cases/ports, но не должен напрямую внедрять UI-сценарии.
- Абсолютное время и reconcile policy должны быть согласованы с `docs/implementation/scheduler-contract.md`.

## 7) Где происходит wiring зависимостей

- Composition root: `src/infra/bootstrap/wiring/*`.
- Только здесь связываются конкретные реализации (SQLite repo, Tauri notifier, system clock) с application ports.
- Любой модуль вне composition root не создаёт инфраструктурные зависимости через `new`/`init` скрыто внутри домена.

## 8) Публичные контракты слоя

Публичными контрактами считаются:
- `application/ports/*` (inbound/outbound interfaces);
- команды/DTO use-case слоя, используемые UI/CLI адаптерами;
- доменные state-machine контракты (`docs/state-machines/*`) как поведенческий reference.

Изменение публичного контракта требует:
1) обновить контрактный документ;
2) обновить тесты интеграции;
3) обновить traceability в `docs/testing/mvp-test-plan.md`.

## 9) Forbidden dependencies (анти-примеры)

Явно запрещённые импорты:
- `src/core/**` импортирует `tauri`, `electron`, `sqlite`, `sqlx`, `rusqlite`, `vue`.
- `src/application/**` импортирует конкретный DB driver.
- `src/infra/scheduler/**` импортирует UI state store напрямую.
- `src/adapters/primary/ui/**` содержит SQL-запросы.

## 10) Definition of Done для нового модуля

Новый компонент считается завершённым только если выполнены все пункты:
1. Есть unit-тесты на доменные инварианты/ветки use-case.
2. Есть минимум один integration test на wiring (happy path).
3. Модуль подключён в composition root.
4. Добавлены/обновлены метрики/логи (если модуль участвует в runtime).
5. Обновлены соответствующие документы (`implementation/*`, `testing/*`, при необходимости ADR).
6. Добавлен пункт в release notes / changelog (если влияет на пользовательское поведение).

## 11) Open questions

- Нужна ли отдельная директория `read-models` для query-оптимизации в MVP или достаточно query use-cases?
- Нужен ли feature-sliced вариант структуры для UI-адаптера уже в MVP?
