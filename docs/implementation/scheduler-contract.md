# Scheduler Contract (MVP)

Status: Draft (implementation contract)  
Owner: github.com/kubasovp  
Last updated (UTC): 2026-07-02
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
- для one-time reminder: выполнить немедленно с пометкой `missed->fired`, если событие находится в допустимом окне;
- если событие слишком старое (например > 24ч) — не спамить уведомлениями, записать в history как `missed/skipped`.

### 3.1) One-time reminders

One-time reminder хранится как fixed UTC instant (`one_time_fire_at_utc`). Смена timezone устройства не пересчитывает этот момент.

Если one-time fire time уже в прошлом:
- `now_utc - scheduled_for_utc <= one_time_grace_window` — выполнить один раз сейчас;
- `now_utc - scheduled_for_utc > one_time_grace_window` — записать `missed/skipped`, не показывать user-visible alert.

MVP baseline для `one_time_grace_window`: 24 часа.

### 3.2) Daily local-floating reminders

Daily reminder хранит `daily_time_local` и пересчитывает candidate fire time в текущей timezone устройства:

```text
candidate = today @ daily_time_local in current device timezone
```

Перед сравнением с `now` применяются DST rules:
- spring-forward: если локальное время не существует, сдвинуть на ближайшее валидное локальное время;
- fall-back: если локальное время двусмысленно, выбрать первое вхождение.

Если `candidate > now`, scheduler сохраняет `next_fire_at_utc = candidate` и не создаёт alert.

Если `candidate` уже в прошлом на момент reconcile:

| Условие | Поведение |
|---|---|
| `last_fired_local_date == today_local_date` | Не показывать alert повторно; пересчитать `next_fire_at_utc` на следующую локальную дату. |
| `now - candidate <= daily_local_grace_window` | Выполнить один раз сейчас, записать `last_fired_local_date = today_local_date`, пересчитать следующий день. |
| `now - candidate > daily_local_grace_window` | Пропустить текущую локальную дату без alert, записать `missed/skipped`, пересчитать следующий день. |

MVP baseline для `daily_local_grace_window`: 1 час. Значение можно уточнять после инструментированных проверок, но оно должно быть одним общим правилом scheduler, а не UI-специфичной эвристикой.

Dedup для daily reminders выполняется по локальной календарной дате (`last_fired_local_date`), а не только по UTC occurrence time. Это закрывает DST fall-back и timezone jump сценарии.

## 4) Retry policy

- Повтор только для технических ошибок dispatch/storage.
- Backoff: `1s, 5s, 15s` (до 3 попыток в MVP).
- После исчерпания: `failed`, запись в `notification_delivery_log`, без бесконечных retry-циклов.
- Ошибка или зависание одного delivery channel не должна оставлять scheduler loop в состоянии `in-flight` и блокировать последующие ticks/sources.
- MVP baseline: каждый platform delivery call (`os_notification`, `sound`) должен быть bounded по времени; при превышении timeout канал записывается как `failed`, остальные queued actions продолжают dispatch.

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
- Platform adapter degradation is isolated from domain reconcile: если browser/native adapter не может показать notification или воспроизвести sound, feature-owned state всё равно должен перейти в due/completed согласно scheduler source, а dispatch failure фиксируется отдельно.

## 9) Решения для MVP

- Целевой upper bound для `scheduler_reconcile_lag_ms` заранее не фиксируется; сначала собираем фактические метрики и принимаем решение по результатам.
- Динамическая адаптация tick interval (power-saving mode) в MVP не вводится; возвращаемся к вопросу при подтверждённой проблеме по CPU/энергопотреблению.
