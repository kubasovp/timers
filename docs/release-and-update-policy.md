# Release and Update Policy

Status: Draft
Owner: github.com/kubasovp
Last reviewed (UTC): 2026-07-02
Scope: Черновой процесс релизов, обновлений и fallback-поведения
Canonical: docs/release-and-update-policy.md

## 1. Versioning
- SemVer для приложения.
- Версия схемы БД увеличивается отдельным номером миграции.

## 2. Release Cadence (Draft)
- Patch: bugfix по мере готовности.
- Minor: функциональные улучшения MVP/post-MVP.
- Major: несовместимые изменения API/форматов/поведения.

## 3. Release Checklist (Draft)
1. Прогнать тесты и smoke checks.
2. Проверить миграции SQLite.
3. Собрать артефакты по платформам.
4. Прогнать manual upgrade smoke для поддерживаемых платформ.
5. Сформировать changelog.
6. Подготовить `latest.json` и подписи.

## 4. Build Artifacts (Draft)
- Raw release binaries are emitted directly under `src-tauri/target/release/`: `timers` on Linux and `timers.exe` on Windows.
- Installer/package artifacts are emitted under `src-tauri/target/release/bundle/<format>/`.
- Fedora RPM package smoke uses:

```bash
npm run tauri:build -- --bundles rpm
```

- The expected Fedora artifact path is `src-tauri/target/release/bundle/rpm/Timers-0.1.0-1.x86_64.rpm` for version `0.1.0`.
- AppImage is not an MVP release artifact until it has a passing packaged smoke check.

## 5. Manual Upgrade Smoke (MVP)
- MVP uses manual updates: download a newer installer/package and run it over the existing installation.
- Upgrade smoke must verify that user data survives the upgrade on every supported platform.
- SQLite data must live in the user's app data directory, not in the install directory or bundle payload.
- Minimal check: create at least one persisted timer/focus/reminder record on version `N`, install version `N+1`, start the app, and verify that the record is still present and editable.
- If the app data path changes, the release must either include a migration path or document the change as a breaking storage change.

## 6. Update Manifest Contract (Draft)
`latest.json` содержит минимум:
- `version`
- `platform`
- `url`
- `checksum`
- `signature`

## 7. Signature Verification
- Проверка подписи обязательна перед установкой.
- При провале проверки обновление не применяется.

## 8. Install Modes (Draft)
- `explicit_install`
- `install_on_restart`

## 9. Failure Handling
- При недоступности сети/манифеста update-check = soft-fail.
- Локальные функции таймеров/напоминаний продолжают работу без деградации.

## 10. Future additions
- Rollback strategy.
- Staged rollout / canary updates.
- Детализация платформенных каналов обновления.
