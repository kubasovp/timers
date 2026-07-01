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

## Таблица переходов
| Current | Command/Event | Next | Notes |
|---|---|---|---|
| idle | start | running_focus | старт новой сессии |
| running_focus | pause | paused_focus |  |
| paused_focus | resume | running_focus |  |
| running_focus | stop | stopped | завершение вручную |
| paused_focus | stop | stopped | завершение вручную |
| running_focus | skip | running_break | пропустить текущую focus-фазу; не увеличивает `focus_completed_cycles`; событие пишется как `focus_phase_skipped` |
| running_break | skip | running_focus | пропустить `short_break` и перейти к следующей focus-фазе |
| running_break | skip | completed | пропустить `long_break` и завершить сессию |
| running_break | pause | paused_break |  |
| paused_break | resume | running_break |  |
| running_break | stop | stopped | завершение вручную |
| paused_break | stop | stopped | завершение вручную |
| running_focus | phase_end | running_break | автопереход; `focus_completed_cycles += 1`; последняя focus-фаза ведёт в `long_break`, остальные — в `short_break` |
| running_break | phase_end | running_focus | автопереход после `short_break`, если есть следующий cycle |
| running_break | phase_end | completed | финал сессии после `long_break` |

## Cycle semantics

- `cycles_before_long_break` в профиле задаёт число focus-фаз в одной сессии.
- Сессия начинается с `running_focus`, `focus_cycle_index = 1`, `focus_completed_cycles = 0`.
- После естественного завершения focus-фазы увеличивается `focus_completed_cycles`.
- `skip` focus-фазы переводит сессию к break-фазе текущего cycle, но не увеличивает `focus_completed_cycles`.
- Если текущий `focus_cycle_index < focus_total_cycles`, следующая break-фаза — `short_break`, затем новый `running_focus` с `focus_cycle_index + 1`.
- Если текущий `focus_cycle_index == focus_total_cycles`, следующая break-фаза — `long_break`, после неё сессия переходит в `completed`.
- `Stop session` переводит всю сессию в `stopped`; `Skip phase`/`Skip break` двигает только текущую фазу и фиксируется отдельным history event.

## Некорректные команды
Некорректная команда в текущем состоянии возвращает доменную ошибку. UI показывает нейтральное уведомление.
