---
tags: [debugging, propose-apply, ai, zod, homework, exercises, grammar]
date: 2026-06-13
---
<!-- Updated: 2026-06-17 | same class extended to GRAMMAR_TOPIC (tolerant z.preprocess) + the rule→"[object Object]" fix; found by the collection-grouping live UI test. -->

# propose→Apply 500 на вложенных payload из-за формы, которую эмитит модель

## Симптом
`POST /api/proposals/{id}/apply` → **500** для `HOMEWORK_CORRECTION` и `EXERCISE_SET`.
`VOCAB_ENTRY` применялся нормально. Карточка-предложение показывалась корректно (с заголовком), но падала при нажатии **Apply**. В консоли браузера — чисто; ошибка серверная (`Unhandled API error: ZodError`). Найдено при полном UI-тесте: из 38 `/api/`-вызовов сессии единственные не-2xx — два этих Apply.

## Причина
1. **Tool-описание `payload` (`lib/ai/propose/tool.ts`) документировало только форму `VOCAB_ENTRY`.** Для остальных типов модель угадывала ключи и эмитила свои разумные, но НЕ канонические имена/структуру:
   - `EXERCISE_SET`: `{title, cefrLevel, exercises:[{type:"FILL_IN_THE_BLANK", question, correctAnswer, explanationRu}]}` — схема ждёт `items:[{type, prompt, answer, ...}]`. Плюс `FILL_IN_THE_BLANK` нет в enum `ExerciseType` → упало бы и на уровне Prisma.
   - `HOMEWORK_CORRECTION`: **плоский одиночный** `{original, corrected, errorType, explanation}` (потому что персона велит «одно предложение на ошибку») — схема ждёт `corrections:[{…, explanationRu}]`.
2. **Валидация шла только на Apply, а не на persist.** `persistProposal` (`persist.ts`) сохраняет `payloadJson` как есть (без `.parse()`), поэтому кривое предложение становилось видимой карточкой и роняло 500 на `applyTarget` (`apply-db.ts`), где `Schema.parse(payload)` бросал `ZodError` (`"corrections" Required` / `"items" Required`).
3. Доп. для homework: плоский payload **не содержал `homeworkId`**, а у предложения не был выставлен `targetId` → даже после починки zod упёрлось бы в `homeworkId required (400)`.

## Фикс
- **Толерантные `z.preprocess` нормализаторы** в `tool.ts` (тот же приём, что `genderField`): приводят альтернативные формы к канону — `exercises|questions|tasks → items`, `question→prompt`, `correctAnswer→answer`, `explanation→explanationRu`, и `normExerciseType` маппит синонимы (`FILL_IN_THE_BLANK→CLOZE`, …) с фолбэком `CLOZE`; для homework — оборачивает плоскую коррекцию в `corrections:[…]`.
- **Привязка `homeworkId` из scope треда** в `apply-db.ts` (`HOMEWORK_CORRECTION`): `p.targetId ?? payload.homeworkId ?? thread.scopeId (если scopeType=HOMEWORK)`. Работает и для `/correct`-роута, и для дока.
- **Накопление, а не перезапись** `correctionsJson` (модель шлёт одно исправление на предложение): merge + dedupe по `original|corrected`.
- **Tool-описание** дополнено формами `corrections[]` и `items[]` (defense-in-depth — меньше опоры на коэрсинг впредь).

## Верификация
- `tsc` чисто; `vitest` 21→24 (3 регресс-теста на точные формы модели, `propose.test.ts`).
- Браузер: оба ранее упавших предложения по их **тем же** id → `fetch(... /apply)` = **200**. Полный UI: сгенерировать упражнения → Apply → пройти → авто-оценка с ✓ и пояснениями; ДЗ → Apply → исправление отображается (зачёркнуто→исправлено + тип + объяснение).

## Update 2026-06-17 — тот же класс на `GRAMMAR_TOPIC` (+ rule-форма → `[object Object]`)
Найдено живым UI-тестом collection-grouping: `GRAMMAR_TOPIC` НЕ был в толерантном наборе. Apply падал **500** на реальных payload дока (`tutor_chat`), хотя стриминг/группировка/чип работали:
- **`explanationRu` обязателен**, но модель кладёт контент в `contentRu`/`explanation` или только в `rules` → `GrammarTopicPayload.parse` бросал ZodError → 500 (не 400, т.к. parse — в `apply-db`, не на границе).
- **`category` сырой**: модель эмитит `"CASES"` (нет в enum `GrammarCategory`) → Prisma reject.
- `pitfallsRu` вместо `pitfalls`.
- **`rules[].rule` — строка ИЛИ объект**, `rules[].examples` — строки ИЛИ `{de,ru}`. Коэрсинга не было → после починки парса правила сохранялись как `"[object Object]"` (видно на деталке: и в объяснении-синтезе, и в карточке «Правила»).

**Фикс** (`tool.ts`): `GrammarTopicPayload` → `z.preprocess(normGrammarTopic, GrammarTopicFields)`:
- `normGrammarCategory` — синоним-мап (`CASES→CASE`, `ZEITFORM→TENSE`, `KONJUNKTIV→SUBJUNCTIVE`, …) + фолбэк `OTHER`.
- `explanationRu` из `explanationRu|explanation|contentRu|content|description…`; если пусто — синтез из текста правил.
- `pitfallsRu→pitfalls`; `ruleText()`/`ruleExampleText()` вытаскивают строку из строки/вложенного объекта (никогда `String(obj)`); пример `{de,ru}` → немецкая строка.
- Вынес `GrammarTopicFields` (ZodObject) отдельно — `PATCH /api/grammar/[id]` делает `.partial()` (у `ZodEffects` его нет).

**Верификация (live):** Apply того же зависшего proposal по его id → **200**; тема создаётся, авто-раскладывается (`Падежи → Genitiv`), деталка рендерит правила реальным текстом + примеры без `[object Object]`. `tsc` чисто; `vitest` 137→138 (новый `grammar-payload.test.ts` с точными формами модели). Прямое подтверждение пункта «на будущее» ниже: новый target_type без `preprocess` = мина.

> Замечание из этого же теста (НЕ баг приложения): обрыв ответа в доке при моём прогоне был артефактом быстрых `scroll`/`screenshot` поверх захламлённого треда — прямой `fetch` к `/api/ai/chat` отдаёт полный ответ (`finish: STOP` + `proposal` + `done`). Серверный стриминг исправен.

## Профилактика / на будущее
- Рассмотреть **валидацию на persist** (хранить уже нормализованный payload), чтобы кривое предложение вообще не доходило до карточки.
- При добавлении новых `target_type` с вложенными массивами — сразу документировать форму в tool-описании И давать `preprocess`-нормализатор + регресс-тест на «как реально отвечает модель», а не только на канон.
- Связано: Phase 5 заменит `Homework.correctionsJson`-блоб на строки `HomeworkError` (см. [[phase-5-implementation-plan]] §2.2), что снимает проблему накопления на уровне модели данных.
