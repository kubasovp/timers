# M8 Status - MVP Hardening and Release Candidate

Status: Implemented  
Owner: github.com/kubasovp  
Last updated (UTC): 2026-07-07  
Scope: MVP P0 verification, Linux/Windows packaged smoke, release-candidate artifacts and known limitations

## Delivered

- Full MVP automated gate passed with `npm run check`.
- Browser E2E smoke passed with `npm run test:e2e`; the sandboxed first attempt could not bind the local Vite server, so the passing run used the required local-server permission.
- Windows packaged smoke and MSI upgrade smoke were completed on 2026-07-04 for `0.1.0` to temporary `0.1.1`, with follow-up `0.1.2`/`0.1.3` checks for GUI subsystem behavior.
- Fedora Linux RPM build passed with `npm run tauri:build -- --bundles rpm`.
- Linux raw release binary startup smoke passed on Fedora with native SQLite enabled and a clean temporary XDG profile.
- Linux raw-binary upgrade smoke preserved SQLite data across a temporary `0.1.0` to `0.1.1` profile.
- Linux installed RPM upgrade smoke passed via GUI install/update from `0.1.0` to temporary `0.1.1`; created reminders and active timers preserved state after upgrade.
- Linux RPM was published to GitHub Release `v0.1.0`.
- Release builds now remove stale Tauri generated `tauri-codegen-assets` before packaging via `pretauri:build`.
- `index.html` includes no-cache meta tags to reduce WebKit reuse of a stale app entrypoint during local smoke/release-candidate runs.

## Linux Artifacts

| Artifact | Path | SHA-256 | Purpose |
|---|---|---|---|
| RPM `0.1.0` | `src-tauri/target/release/bundle/rpm/Timers-0.1.0-1.x86_64.rpm` | `8169cd537ead95a47a72a22edf257af94819b4658c56341aef544bb7443a398f` | Release artifact |
| RPM `0.1.1` | `src-tauri/target/release/bundle/rpm/Timers-0.1.1-1.x86_64.rpm` | `24c0a971a28b647168abcfa61128ac617b42b9c3e254a4f2bfc5e5dc511ca6f5` | Temporary upgrade-smoke artifact only |

RPM metadata:
- package: `timers`, `x86_64`;
- release artifact version: `0.1.0-1`;
- temporary upgrade-smoke version: `0.1.1-1`;
- build dates: 2026-07-07 17:48:08 and 17:49:25 local time in the checked Fedora environment;
- runtime dependencies reported by RPM: `libwebkit2gtk-4.1.so.0`, `libgtk-3.so.0`.

## Linux Smoke Results

- Startup command used an isolated `XDG_CONFIG_HOME` and `XDG_DATA_HOME`.
- The process stayed alive until the smoke `timeout`, with no stderr output.
- SQLite DB was created under `XDG_CONFIG_HOME/com.github.kubasovp.timers/timers.db`.
- Applied migrations on a clean profile:
  - `custom-timer.v1`
  - `focus.v1`
  - `reminders.v1`
  - `system.v1`
- Default seeded data was present: one focus profile and three timer presets.
- Embedded Tauri assets were checked after rebuild: the package contains one current HTML/JS/CSS asset set, `index.html` points to the current Vite hashed JS, and the embedded JS contains daily/interval Reminders UI and commands.
- GUI RPM transaction smoke passed: install `0.1.0`, create timers/reminders, close app, upgrade to temporary `0.1.1`, reopen app. Reminders remained present and active timers preserved state.

## Stale UI Finding

During Linux smoke, a second launch showed an old UI without current Reminders behavior. The release binary itself contained the current Reminders code, but the Tauri build output still had stale generated `tauri-codegen-assets` from older builds. This could combine badly with WebKit's per-app cache.

Mitigation:
- `npm run tauri:build` now runs `scripts/clean-tauri-codegen-assets.mjs` first.
- The final rebuilt package was verified to contain only the current generated asset set.
- `index.html` now marks the app entrypoint as no-cache.

## Known Limitations

- AppImage remains outside MVP until it gets a passing packaged smoke check.
- Update manifest, signatures and automatic updater flow remain draft policy items, not implemented MVP behavior.

## Exit Gate

- All P0 items in `docs/testing/mvp-test-plan.md` are covered by automated tests plus Linux/Windows manual packaged smoke.
- No high-severity open defect remains for recovery/time semantics in the checked MVP scope.
- MVP can be built and launched on the target platforms, with Linux RPM and Windows installer artifacts verified for release-candidate use.
