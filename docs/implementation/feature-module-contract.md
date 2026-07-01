# Feature Module Contract — Plugin-first baseline

Status: Draft (architecture baseline)  
Owner: github.com/kubasovp  
Last updated (UTC): 2026-07-01  
Scope: Контракт feature-модулей и правила подключения бизнес-функций  
Canonical: docs/implementation/feature-module-contract.md

## 1) Решение

Timers использует **plugin-first modular monolith**.

Это не система внешних сторонних плагинов. В MVP все модули находятся в одной кодовой базе и собираются вместе с приложением, но архитектурно подключаются как feature-плагины через явный контракт.

Цель:
- минимальное ядро приложения;
- независимые бизнес-модули;
- предсказуемое подключение/отключение функциональности;
- отсутствие прямых скрытых зависимостей между модулями.

## 2) Термины

- **Kernel** — минимальное ядро приложения: контракты, registry, command/query dispatch, scheduler registry, navigation registry. Не содержит бизнес-логики Pomodoro/Timer/Reminder.
- **Feature module** — вертикальный бизнес-модуль: domain + use-cases + UI + persistence bindings + scheduler bindings.
- **Platform adapter** — конкретная интеграция с внешней средой: Tauri, SQLite, OS notifications, clock, filesystem.
- **Composition root** — единственное место, где приложение выбирает активные модули и связывает kernel, platform adapters и features.

## 3) Базовый контракт модуля

```ts
export interface AppFeature {
  id: FeatureId;
  title: string;
  version: string;

  dependencies?: FeatureId[];

  register(context: FeatureRegistrationContext): void;
}
```

```ts
export interface FeatureRegistrationContext {
  routes: RouteRegistry;
  navigation: NavigationRegistry;
  commands: CommandRegistry;
  queries: QueryRegistry;
  scheduler: SchedulerRegistry;
  settings: SettingsRegistry;
  migrations: MigrationRegistry;
}
```

Минимальный пример:

```ts
export const customTimerFeature: AppFeature = {
  id: 'custom-timer',
  title: 'Custom Timer',
  version: '0.1.0',

  register(context) {
    context.routes.add(customTimerRoutes);
    context.navigation.add({ label: 'Таймеры', path: '/timers' });

    context.commands.add('timer.start', startTimer);
    context.commands.add('timer.pause', pauseTimer);
    context.commands.add('timer.stop', stopTimer);

    context.queries.add('timer.listActive', listActiveTimers);
    context.scheduler.addSource(customTimerSchedulerSource);
    context.migrations.add(customTimerMigrations);
  },
};
```

## 4) Что может регистрировать модуль

Feature-модуль может регистрировать:
- routes/pages;
- пункты навигации;
- commands — write/use-case операции;
- queries — read-only операции;
- scheduler sources;
- settings schema/defaults;
- DB migrations;
- domain event handlers только для observability/history, не как основной способ бизнес-связи.

## 5) Что модуль не должен делать

Feature-модуль не должен:
- импортировать внутренние файлы другого feature-модуля;
- создавать Tauri/SQLite/notification dependencies скрыто внутри domain/use-cases;
- менять глобальное состояние приложения напрямую;
- использовать event bus как основной способ бизнес-взаимодействия;
- предполагать, что другой модуль включён, если зависимость не объявлена явно.

## 6) Внутренняя структура feature-модуля

Рекомендуемая структура:

```text
src/features/custom-timer/
  index.ts                  # public entry: exports AppFeature
  manifest.ts               # id/title/version/dependencies

  domain/                   # сущности, value objects, state machine
  use-cases/                # commands/queries конкретной бизнес-функции
  ports.ts                  # interfaces, нужные модулю извне

  ui/                       # Vue pages/components/composables модуля
  persistence/              # SQLite mapping/repository implementation
  scheduler/                # scheduler source/reconcile integration
  migrations/               # versioned DB migrations модуля

  tests/
    domain/
    use-cases/
    integration/
```

Слои остаются, но они локальны для модуля. Главная единица структуры — не `core/application/adapters`, а `feature`.

## 7) Правила зависимостей

Разрешено:
- `feature/* -> kernel contracts`;
- `feature/* -> shared primitives`;
- `feature/ui -> Vue`;
- `feature/persistence -> SQLite adapter contracts`;
- `platform/bootstrap -> features`;
- `platform/* -> kernel contracts`.

Запрещено:
- `kernel -> features|platform|Vue|Tauri|SQLite`;
- `feature/domain -> Vue|Tauri|SQLite`;
- `feature/use-cases -> Vue|Tauri`;
- `feature A -> feature B/internal/*`;
- `platform adapter -> feature internal domain`, кроме composition root/wiring.

Если одному модулю нужен другой модуль, используются варианты по приоритету:

1. Явная dependency в manifest + публичный contract/API модуля.
2. Command/query registry.
3. Domain event только для побочных реакций: history, metrics, logs.

## 8) Включение и отключение модулей

В MVP список модулей статичен:

```ts
const enabledFeatures = [
  customTimerFeature,
  pomodoroFeature,
  remindersFeature,
];

for (const feature of enabledFeatures) {
  feature.register(registrationContext);
}
```

Post-MVP возможна настройка:

```ts
const enabledFeatures = allFeatures.filter((feature) => {
  return userSettings.enabledFeatures.includes(feature.id);
});
```

Отключение модуля означает:
- routes/navigation/commands/scheduler sources не регистрируются;
- пользовательские данные модуля в SQLite не удаляются автоматически;
- миграции уже установленных модулей не откатываются автоматически.

## 9) Scheduler integration

Scheduler не знает бизнес-смысл Pomodoro/Timer/Reminder. Он работает с зарегистрированными источниками:

```ts
export interface SchedulerSource {
  id: string;
  sourceType: string;

  getNextFireAt(now: Instant): Promise<Instant | null>;
  reconcile(now: Instant): Promise<SchedulerAction[]>;
}
```

Модули сами решают, как пересчитать своё состояние. Scheduler отвечает за:
- общий loop;
- вызов `reconcile`;
- idempotency/dedup на уровне dispatch;
- retry/failure policy;
- передачу notification requests в platform adapter.

## 10) UI integration

UI shell не должен знать все детали бизнес-модулей. Он рендерит зарегистрированные routes/navigation и вызывает commands/queries.

Feature UI может содержать Vue-компоненты, но бизнес-правила времени живут в domain/use-cases модуля.

Анти-пример:

```text
Vue component -> считает remaining time -> пишет в SQLite
```

Целевой поток:

```text
Vue component -> command/query -> feature use-case -> feature domain -> feature persistence port
```

## 11) Definition of Done для нового feature-модуля

Новый feature-модуль считается готовым, если:

1. Есть `index.ts` с `AppFeature`.
2. Есть manifest с `id`, `title`, `version`, `dependencies`.
3. Все routes/navigation/commands/queries/scheduler sources регистрируются через `register(context)`.
4. Нет импортов из `features/*/internal` другого модуля.
5. Есть unit-тесты domain/use-cases.
6. Есть integration test на регистрацию модуля в composition root.
7. Если модуль хранит данные — есть migrations и описание схемы.
8. Если модуль участвует в scheduler — есть тесты reconcile/idempotency.
9. Обновлены docs и release notes при изменении пользовательского поведения.

## 12) MVP feature modules

MVP включает три бизнес-модуля:

```text
features/custom-timer
features/pomodoro
features/reminders
```

Рекомендуемый порядок реализации:

1. `custom-timer` — самый простой модуль, хороший первый вертикальный срез.
2. `pomodoro` — похож на timer, но со своей state machine и профилями.
3. `reminders` — самый сложный модуль из-за repeat rules, snooze, missed events, DST/timezone и очереди уведомлений.
