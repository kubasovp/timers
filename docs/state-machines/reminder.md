# State Machine — Reminder

Status: Draft
Owner: github.com/kubasovp
Last reviewed (UTC): 2026-05-07
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
- В MVP daily reminders работают в `local-floating`.
- DST spring-forward: перенос на ближайшее валидное локальное время.
- DST fall-back: первое вхождение времени, без двойного срабатывания на одну локальную дату.

## Некорректные команды
Некорректная команда в текущем состоянии возвращает доменную ошибку. UI показывает нейтральное уведомление.
