# M9 / 0.2.0 Draft - Product Hardening, Settings and Alerts

Status: Draft  
Owner: github.com/kubasovp  
Last updated (UTC): 2026-07-07  
Scope: Candidate scope for the next minor preview version after `0.1.0`

## Intent

M9 is a candidate milestone for `0.2.0`, the next minor preview version after the published `0.1.0` MVP preview.

It is intentionally outside the `0.1.0` release scope. `0.1.0` should stay closed as the first Linux/Windows preview release; `0.1.x` should be reserved for patch/hotfix work unless the versioning policy changes.

The main goal is to make Timers easier to operate as a real desktop app:
- settings and about information should be discoverable without adding a fourth workspace panel;
- due timers/reminders should have a reliable visual layer, not only sound or OS notifications;
- notification behavior during Do Not Disturb should be explicit and best-effort;
- accessibility and keyboard support should be tested as first-class acceptance criteria.

## Navigation Model

Settings and About are secondary screens, not workspace panels.

Current workspace panels remain:
- Focus
- Timers
- Reminders

Header actions should open secondary screens:
- Settings button/link in the app header.
- About button/link in the app header or a compact app menu.

The secondary screens can be implemented as routed pages, modal sheets, or a dedicated overlay, but they should not compete with the three main timing panels. The user should be able to return to the workspace without losing active timer/reminder context.

## Settings Draft

Initial settings candidates:
- sound enabled/disabled;
- sound volume;
- test sound action;
- OS notifications enabled/disabled where platform support allows it;
- test notification action;
- default snooze presets;
- urgent alert behavior;
- Do Not Disturb behavior;
- local data path display;
- reset/delete local data action, guarded by explicit confirmation;
- diagnostics copy action with app version, platform and relevant runtime details.

Settings should persist in the existing local SQLite/app settings storage rather than in install directories.

## About Draft

About should include:
- app name and version;
- release channel/status, for example preview/pre-release;
- GitHub repository link;
- GitHub Releases link;
- license;
- privacy/telemetry summary: local-first, no accounts, no cloud sync, no telemetry in the current policy;
- app data path;
- platform/runtime information useful for bug reports.

## Do Not Disturb Behavior

Bypass of system Do Not Disturb must be treated as best-effort, not a guaranteed promise.

Draft product language:
- default behavior respects normal OS notification behavior;
- optional urgent alerts can enable stronger local behavior for selected timer/reminder events;
- OS-level DND bypass depends on platform and user OS settings;
- Windows may require user configuration such as priority notifications;
- Linux behavior can differ between desktop environments and notification daemons.

Implementation direction:
- expose an explicit setting for urgent/critical timer alerts;
- keep the default conservative;
- use platform notification urgency where available;
- never rely on DND bypass as the only delivery path;
- always provide an in-app visual alert when the app is running.

## Visual Alerts

Sound alone is not sufficient for due timers/reminders.

Candidate visual layer:
- in-app alert banner/toast for due events;
- persistent "Due now" alert area or alert center;
- clear actions on each alert: Done, Snooze, Stop, Dismiss where applicable;
- grouping/queue behavior for simultaneous alerts;
- visible fallback when OS notification delivery fails or permission is missing;
- optional repeated sound only for urgent alerts, with clear acknowledgement behavior.

The visual alert layer should be driven by scheduler/notification state rather than ad hoc UI timers. It should preserve dedup/idempotency guarantees from the scheduler contract.

## Accessibility and Keyboard Support

Accessibility and keyboard support need a full pass before M9 can be considered complete.

Draft checks:
- every interactive control is reachable by keyboard;
- focus order follows visual/task order;
- visible focus indicators are present and not clipped;
- Settings and About can be opened and closed by keyboard;
- modal/overlay focus is trapped when appropriate and restored on close;
- due alerts are announced with appropriate ARIA semantics;
- alert actions are keyboard reachable;
- forms have labels and error/status messages are associated with controls where practical;
- controls have accessible names, including icon-only header actions;
- color is not the only signal for status/error;
- reduced-motion preference is respected for non-essential animation;
- screen reader smoke on at least one Windows and one Linux environment;
- Playwright keyboard smoke covers core create/start/stop/snooze flows.

## Open Questions

- Should Settings and About be routes, dialogs, or an app-menu-driven overlay?
- Which settings belong in MVP-compatible storage now versus later schema migration?
- Should urgent alerts be configured globally, per feature, or per reminder/timer?
- What is the minimum acceptable native notification implementation per platform?
- Should the app expose a "keep alert on top" behavior, and is that acceptable across Windows/Linux?
- Which screen reader/browser-WebView combinations should be used for the first manual accessibility smoke?

## Non-Goals For This Draft

- No commitment to a specific UI design yet.
- No promise of guaranteed OS-level DND bypass.
- No auto-update implementation.
- No new tray behavior requirement.
- No data sync/account/cloud behavior.
- No expansion of the already published `0.1.0` scope.

## Candidate Exit Gate

M9 can be considered complete when:
- Settings and About are implemented as secondary screens from the header/menu;
- core alert preferences persist locally;
- visual alerts cover due timers and reminders with actionable controls;
- urgent/DND behavior is documented as best-effort and behaves consistently with platform limits;
- accessibility/keyboard smoke passes on Linux and Windows;
- no P0 regression in scheduler dedup, recovery or native SQLite storage.
