# State Machine — Reminder

Status: Draft
Owner: github.com/kubasovp
Last reviewed (UTC): 2026-07-01
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
| enabled | due_at_reached | due | момент показа |
| due | snooze | snoozed | пересчёт `nextAt` |
| snoozed | due_at_reached | due | повторный показ |
| due | done | done | закрыто пользователем |
| enabled | disable | disabled | выключение напоминания |
| disabled | enable | enabled | повторное включение |
| enabled | delete | deleted | удаление |
| due | delete | deleted | удаление |
| snoozed | delete | deleted | удаление |

## Правила времени
- В MVP one-time reminders работают как fixed UTC instant: после создания `one_time_fire_at_utc` не пересчитывается при смене timezone.
- В MVP daily reminders работают в `local-floating`: локальное время интерпретируется в текущей timezone устройства.
- DST spring-forward: перенос на ближайшее валидное локальное время.
- DST fall-back: первое вхождение времени, без двойного срабатывания на одну локальную дату.
- Если после смены timezone/restart пересчитанное daily-время текущей локальной даты уже прошло, применяется правило:
  - в пределах grace window — сработать один раз сейчас;
  - вне grace window — пропустить текущую локальную дату и взвести следующее срабатывание на завтра;
  - если `last_fired_local_date` уже равен текущей локальной дате — не срабатывать повторно.

## Некорректные команды
Некорректная команда в текущем состоянии возвращает доменную ошибку. UI показывает нейтральное уведомление.
