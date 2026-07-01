# M4 Architecture Checkpoint Status

Status: Accepted  
Owner: github.com/kubasovp  
Last updated (UTC): 2026-07-01
Scope: Фактический статус architecture checkpoint после первого vertical slice  
Canonical: docs/implementation/m4-status.md

## 1) Summary

M4 закрыт как checkpoint после `custom-timer` vertical slice.

Зафиксировано:
- dependency boundary checks включены через `dependency-cruiser`;
- CI запускает `npm run check`, который включает architecture boundary lint;
- `kernel` остаётся domain-neutral и не импортирует `features`, `platform`, Vue, Tauri или SQLite-specific packages;
- feature imports ограничены public entrypoints и собственными internal paths;
- `development-view.md` стал единственным canonical местом для feature module contract, dependency rules и DoD;
- `scheduler-contract.md` остался canonical местом для `SchedulerSource`/`SchedulerAction`;
- `data-model-v1.md` уточнён как логическая модель и persistence baseline, а не жёсткий DDL-контракт.

## 2) Verification

Verified on 2026-07-01:

| Check | Result |
|---|---|
| `npm run lint` | Passed: no dependency violations found |
| implementation docs duplicate check | Passed: no references to the removed standalone feature contract file; `SchedulerSource` interface is defined only in `scheduler-contract.md` |
| docs whitespace check | Passed: `git diff --check -- docs` |

## 3) Follow-up Items

M4 не закрывает storage hardening и не заменяет M5/M6 work.

Остаются follow-up items из M3:
- подключить runtime persistence к Tauri SQLite вместо browser/localStorage;
- добавить explicit restart/recovery E2E test для persisted active timers;
- заменить placeholder Tauri icon на полноценный app icon.

Следующий milestone: M5 Focus feature.
