# State Machine — Pomodoro

Status: Draft
Owner: github.com/kubasovp
Last reviewed (UTC): 2026-05-07
Scope: Состояния и переходы Pomodoro-сессии
Canonical: docs/state-machines/pomodoro.md

## Состояния
- `idle`
- `running_work`
- `running_break`
- `paused_work`
- `paused_break`
- `completed`
- `stopped`
- `skipped`

## Таблица переходов
| Current | Command/Event | Next | Notes |
|---|---|---|---|
| idle | start | running_work | старт новой сессии |
| running_work | pause | paused_work |  |
| paused_work | resume | running_work |  |
| running_work | stop | stopped | завершение вручную |
| paused_work | stop | stopped | завершение вручную |
| running_work | skip | skipped | фиксируется отдельно от completed |
| running_break | skip | skipped | фиксируется отдельно от completed |
| running_break | pause | paused_break |  |
| paused_break | resume | running_break |  |
| running_break | stop | stopped | завершение вручную |
| paused_break | stop | stopped | завершение вручную |
| running_work | phase_end | running_break | автопереход |
| running_break | phase_end | completed | финал сессии |

## Некорректные команды
Некорректная команда в текущем состоянии возвращает доменную ошибку. UI показывает нейтральное уведомление.
