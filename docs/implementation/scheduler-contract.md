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

## 2) SchedulerSource and SchedulerAction

Feature-модуль регистрирует `SchedulerSource` и владеет своим domain-specific reconcile:

```ts
export interface SchedulerSource {
  id: string;
  sourceType: 'timer' | 'focus' | 'reminder';

  getNextFireAt(now: Instant): Promise<Instant | null>;
  reconcile(now: Instant): Promise<SchedulerAction[]>;
}
```

`reconcile(now)` может обновлять feature-owned state через свои repositories. Возвращаемые `SchedulerAction` описывают user-visible delivery, которую общий scheduler должен дедуплицировать, поставить в очередь и передать platform adapters.

```ts
export interface SchedulerAction {
  kind: 'user_alert';

  source: {
    sourceType: 'timer' | 'focus' | 'reminder';
    sourceId: string;
  };

  occurrence: {
    occurrenceId: string;
    scheduledForUtc: Instant;
    detectedAtUtc: Instant;
    idempotencyKey: string;
  };

  delivery: {
    channels: Array<'os_notification' | 'sound'>;
    notification: {
      title: string;
      body?: string;
      urgency?: 'normal' | 'high';
    };
    sound?: {
      soundId?: string;
      volume?: number;
    };
  };

  retry: {
    maxAttempts: 3;
    backoffMs: [1000, 5000, 15000];
  };

  queue: {
    policy: 'fifo_by_scheduled_time';
    groupKey?: string;
  };
}
```

Rules:
- `idempotencyKey = hash(sourceType, sourceId, scheduledForUtc, kind)`.
- `occurrenceId` должен быть stable для одного logical occurrence.
- `channels` включает `sound`, если пользовательские настройки не отключили звук.
- Доставка каждого канала пишется в `notification_delivery_log`.
- Повторная обработка того же `idempotencyKey` не создаёт новый user-visible alert.

## 3) Misfire policy

Если `scheduled_for_utc < now_utc` на момент reconcile:
- классифицируем как `misfire`;
- для one-time reminder: выполнить немедленно с пометкой `missed->fired` (если в окне допуска);
- если событие слишком старое (например > 24ч) — не спамить уведомлениями, записать в history как `missed/skipped`.

## 4) Retry policy

- Повтор только для технических ошибок dispatch/storage.
- Backoff: `1s, 5s, 15s` (до 3 попыток в MVP).
- После исчерпания: `failed`, запись в `notification_delivery_log`, без бесконечных retry-циклов.

## 5) Dedup / idempotency

- Каждое исполнение обязано иметь `idempotency_key`.
- Перед dispatch проверяется существование occurrence с этим ключом.
- Повторный запуск reconcile после crash не должен создавать дубль пользовательского уведомления.

## 6) Concurrency limits

- По умолчанию single-writer scheduler loop.
- Допустим bounded worker pool для dispatch (например, 2-4 воркера), но с сериализацией по `source_id`.
- Глобальный лимит задач в полёте в MVP не вводится; допустимое число параллельных таймеров определяется ресурсами устройства пользователя.

## 7) Observability

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

## 8) Failure handling baseline

- Любой crash во время обработки не должен ломать последующий restart/reconcile.
- Recovery обязателен через пересчёт от persisted `next_fire_at_utc` и active state.

## 9) Решения для MVP

- Целевой upper bound для `scheduler_reconcile_lag_ms` заранее не фиксируется; сначала собираем фактические метрики и принимаем решение по результатам.
- Динамическая адаптация tick interval (power-saving mode) в MVP не вводится; возвращаемся к вопросу при подтверждённой проблеме по CPU/энергопотреблению.
