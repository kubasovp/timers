# M0 Preflight Decisions

Status: Accepted  
Owner: github.com/kubasovp  
Last updated (UTC): 2026-07-01  
Scope: Решения preflight перед scaffold MVP  
Canonical: docs/implementation/m0-preflight.md

## 1) Toolchain baseline

MVP scaffold использует актуальные стабильные версии на 2026-07-01:

| Area | Decision |
|---|---|
| Package manager | `npm` + `package-lock.json` |
| Node.js | Node.js 24 LTS (`v24.15.0` в текущей среде) |
| npm | `11.12.1` в текущей среде |
| Rust | `rustc 1.95.0`, `cargo 1.95.0` в текущей среде |
| Tauri | `tauri` / `@tauri-apps/cli` `2.11.4` |
| Tauri JS API | `@tauri-apps/api` `2.11.1` |
| Tauri SQL plugin | `@tauri-apps/plugin-sql` `2.4.0` |
| Tauri notification plugin | `@tauri-apps/plugin-notification` `2.3.3` |
| Tauri OS plugin | `@tauri-apps/plugin-os` `2.3.2` |
| Vue | `3.5.39` |
| Vite | `8.1.2` |
| Vite Vue plugin | `@vitejs/plugin-vue` `6.0.7` |
| TypeScript baseline | `6.0.3` |
| Vue typecheck | `vue-tsc` `3.3.6` |
| Unit/integration tests | `vitest` `4.1.9` |
| Vue component tests | `@vue/test-utils` `2.4.11` |
| E2E smoke | `playwright` `1.61.1` |
| Architecture checks | `dependency-cruiser` `18.0.0` |

## 2) TypeScript 7.0 RC policy

TypeScript `7.0.1-rc` is allowed as an experimental side-by-side check, but not as the primary MVP compiler yet.

Decision:
- primary `typecheck` and CI use stable `typescript@6.0.3`;
- after scaffold, add a non-blocking script such as `typecheck:ts7` using `typescript@rc`;
- promote TypeScript 7 only after Vue/Vite/Tauri toolchain compatibility is proven locally and in CI.

Reasoning:
- TypeScript 7 RC is Go-based and materially faster, but it is still an RC.
- Microsoft notes that the stable programmatic API is expected no earlier than TypeScript 7.1.
- Vue/Vite ecosystem tools may still depend on the stable `typescript` package API.

## 3) Architecture boundary checks

MVP uses `dependency-cruiser` for architecture boundary checks.

Reasons:
- it directly models import graph rules;
- it can validate feature/module boundaries without adopting the full ESLint ecosystem early;
- it maps naturally to the rules in `docs/implementation/development-view.md`.

Initial rules:
- `src/kernel/**` must not import `src/features/**`, `src/platform/**`, Vue, Tauri or SQLite-specific packages;
- `src/features/*/domain/**` must not import Vue, Tauri or SQLite-specific packages;
- `src/features/*/use-cases/**` must not import Vue or Tauri;
- feature modules must not import another feature's internal paths;
- `src/platform/scheduler-loop/**` must not import feature UI.

ESLint can still be added later for style, correctness and Vue-specific linting, but it is not the architecture boundary tool for M0.

## 4) Platform support matrix

MVP target platforms:
- Linux;
- Windows.

Post-MVP:
- macOS.

Implications:
- CI must cover Linux and Windows before release candidate.
- Manual smoke must cover Linux and Windows before release candidate.
- macOS-specific window/tray behavior is documented as future-compatible but not a release blocker for MVP.
- Linux tray behavior is not relied on for MVP correctness.

## 5) Data model clarifications

The MVP schema must preserve enough information to reconstruct time behavior after restart/sleep/timezone changes.

Required clarifications are now part of `docs/implementation/data-model-v1.md`:
- timer presets are first-class data;
- app settings are first-class data;
- reminder recurrence rules are persisted, not inferred from `next_fire_at_utc`;
- focus sessions persist current phase/cycle progress;
- reminder occurrence acknowledgement is separate from the recurring reminder rule;
- sound delivery is a delivery channel, not an implicit side-effect.

## 6) SchedulerAction clarifications

The scheduler source contract returns user-visible delivery actions with stable idempotency metadata.

Required fields are now part of `docs/implementation/scheduler-contract.md`:
- source identity;
- occurrence identity;
- scheduled time;
- detected time;
- idempotency key;
- delivery channels;
- notification payload;
- optional sound payload;
- retry policy;
- queue metadata.

## 7) M0 exit status

M0 is closed when:
- this document is linked from `docs/README.md`;
- `docs/open-items.md` no longer lists M0 blockers;
- `data-model-v1` and `scheduler-contract` include the clarifications above.

## 8) Verification notes

Version check date: 2026-07-01.

Primary sources:
- Node.js release schedule: https://nodejs.org/en/about/previous-releases
- Tauri releases: https://github.com/tauri-apps/tauri/releases
- TypeScript 7.0 RC announcement: https://devblogs.microsoft.com/typescript/announcing-typescript-7-0-rc/
- npm registry checks via `npm view <package> version`

Checked npm packages:
- `vue`
- `vite`
- `@vitejs/plugin-vue`
- `typescript`
- `typescript@rc`
- `vue-tsc`
- `vitest`
- `@vue/test-utils`
- `playwright`
- `dependency-cruiser`
- `@tauri-apps/api`
- `@tauri-apps/cli`
- `@tauri-apps/plugin-sql`
- `@tauri-apps/plugin-notification`
- `@tauri-apps/plugin-os`
