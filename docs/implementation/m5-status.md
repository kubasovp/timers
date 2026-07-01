# M5 Status — Focus Feature

Status: Implemented  
Owner: github.com/kubasovp  
Last updated (UTC): 2026-07-01  
Scope: Реализация второго feature-модуля Focus

## Delivered

- `features/focus` подключён через `AppFeature.register(context)`.
- Реализованы focus profiles CRUD и default profile seeding.
- Реализована focus session state machine с pause/resume, `Stop session`, phase-level `Skip phase`/`Skip break` и multi-cycle phase transitions.
- Текущая phase/cycle progress сохраняется в repositories и SQLite-backed runtime.
- Добавлен scheduler source `focus.phase-end` для автопереходов phase/cycle.
- UI `/focus` заменил shell placeholder и работает через command/query bus.
- Добавлены tests на state machine, use-cases, scheduler restore/idempotency и feature registration.

## Exit Gate

- Одновременно активна только одна focus session.
- Focus/break phases восстанавливаются из persisted phase timestamps после sleep/restart reconcile.
- Phase-level `skip` фиксируется отдельным history event и не превращается в completed focus-фазу.

## Verification

- `npm run typecheck`
- `npm run lint`
- `npm test`
