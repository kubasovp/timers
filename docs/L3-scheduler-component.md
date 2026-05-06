# C4 Level 3 — Scheduler Component

Status: Draft  
Owner: github.com/kubasovp  
Last reviewed (UTC): 2026-05-06  
Scope: Внутренние части компонента Scheduler Engine  
Canonical: docs/L3-scheduler-component.md

```mermaid
flowchart LR
  A[Clock Service\nnow()] --> B[Reconcile Service]
  C[Session Repository] --> B
  D[Reminder Repository] --> B
  B --> E[Completion Detector]
  B --> F[Missed Reminder Resolver]
  E --> G[Notification Dispatcher]
  F --> G
  B --> H[NextAt Calculator]
  H --> D
```
