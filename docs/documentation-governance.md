# Documentation Governance

Status: Draft  
Owner: github.com/kubasovp  
Last updated (UTC): 2026-07-01
Scope: Правила владения, обновления и версионирования документации  
Canonical: docs/documentation-governance.md

## 1) Source of truth matrix

| Область | Каноничный документ | Назначение |
|---|---|---|
| Product vision/scope | `docs/01-vision-and-scope.md` | Цели, границы, не-цели |
| Functional behavior | `docs/02-functional-overview.md` + state machines | Функциональные сценарии и переходы |
| Quality constraints | `docs/03-quality-and-constraints.md` | NFR и ограничения |
| Architecture context/container/component | `docs/L1-system-context.md`, `docs/L2-container.md`, `docs/L3-scheduler-component.md` | C4-представление |
| Architecture decisions | `docs/adr/*` | Нормативные решения и компромиссы |
| Implementation structure | `docs/implementation/development-view.md` | Feature-модули, импорты, DoD модулей |
| Data model | `docs/implementation/data-model-v1.md` | Логическая схема и эволюция |
| Scheduler runtime contract | `docs/implementation/scheduler-contract.md` | Tick/misfire/retry/dedup/observability |
| Platform lifecycle | `docs/implementation/platform-lifecycle.md` | Startup/readiness/shutdown/recovery |
| MVP verification | `docs/testing/mvp-test-plan.md` | Acceptance gates и traceability |

## 2) When to update (триггеры)

Обязательное обновление docs требуется при:
1. новой пользовательской фиче или изменении сценария;
2. изменении публичного контракта слоя/интерфейса;
3. изменении схемы данных/миграций;
4. изменении scheduler policy (misfire/retry/dedup/concurrency);
5. изменении lifecycle semantics startup/shutdown/recovery;
6. принятии/изменении ADR.

## 3) PR checklist (docs)

Каждый PR должен явно ответить:
- `[ ]` Нужны ли изменения документации?
- `[ ]` Если да, обновлены ли canonical docs?
- `[ ]` Добавлена ли traceability между изменённым контрактом и тестами?
- `[ ]` Если документ устарел, отмечен ли deprecation статус?

Если PR меняет контракт и не обновляет docs — PR не готов к merge.

## 4) Versioning policy

- Основные implementation документы версионируются semantic-like маркерами: `v1`, `v1.1`, `v1.2`.
- `v1 -> v2` используется при несовместимых изменениях модели/контракта.
- Минорные версии (`v1.1`) — уточнения без критических breaking changes.
- Версия должна быть отражена в заголовке документа и/или разделе "Schema/Contract version".

## 5) Deprecation policy

Для устаревающих документов:
1. Указать явный статус `Deprecated` или `Legacy / Reference`.
2. Добавить ссылку на заменяющий canonical документ.
3. Указать дату и причину deprecation.
4. Не удалять документ, пока есть активные ссылки/процессы, завязанные на него.

## 6) GRASP в документации — как использовать

GRASP уместен не как обязательный формат документа, а как **review lens**:
- проверять распределение ответственности (Information Expert, Controller);
- снижать coupling и повышать cohesion;
- фиксировать решения в implementation/docs и ADR, если GRASP-анализ повлиял на архитектурные границы.

Минимальное правило: не навязывать GRASP-шаблоны в каждом документе; использовать точечно там, где это помогает обосновать ответственность компонентов.

## 7) Open questions

- Нужен ли единый шаблон front-matter (Status/Owner/Last Updated/Canonical) для всех docs?
- Нужен ли автоматический docs-lint в CI (проверка broken links + обязательных секций)?
