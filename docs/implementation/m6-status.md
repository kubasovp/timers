# M6 Status — Reminders v1

Status: Implemented  
Owner: github.com/kubasovp  
Last updated (UTC): 2026-07-02  
Scope: One-time reminders, queue integration, snooze/done and one-time misfire handling

## Delivered

- `features/reminders` подключён через `AppFeature.register(context)`.
- Реализованы one-time reminders: create, enable, disable, delete.
- Реализованы состояния `enabled`, `due`, `snoozed`, `done`, `disabled`, `deleted`.
- Реализованы commands `reminders.done` и `reminders.snooze`.
- Добавлен scheduler source `reminders.one-time-due`.
- Одновременные reminders передаются в общий scheduler loop, который сортирует actions по `scheduledForUtc` и dispatch-ит их последовательно.
- One-time misfire policy использует 24h grace window: свежие missed reminders срабатывают один раз, слишком старые записываются как `skipped` без user-visible alert.
- Dedup выполняется через стабильный `idempotencyKey` и общий scheduler dispatch store.
- Добавлены browser, in-memory и SQL repositories.
- Добавлены migrations `reminders.v1` для `active_reminders` и `reminder_occurrences`.
- UI `/reminders` заменил shell placeholder и работает через command/query bus.
- Добавлены tests на state machine, use-cases, feature registration, due, snooze refire, missed/skipped, duplicate prevention и simultaneous queue behavior.
- После browser smoke добавлен scheduler hardening: зависший notification/sound delivery channel завершается timeout-ошибкой и не блокирует последующие ticks/reminders.

## Exit Gate

- One-time reminder срабатывает через scheduler, переводится в `due` и не создаёт дубль при повторном reconcile.
- Reminder, пропущенный после restart/sleep в пределах 24h grace window, срабатывает один раз.
- Reminder старше 24h переводится в `done` с occurrence `skipped`, без notification storm.
- Snooze создаёт новое `nextFireAtUtc`, и reminder повторно срабатывает по snoozed time.
- Browser/dev ограничения notification permission и autoplay не блокируют переход reminder в `due`.

## Verification

- `npm run typecheck`
- `npm run test`
- `npm run lint`
- `npm run build`
- `npm run test:e2e`

## Browser Dev Notes

- В Vite/browser режиме notification permission может быть запрошен только из пользовательского жеста браузера. Если permission не выдан, adapter пишет fallback в console.
- Браузер может блокировать Web Audio autoplay после reload/reopen вкладки до первого пользовательского жеста. Это ограничение browser fallback, не доменного scheduler.
- Scheduler loop не должен зависать из-за browser delivery limitations: reminders должны переходить в `due`, даже если звук или system notification не были доставлены.
- Native Tauri behavior нужно подтверждать отдельным packaged/native smoke. Текущий MVP adapter всё ещё browser-style; если WebView повторит ограничения обычного браузера, следующим шагом нужен native notification/sound adapter.

## Deferred To M7

- Daily `local-floating` reminders.
- Interval reminders.
- DST and timezone switch semantics.
- Configurable default snooze presets in settings.
