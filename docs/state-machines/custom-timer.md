# State Machine — Custom Timer

Status: Draft
Owner: github.com/kubasovp
Last reviewed (UTC): 2026-05-07
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

## Некорректные команды
Некорректная команда в текущем состоянии возвращает доменную ошибку. UI показывает нейтральное уведомление.
