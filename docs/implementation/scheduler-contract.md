# Scheduler Contract (MVP)

Status: Draft (implementation contract)  
Owner: github.com/kubasovp  
Last updated (UTC): 2026-05-08  
Scope: Поведение scheduler loop и runtime guarantees  
Canonical: docs/implementation/scheduler-contract.md

## 1) Tick model

MVP использует гибрид:
- периодический polling tick с cadence, не нарушающим notification SLA `<= 1с` (базово: `1с` и в активном, и в idle режиме);
- приоритет обработки ближайшего `next_fire_at_utc` (next-fire-time aware reconcile).


Важно: любые оптимизации idle-режима допустимы только если инструментально подтверждено соблюдение SLA из `docs/03-quality-and-constraints.md` (задержка срабатывания уведомления не более 1 секунды).
Scheduler не полагается только на in-memory интервал; истина — persisted state + UTC timestamps.

## 2) Misfire policy

Если `scheduled_for_utc < now_utc` на момент reconcile:
- классифицируем как `misfire`;
- для one-time reminder: выполнить немедленно с пометкой `missed->fired` (если в окне допуска);
- если событие слишком старое (например > 24ч) — не спамить уведомлениями, записать в history как `missed/skipped`.

## 3) Retry policy

- Повтор только для технических ошибок dispatch/storage.
- Backoff: `1s, 5s, 15s` (до 3 попыток в MVP).
- После исчерпания: `failed`, запись в `notification_delivery_log`, без бесконечных retry-циклов.

## 4) Dedup / idempotency

- Каждое исполнение обязано иметь `idempotency_key`.
- Перед dispatch проверяется существование occurrence с этим ключом.
- Повторный запуск reconcile после crash не должен создавать дубль пользовательского уведомления.

## 5) Concurrency limits

- По умолчанию single-writer scheduler loop.
- Допустим bounded worker pool для dispatch (например, 2-4 воркера), но с сериализацией по `source_id`.
- Глобальный лимит задач в полёте в MVP не вводится; допустимое число параллельных таймеров определяется ресурсами устройства пользователя.

## 6) Observability

Обязательные метрики:
- `scheduler_tick_duration_ms`
- `scheduler_reconcile_lag_ms`
- `scheduler_occurrences_processed_total{status}`
- `scheduler_misfires_total`
- `notification_dispatch_attempts_total{status}`

Обязательные логи:
- startup/shutdown loop;
- summary на tick (debug level);
- misfire detection;
- retry attempts;
- dedup hit.

## 7) Failure handling baseline

- Любой crash во время обработки не должен ломать последующий restart/reconcile.
- Recovery обязателен через пересчёт от persisted `next_fire_at_utc` и active state.

## 8) Решения для MVP

- Целевой upper bound для `scheduler_reconcile_lag_ms` заранее не фиксируется; сначала собираем фактические метрики и принимаем решение по результатам.
- Динамическая адаптация tick interval (power-saving mode) в MVP не вводится; возвращаемся к вопросу при подтверждённой проблеме по CPU/энергопотреблению.
