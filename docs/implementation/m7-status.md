# M7 Status — Reminders v2 Recurrence and Time Semantics

Status: Implemented  
Owner: github.com/kubasovp  
Last updated (UTC): 2026-07-03  
Scope: Daily local-floating reminders, interval reminders, recurrence planner and recurring occurrence semantics

## Delivered

- Added a pure recurrence planner for `daily` and `interval` reminder rules.
- Planner tests pass explicit IANA timezones such as `Europe/Berlin`, `America/New_York`, `Asia/Tokyo` and `Pacific/Auckland`; tests do not mutate OS timezone.
- Daily reminders use `local_floating` semantics and recompute `nextFireAtUtc` from `dailyTimeLocal`, `nowUtc` and current device timezone.
- DST spring-forward nonexistent local times shift to the nearest valid local time.
- DST fall-back ambiguous local times choose the first occurrence and deduplicate by local calendar date.
- Interval reminders use elapsed UTC cadence from `intervalAnchorAtUtc`, avoiding wall-clock drift through DST.
- Scheduler creates at most one user-visible alert per reminder per reconcile and records skipped old recurring misfires.
- Daily recurring `Done` closes the current occurrence and returns the rule to `enabled`; one-time `Done` remains terminal.
- Interval reminders alert autonomously, stay `enabled`, and recalculate the next regular occurrence without waiting for `Done`.
- Recurring `Snooze` refires the current logical occurrence and then restores the next regular recurrence for command-level compatibility.
- Added commands `reminders.createDaily` and `reminders.createInterval`.
- UI supports one-time, daily and interval reminder creation, shows schedule summaries, and exposes `Stop` for active interval reminders.
- Registered default snooze preset setting `reminders.snoozePresetsSeconds`.

## Exit Gate

- Daily reminder fires once per local calendar date.
- Timezone switch recalculates `nextFireAtUtc` from persisted rule/state.
- Interval reminders fire the latest due occurrence after sleep/restart without catch-up storms.
- Interval reminders continue to the next occurrence without user acknowledgement.
- Repeated reconcile does not create duplicate recurring alerts.
- One-time M6 behavior remains covered and unchanged.

## Verification

- `npm run test`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run test:e2e`

Note: the first sandboxed e2e attempt could not bind `127.0.0.1:1420` (`listen EPERM`). The same command passed with the required local-server permission.
