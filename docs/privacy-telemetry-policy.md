# Privacy and Telemetry Policy

Status: Draft
Owner: github.com/kubasovp
Last reviewed (UTC): 2026-05-07
Scope: Черновые правила телеметрии, consent и хранения данных
Canonical: docs/privacy-telemetry-policy.md

## 1. Principles
- Privacy-by-default.
- Минимизация данных.
- Прозрачность для пользователя.

## 2. MVP Baseline
- Клиентская телеметрия по умолчанию отключена.
- Допускаются только server-side метрики загрузок без клиентских идентификаторов.

## 3. Post-MVP Optional Events
- `first_run`
- `update_check`

Для любых клиентских событий обязательно:
- явное согласие (consent);
- возможность отзыва consent;
- анонимизация payload;
- ограниченный retention.

## 4. Data Map (Draft)
- Event name
- Timestamp
- App version
- Platform
- (No personal identifiers by default)

## 5. Retention (Draft)
- Raw telemetry: ограниченный срок (например, 30/60/90 дней; финальный выбор pending).
- Агрегированные отчёты: дольше, без идентификаторов.

## 6. User Controls (Draft)
- Переключатель telemetry в настройках.
- Ссылка на policy из настроек.
- Понятный текст о том, что и зачем отправляется.

## 7. Compliance notes (Draft)
- Финальная юридическая формулировка и региональные требования оформляются отдельным юридическим документом.
