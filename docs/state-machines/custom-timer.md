# State Machine — Custom Timer

Status: Draft
Owner: github.com/kubasovp
Last reviewed (UTC): 2026-07-01
Scope: Состояния и переходы кастомного таймера
Canonical: docs/state-machines/custom-timer.md

## Состояния
- `idle`
- `running`
- `paused`
- `completed`
- `stopped`

## Таблица переходов
| Current | Command/Event | Next | Notes |
|---|---|---|---|
| idle | start | running | запуск таймера |
| running | pause | paused |  |
| paused | resume | running |  |
| running | stop | stopped | ручная остановка |
| paused | stop | stopped | ручная остановка |
| running | restart | running | пересчёт от исходной длительности |
| paused | restart | running | пересчёт и запуск |
| running | timer_end | completed | естественное завершение |
| completed | restart | running | повторный запуск той же reusable timer-карточки |

Примечание: если `running`/`paused` session является повторным запуском уже завершённой reusable timer-карточки, `stop` отменяет текущий запуск и возвращает карточку в `completed`, а не удаляет её из пользовательского списка. Для нового custom timer без предыдущего `completed` результат `stopped` является transient command result: UI его не показывает и storage не удерживает session-запись.

## Некорректные команды
Некорректная команда в текущем состоянии возвращает доменную ошибку. UI показывает нейтральное уведомление.
