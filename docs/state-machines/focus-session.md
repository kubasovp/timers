# State Machine — Focus Session

Status: Draft
Owner: github.com/kubasovp
Last reviewed (UTC): 2026-07-01
Scope: Состояния и переходы фокус-сессии
Canonical: docs/state-machines/focus-session.md

## Состояния
- `idle`
- `running_focus`
- `running_break`
- `paused_focus`
- `paused_break`
- `completed`
- `stopped`
- `skipped`

## Таблица переходов
| Current | Command/Event | Next | Notes |
|---|---|---|---|
| idle | start | running_focus | старт новой сессии |
| running_focus | pause | paused_focus |  |
| paused_focus | resume | running_focus |  |
| running_focus | stop | stopped | завершение вручную |
| paused_focus | stop | stopped | завершение вручную |
| running_focus | skip | skipped | фиксируется отдельно от completed |
| running_break | skip | skipped | фиксируется отдельно от completed |
| running_break | pause | paused_break |  |
| paused_break | resume | running_break |  |
| running_break | stop | stopped | завершение вручную |
| paused_break | stop | stopped | завершение вручную |
| running_focus | phase_end | running_break | автопереход |
| running_break | phase_end | completed | финал сессии |

## Некорректные команды
Некорректная команда в текущем состоянии возвращает доменную ошибку. UI показывает нейтральное уведомление.
