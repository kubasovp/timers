# C4 Level 2 — Container

Status: Draft  
Owner: github.com/kubasovp  
Last reviewed (UTC): 2026-05-07  
Scope: Контейнеры приложения и ключевые связи  
Canonical: docs/L2-container.md

```mermaid
flowchart TB
  UI[Frontend UI\nVue + TypeScript]
  CLI[CLI Interface\nfuture]
  CORE[Domain Core\nTimer/Reminder logic]
  SCHED[Scheduler Engine\nabsolute time reconcile]
  DB[(SQLite)]
  TAURI[Tauri Host\nOS bridge]
  NOTIF[OS Notifications]
  UPDATE[Update Check Adapter\nfuture optional]
  TELEMETRY[Telemetry Adapter\nfuture optional]

  UI <--> CORE
  CLI <--> CORE
  CORE <--> SCHED
  CORE <--> DB
  SCHED <--> DB
  UI <--> TAURI
  SCHED --> TAURI
  TAURI --> NOTIF
  UI --> UPDATE
  TAURI --> UPDATE
  UI --> TELEMETRY
  TAURI --> TELEMETRY
```

### Пояснения к контейнерам (future-ready)

- `Domain Core` и `Scheduler` образуют платформенно-агностичное ядро.
- `Frontend UI` и будущий `CLI Interface` — разные адаптеры к одному ядру.
- `Update Check Adapter` и `Telemetry Adapter` — внешние adapter-слои, которые не вызываются напрямую из `Domain Core`.
- Интеграция с update/telemetry инициируется outer layers (`UI`/`Tauri`) и передаёт в core только доменно-нейтральные данные/события.
- Эти адаптеры в MVP могут быть отключены; их отказ не должен ломать локальные сценарии.
