# Open Items / To-Do for Architecture

Status: Draft
Owner: github.com/kubasovp
Last reviewed (UTC): 2026-05-07
Scope: Список архитектурных вопросов и решений, требующих фиксации
Canonical: docs/open-items.md

## Перенесённые решения

Следующие пункты уже перенесены в профильные документы и не требуют отдельной фиксации здесь:
- state machine подход (формат + политика некорректных команд);
- timezone/DST политика для MVP;
- development view и dependency rule;
- метрики/тестовые бюджеты (MVP baseline);
- стратегия роста истории БД (MVP baseline);
- минимальный контракт автообновления (post-MVP ready baseline);
- политика телеметрии/приватности (MVP baseline + post-MVP).

## Открытые вопросы перед удалением файла

1. **Где хранить state machine артефакты как canonical source?**
   - Варианты: отдельный `docs/state-machines/*.md` или разделы в `02-functional-overview.md`.

2. **Нужно ли выделить отдельный документ release/update policy?**
   - Сейчас есть baseline-правила, но нет полного операционного процесса релиза и обновлений.

3. **Нужен ли отдельный privacy документ (consent, retention, data map)?**
   - Сейчас есть архитектурные правила, но нет пользовательского policy-текста.

4. **Нужно ли хранить этот файл как "decision index" вместо удаления?**
   - Если да, файл должен содержать только ссылки на canonical документы без дублирования содержимого.
