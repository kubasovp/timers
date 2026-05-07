# Release and Update Policy

Status: Draft
Owner: github.com/kubasovp
Last reviewed (UTC): 2026-05-07
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
4. Сформировать changelog.
5. Подготовить `latest.json` и подписи.

## 4. Update Manifest Contract (Draft)
`latest.json` содержит минимум:
- `version`
- `platform`
- `url`
- `checksum`
- `signature`

## 5. Signature Verification
- Проверка подписи обязательна перед установкой.
- При провале проверки обновление не применяется.

## 6. Install Modes (Draft)
- `explicit_install`
- `install_on_restart`

## 7. Failure Handling
- При недоступности сети/манифеста update-check = soft-fail.
- Локальные функции таймеров/напоминаний продолжают работу без деградации.

## 8. Future additions
- Rollback strategy.
- Staged rollout / canary updates.
- Детализация платформенных каналов обновления.
