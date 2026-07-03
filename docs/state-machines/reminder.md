# State Machine — Reminder

Status: Draft
Owner: github.com/kubasovp
Last reviewed (UTC): 2026-07-03
Scope: Состояния и переходы напоминания
Canonical: docs/state-machines/reminder.md

## Состояния
- `enabled`
- `due`
- `snoozed`
- `done`
- `disabled`
- `deleted`

## Таблица переходов
| Current | Command/Event | Next | Notes |
|---|---|---|---|
| enabled | due_at_reached | due | one-time/daily: момент показа, требуется действие пользователя |
| enabled | due_at_reached | enabled | interval: показать alert/sound и сразу пересчитать следующий `nextFireAtUtc` |
| due | snooze | snoozed | one-time: перенос reminder; recurring: перенос текущего logical occurrence |
| snoozed | due_at_reached | due | one-time/daily: повторный показ |
| snoozed | due_at_reached | enabled | interval: повторный показ snoozed occurrence и возврат к cadence |
| due | done | done | one-time reminder закрыт terminal-состоянием |
| due | done | enabled | daily recurring occurrence закрыт, правило остаётся активным с будущим `nextFireAtUtc` |
| enabled | disable | disabled | выключение напоминания |
| snoozed | disable | disabled | выключение отложенного напоминания |
| due | disable | disabled | interval stop из legacy/stale `due` состояния |
| disabled | enable | enabled | повторное включение |
| enabled | delete | deleted | удаление |
| due | delete | deleted | удаление |
| snoozed | delete | deleted | удаление |
| disabled | delete | deleted | удаление выключенного напоминания |
| done | delete | deleted | удаление закрытого напоминания |

## Правила времени
- В MVP one-time reminders работают как fixed UTC instant: после создания `one_time_fire_at_utc` не пересчитывается при смене timezone.
- В MVP daily reminders работают в `local-floating`: локальное время интерпретируется в текущей timezone устройства.
- Interval reminders считаются по elapsed UTC от `interval_anchor_at_utc`; смена timezone и DST не меняют cadence.
- Interval reminders при срабатывании не ждут `Done`: alert/sound доставляется, occurrence записывается, правило остаётся `enabled` и получает следующий `next_fire_at_utc`.
- DST spring-forward: перенос на ближайшее валидное локальное время.
- DST fall-back: первое вхождение времени, без двойного срабатывания на одну локальную дату.
- Если после смены timezone/restart пересчитанное daily-время текущей локальной даты уже прошло, применяется правило:
  - в пределах grace window — сработать один раз сейчас;
  - вне grace window — пропустить текущую локальную дату и взвести следующее срабатывание на завтра;
  - если `last_fired_local_date` уже равен текущей локальной дате — не срабатывать повторно.
- Для recurring reminders `next_fire_at_utc` всегда можно восстановить из persisted rule/state: `daily_time_local` + current timezone или `interval_anchor_at_utc` + `interval_seconds`.

## Правила occurrence acknowledgement
- One-time `Done` переводит reminder в `done`, `is_enabled=false`.
- Daily recurring `Done` закрывает текущий occurrence и возвращает reminder в `enabled` с будущим `next_fire_at_utc`.
- Interval reminders управляются через `Stop`, а не через `Done`/`Snooze` в UI.
- Recurring `Snooze` переносит текущий occurrence; исходная daily local date или interval scheduled occurrence остаются logical dedup key для command-level совместимости.
- Disable для `snoozed` recurring reminder выключает всё правило, включая отложенный occurrence.

## Некорректные команды
Некорректная команда в текущем состоянии возвращает доменную ошибку. UI показывает нейтральное уведомление.
