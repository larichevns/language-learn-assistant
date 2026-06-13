---
tags: [spec, phase-5, adaptive, retention, srs, pkm]
date: 2026-06-13
status: draft
---

# Spec: Phase 5 — Adaptive Learning Loop & Retention

> Цель фазы: превратить ассистента из «умного, но статичного» собеседника в **замкнутый адаптивный контур** — где ошибки автоматически меняют расписание повторений, модель знаний (mastery) и контекст следующего ответа ИИ; где прогресс виден во времени; и где весь процесс обучения принадлежит ученику (export/import).
>
> Контекст: один Next.js + Postgres/Prisma + Gemini. Native RU → German. 5-слойный prompt-envelope, пересобираемый из БД на каждый запрос. Пишем через `propose → Apply`.
>
> **Принцип честности этой спеки.** Инженерная часть (кормить реальными ошибками, retrieval вместо sample, rollups, замыкание контура, grounding) — крепкая, проверенная и низкорисковая. Математика моделирования знаний (BKT/ELO/half-life, FSRS) — хорошо валидирована в классических ITS и на 200M+ ревью Anki. Но утверждение «KT + RAG поверх **LLM**-тьютора измеримо улучшает **результаты обучения**» опирается на тонкую базу: ключевое прямое исследование (TutorLLM, n=30) дало прирост успеваемости **+5%, статистически НЕзначимый**; значимыми были только вовлечённость (+36% времени) и удовлетворённость. Поэтому всё ниже — это best practices, которые **точно** улучшают релевантность/обоснованность контекста, и которые надо A/B-тестить, прежде чем заявлять рост обученности.

---

## 1. Честные ответы на 3 вопроса владельца

### (a) Понимает ли ИИ, что я изучаю?

**Сейчас:** частично. На каждый запрос envelope пересобирается из БД и в Layer 02 «shared knowledge» кладёт: профиль (CEFR, goals, weakAreas, formality) + **выборку 40–60 последних слов** (`from-db.ts:51` — `vocabEntry.findMany take:60 orderBy updatedAt desc`) + грамматические темы с `masteryScore` (`from-db.ts:52` — `take:40 orderBy updatedAt desc`). Модель видит *срез недавнего*, и это лучше, чем ничего.

**Чего не хватает (честно):**
- Это **sample по свежести, а не retrieval по релевантности**. ИИ видит «что недавно трогали», а не «над чем ты сейчас мучаешься». С ростом колоды `take:60` всё хуже репрезентирует реальную картину.
- `masteryScore` и `weakAreasJson` **статичны** — обновляются, только если модель *предложит* изменение и ты его *Применишь*. Они не пересчитываются из реальной успеваемости (SRS/упражнения/ДЗ). Тема, выученная 3 месяца назад и ни разу не повторённая, всё ещё показывается как «85% mastery».
- **Самый богатый сигнал — ошибки — в контекст не попадает вообще.** `Homework.correctionsJson` / `errorSummaryJson` и `ExerciseItem.isCorrect=false` копятся в БД, но envelope их не инжектит. ИИ буквально не может сослаться на вчерашнюю ошибку в Perfekt.

**Вывод:** ИИ понимает «чем ты недавно занимался», но не «что у тебя болит и что пора повторить». Это чинит §5.1.

### (b) Будет ли ИИ всегда отвечать актуально?

**Сейчас:** для чата — да (envelope live из БД + thread summary с watermark, `summarize/route.ts`). Для *состояния знаний* — нет.

**Чего не хватает:**
- Нет **decay**: устаревший `masteryScore` подаётся как свежий. ИИ может похвалить за «освоенный датив», который ты вчера завалил.
- Нет **замыкания контура**: ошибка в упражнении (`grade/route.ts` пишет `isCorrect` в одну ячейку, без attempt-лога) не двигает ни SRS-расписание, ни mastery, ни контекст следующего ответа. Три подсистемы (упражнения, SRS, тьютор) не разговаривают.
- Риск **галлюцинированного прогресса**: без фактического якоря в `<data>` модель может выдумать «успехи».

**Вывод:** «актуально» = (1) decay на чтении + (2) ошибка → пересчёт mastery + сдвиг SRS + попадание в focus-блок + (3) grounding-правило «хвали только то, что есть в данных». Чинится §5.1, §5.2, §7-grounding.

### (c) Могу ли я нормально хранить весь процесс обучения?

**Сейчас:** да, фундамент сильный и осознанный. Атомарность (`@@unique([userId, lemma, pos])`), разделение сырого и структурированного (`rawInput` vs `structuredJson`/`correctionsJson`), `Proposal` как fleeting→permanent pipeline, **append-only `Review` лог** (FSRS-ready revlog: `grade, direction, prevInterval/newInterval, prevEase/newEase, durationMs, reviewedAt`).

**Чего не хватает:**
- **Попытки вне SRS — не first-class.** `ExerciseItem.userAnswer/isCorrect` хранятся *in-place* (перезаписываются при ретрае) — нет временного ряда. `Homework.correctionsJson` — JSON-блоб, не строки. Нельзя построить «ошибки артиклей падают с марта».
- **Нет timeline / journal** — есть россыпь timestamp'ов, но нет единой хронологической сущности «как я сюда пришёл».
- **Нет dashboard метрик** (true retention, mature/young, words per CEFR) — хотя почти всё считается из имеющихся колонок.
- **Нет export/import** — данные открытые и реляционные, но кнопки «вывезти всё» (Anki/CSV/JSON) нет.
- `SrsCard.vocabEntryId @unique` = **одна карточка на слово**, хотя `ReviewDirection` enum уже описывает 4 направления. Узнавание перевода и продакшн plural — это разные памяти (minimum information principle).

**Вывод:** хранилище отличное на уровне «что я знаю», слабое на уровне «как менялось во времени» и «вывезти/импортнуть». Чинится §5.3, §5.4 и сквозным принципом «логи-события, а не перезаписываемые поля».

---

## 2. Что уже хорошо (реальный фундамент)

Не переписываем — на этом строим:

- **Envelope-дисциплина.** Статичный `SYSTEM_PERSONA` как cache-prefix; `<data>`-обёртки; `## DATA VS INSTRUCTIONS` контракт; `## WRITES ARE PROPOSALS ONLY`. Сегрегация stable/volatile — ровно та, что нужна для freshness-vs-caching (§6 Research B).
- **`Review` — настоящий append-only revlog.** Хранит deltas интервалов/ease и тайминг. Это значит: миграция SM-2 → FSRS = **пересчёт, а не миграция схемы**. Anti-lock-in by design.
- **Атомарность + разделение слоёв.** `VocabEntry`=одна лемма, `GrammarTopic`=одно правило, `ExerciseItem`=один промпт. `rawInput` никогда не уничтожается структурированием → можно переэкстрагировать. Это учебниковый Capture→Organize/Distill→Express (PKM CODE).
- **`Proposal` = fleeting→permanent gate.** `PENDING→APPLIED/DISCARDED` — это та самая дисциплина «просмотри fleeting-заметки и продвинь/выкинь», закодированная в схеме.
- **Watermark-rollup паттерн уже есть** (`summarize/route.ts`: `isBackground:true`, `summaryWatermark:{increment}`). Его и клонируем под profile-rollup.
- **Anti-lock-in инфра.** SRS-состояние в plain-колонках; `ProviderConfig/ModelConfig/ModelRouting` развязывает данные от вендора LLM.
- **Немецко-специфичные поля** (Artikel/Plural/Genitiv, separable prefix, Perfekt aux, Partizip II, rection) — чисто маппятся на Anki note fields при экспорте.

---

## 3. Главные пробелы

| Пробел | Impact | Evidence-based fix (источник) |
|---|---|---|
| Envelope подаёт **sample по свежести**, не retrieval по нужде (`from-db.ts:51-52`) | ИИ не видит «что болит»; плохо масштабируется с ростом колоды | Focus-блок (due/lapsed/weak/recent-errors) + pgvector retrieval (Research B §2-3; TutorLLM кормит KT-state в prompt) |
| `masteryScore` / `weakAreasJson` **статичны**, не из успеваемости | Stale картина знаний; ИИ хвалит за заваленное | BKT-update на каждый `isCorrect`/correction + decay на чтении + nightly rollup (Research B §1, §4; BKT — каноника ITS) |
| **Ошибки не кормят** ни тьютора, ни расписание | Контур разомкнут — это FAQ-бот, а не ITS | Замкнуть: ошибка → mastery↓ + SRS dueAt раньше + в focus-блок (Research B §5) |
| **SM-2**, с брутальным reset на lapse (`scheduler.ts:26-41`) | Лишние повторения; нет вероятности recall | FSRS поверх существующего `Review`-лога (Anki FAQ; benchmark 350M+ ревью; ~99.5% юзеров — точнее) |
| **Грамматика без SRS** (только vocab) | Правила учатся раз и забываются | Грамматика как spaced production-карточки через тот же движок (Research A §9) |
| **Нет attempt-лога** вне SRS; `ExerciseItem`/ДЗ перезаписываются in-place | Нельзя построить «ошибки во времени», нельзя обучить FSRS на упражнениях | Append-only `Attempt` + строки `HomeworkError` (Research C §3, §5; Thewissen 2013) |
| **Нет timeline/dashboard** | Не видно прогресса; нет мотивации; CEFR без истории | `TimelineEvent` read-model + derived метрики (true retention, mature≥21д, words/CEFR) (Research C §4-5; Anki stats) |
| **Нет export/import** | Lock-in риск; данные ученика не портативны | One-click export JSON/CSV/.apkg + round-trip import (Research C §6-7; Anki plain-text урок) |
| **Recognition-first** форматы (MCQ), мало production | Слабее долговременная память (generation/production effect) | Cloze-в-контексте + production-дриллы по умолчанию (Research A §1, §3, §7) |
| `SrsCard.vocabEntryId @unique` = 1 карта/слово | Plural и перевод шедулятся вместе, хотя это разные памяти | Unique `[vocabEntryId, direction]` (Research C §1; minimum information principle) |
| Нет curriculum / can-do целей | Нет пути обучения, цели расплывчаты | CEFR can-do дерево целей (Research A §10) |

---

## 4. Phase 5 — Adaptive Learning Loop & Retention

> Приоритеты: **P0** = ядро контура, без него фаза бессмысленна. **P1** = заметная ценность, строится на P0. **P2** = усиление/полировка.
>
> Маппинг файлов (подтверждён чтением кода):
> `lib/ai/envelope/from-db.ts` (focus-queries + retrieval вместо `take:60`), `lib/ai/envelope/layers.ts` (`formatShared` decay+focus; persona grounding; `FEATURE_ADDENDA.exercise_generate` целевой ELO-бэнд), `app/api/exercises/[id]/grade/route.ts` (запуск BKT/ELO/SRS на `isCorrect`), `app/api/threads/[id]/summarize/route.ts` (шаблон nightly rollup), `lib/srs/scheduler.ts` (FSRS), `prisma/schema.prisma`.

### 5.1 Adaptive context — кормить ИИ ошибками/слабостями + retrieval вместо sampling + mastery rollups

#### 5.1.1 Focus-блок «Над чем сейчас работаем» (Layer 02.5) — **P0**
- **Что.** Новый детерминированный блок в envelope, собираемый *по нужде, а не по свежести*: (1) due/lapsed SRS-карты, (2) самые слабые грамма-темы, (3) последние ошибки (упражнения + ДЗ).
- **Почему.** Это центральный тезис ITS-LLM работ: KT-state (mastery, слабые зоны, ошибки) → в prompt (Research B §2; TutorLLM «synthesizes current learning status, focusing on weak knowledge areas»). Самый богатый сигнал — ошибки — мы уже храним и не используем.
- **Схема/impl.** В `from-db.ts` добавить запросы (используя существующие индексы):
  - `SrsCard where dueAt<=now order by dueAt` (индекс `@@index([userId, dueAt])`) → топ ~10 «к повторению»; отдельно высокий `lapses` → «часто забываешь».
  - `GrammarTopic order by (decayed)masteryScore asc take 5` (вместо `updatedAt`).
  - последние ~10 `ExerciseItem where isCorrect=false`; последний `Homework.correctionsJson`/`errorSummaryJson`.
  - В `layers.ts`: `formatFocus(...)`, каждый пункт через `wrapData('recent_error', …)` / `wrapData('due_card', …)` / `wrapData('weak_topic', …)` (сохраняем `## DATA VS INSTRUCTIONS`).
  - Старый список 40 слов оставить как фон, но **урезать жёстче** (`take:20`) — свежесть несёт focus-блок. Сохранить `CAPS`.

#### 5.1.2 Decay для mastery на чтении — **P0** (highest leverage / lowest cost)
- **Что.** Не доверять stored `masteryScore`; на чтении применять экспоненциальный спад.
- **Почему.** Забывание между сессиями; mastery только по прошлой правильности завышает текущее знание. Forgetting-augmented BKT повышает точность (Research B §1c; PC-BKT).
- **Схема/impl.** В `from-db.ts`/`formatShared`: `effective = masteryScore · 2^(−Δdays / halfLife)`, `Δdays = now − GrammarTopic.updatedAt`, `halfLife` — per-category константа (≈30д, больше для хорошо отработанных). Surface именно **decayed**. Нулевая миграция схемы.

#### 5.1.3 BKT-обновление mastery из реальных событий — **P1**
- **Что.** `GrammarTopic.masteryScore` (Float 0..1) = слот BKT `p(L)`. Заменить «AI предложил» на per-topic BKT-апдейт на каждое gradeable событие.
- **Почему.** BKT отделяет «угадал» (Guess) от «знает», прощает slip — калиброванная вероятность вместо сырого hit-rate; каноника ITS (Research B §1a; pyBKT).
- **Схема/impl.** Маппинг события→скилл по существующим FK: `ExerciseItem → ExerciseSet.grammarTopicId`; `Homework`-correction `errorType` → `GrammarTopic.category`. На `isCorrect`-write и на correction — апдейт:
  - correct: `p(L|c)=p(L)(1−S)/[p(L)(1−S)+(1−p(L))G]`
  - wrong: `p(L|w)=p(L)S/[p(L)S+(1−p(L))(1−G)]`
  - затем `p(L_{t+1})=p(L|obs)+(1−p(L|obs))·p(T)`
  - Фиксированные параметры (`G=0.2, S=0.1, T=0.15, L0=0.1`) — фита per-skill нет данных.
- **Честно:** один ученик + редкие попытки на тему = шумные оценки. Трактовать как сглаженный сигнал, не истину.

#### 5.1.4 ELO ability-band для генератора упражнений — **P2**
- **Что.** `LearnerProfile.abilityJson` (map по `GrammarCategory`, default 1200); опц. `ExerciseItem.difficultyRating`. ELO-апдейт на `isCorrect`.
- **Почему.** ELO≈IRT по сложности, но без претеста и дёшево (Research B §1b). Для одного ученика полезнее как трекер **ability**, чем краудовая сложность (ELO хочет 100+ учеников).
- **Схема/impl.** `expected=1/(1+10^((R_item−R_learner)/400))`, `R_learner += K·(actual−expected)`, K≈32. В `FEATURE_ADDENDA.exercise_generate` (`layers.ts`) целиться ability±100 (desirable difficulty), вместо грубого «избегай явно освоенного». Seed `difficultyRating` из `cefrLevel` + mastery.

#### 5.1.5 RAG-retrieval по данным ученика (pgvector) — **P1**
- **Что.** Embed артефактов один раз; на запрос — top-k семантически релевантных вместо `take:60 by updatedAt`.
- **Почему.** Масштабирование private/recency-sensitive данных; grounding + provenance дешевле large-context (Research B §3; TutorLLM Scraper-store).
- **Схема/impl.** pgvector-колонка (уже Postgres). Embed `VocabEntry.lemma+translationRu`, `GrammarTopic.title+explanationRu`, `ClassNote.structuredJson`, снапшоты `Homework.correctionsJson` (на write или в nightly job). В `assembleEnvelopeFromDb` при наличии `userMessage`/`scope`: `ORDER BY embedding <=> queryVec LIMIT k`. **Гибрид:** детерминированный focus-блок (5.1.1) — всегда; vector — для long-tail фона. `k≈8–12`, держать `CAPS`.
- **Честно:** при паре сотен items обычный stuffing ещё работает — RAG это *путь масштабирования*, строить до того как корпус огромен, не на день 1.

#### 5.1.6 Nightly profile-rollup (computed weakAreas) — **P1**
- **Что.** По расписанию: пересчёт decayed `masteryScore` для всех тем, пересчёт `weakAreasJson` детерминированно из ошибок, опц. LLM-сводка «recent progress».
- **Почему.** Inference-only LLM-KT не масштабируется (длина промпта, токены, латентность) → поле двигается к *summarization* истории (Research B §4). Offline предрасчёт держит latency/cost плоскими.
- **Схема/impl.** Клонировать watermark-rollup из `summarize/route.ts` (`isBackground:true`). Шаги: (1) decay всех тем; (2) `weakAreasJson` = топ 3-5 `GrammarCategory` по error-rate из `isCorrect=false` + `errorSummaryJson` за trailing window — **computed, не authored**, идёт прямо в `formatShared`; (3) опц. one-paragraph note, инжектится как `formatThreadSummary`. Планировать через cron-тулинг. Freshness-guard: если rollup >24ч — fallback на live counts.

### 5.2 Retention engine — FSRS, грамматика-SRS, error-driven review

#### 5.2.1 Per-attempt лог + per-direction карты — **P0** (фундамент для всего 5.2/5.3)
- **Что.** (a) Append-only `Attempt(userId, targetType, targetId, isCorrect, errorTypeJson, durationMs, attemptedAt)`. (b) `Homework`-corrections → строки `HomeworkError(homeworkId, errorType enum, original, corrected, explanationRu, grammarTopicId?)`; `errorSummaryJson` остаётся как *derived cache*. (c) `SrsCard` unique → `[vocabEntryId, direction]`.
- **Почему.** Immutable per-attempt записи — то, что делает возможным FSRS-оптимизацию, trend-дашборды и чистый export (Research C §1, §3, §5). Сейчас `grade/route.ts:41-44` пишет в одну ячейку — временного ряда нет. Per-direction: plural и перевод — разные памяти (minimum information principle).
- **Схема/impl.** Новые модели + миграция. `grade/route.ts`: вместо/в дополнение к in-place update — `Attempt.create`. `Review` уже правильный — **не трогать, держать append-only**.

#### 5.2.2 Замкнуть контур: ошибка → расписание + mastery + контекст — **P0**
- **Что.** Ошибка обязана: (a) сдвинуть SRS-item раньше/жёстче, (b) понизить mastery темы, (c) стать видимой следующему ответу тьютора.
- **Почему.** Это определяющее свойство ITS vs FAQ-бот (Research B §5). Реакция на lapse важна: SM-2 катастрофически ресетит (`scheduler.ts:26-41`), не различая «забыл известное» и «не учил».
- **Схема/impl.** Когда `ExerciseItem` с `vocabEntryId` неверный — *также* подвинуть `SrsCard.dueAt` раньше (ошибки упражнений и ревью кормят одну очередь). Mastery-сторона = 5.1.3. Тьютор-сторона = 5.1.1 + 5.1.6 → следующий ход уже видит ошибку. Пример контура: завалил «Perfekt mit sein» утром → mastery↓ + карта due раньше + в focus-блоке → вечером чат сам это дрилит.

#### 5.2.3 Миграция SM-2 → FSRS — **P1**
- **Что.** Заменить `lib/srs/scheduler.ts` на FSRS-библиотеку (Python/Rust/JS open-source); все типы карт (vocab cloze, грамма-production, предложения) через один движок.
- **Почему.** FSRS на DSR-модели (Difficulty/Stability/Retrievability) *предсказывает* P(recall) и целит desired retention; точнее SM-2 для ~99.5% юзеров (benchmark 350M+ ревью). На lapse снижает stability *умеренно* (остаточная память), не ресетит. **Честно:** «−20-30% повторений» — из *симуляции*, не RCT; выигрыш в точности предсказаний — доказан, экономия — модельная оценка.
- **Схема/impl.** Миграция = **пересчёт, не схема** — `Review` уже хранит сырьё. Добавить: логировать *elapsed since last review* (выводимо из `reviewedAt`) и хранить буквальную кнопку (Again/Hard/Good/Easy) с reversible-маппингом на текущий grade 0-5. Слайдер desired retention (85-95%). Per-user оптимизация параметров — только после ~1000+ ревью; до того — глобальные дефолты.

#### 5.2.4 Грамматика как spaced production-карточки — **P1**
- **Что.** `GrammarTopic` получает SRS-карты (через тот же FSRS), каждое ревью = production (построй/трансформируй предложение по правилу), интерливится с похожими структурами.
- **Почему.** Spacing для грамматики — moderate/emerging, но сходящийся (Research A §9). Production > recognition (§3). Interleaving для путаемых структур (ser/estar-аналоги; Perfekt sein/haben) (§5).
- **Схема/impl.** Обобщить `SrsCard` на `GrammarTopic` (полиморфный target или отдельная `GrammarCard`). Ревью-item — production-задание с focused corrective feedback (§6: подсветить *токен* ошибки, «почти — проверь окончание», пригласить self-correct; не просто recast).

### 5.3 Progress & journal — timeline, метрики, dashboards

#### 5.3.1 `TimelineEvent` read-model — **P1**
- **Что.** Хронологическая проекция ключевых событий: карта дозрела, юнит завершён, ДЗ исправлено, CEFR изменился, цель достигнута.
- **Почему.** Knowledge base отвечает «что знаю», timeline — «как сюда пришёл»; журнал — инструмент мотивации/рефлексии; CEFR-прогресс читаем как тренд (Research C §4; Lampariello).
- **Схема/impl.** `TimelineEvent(userId, type, refType, refId, payloadJson, occurredAt)` — read-model над существующими timestamp'ами (`Review.reviewedAt`, `ClassNote.lessonDate`, `Homework.createdAt`). CEFR-история: логировать смены уровня (single mutable `cefrLevel` теряет историю — сквозная тема).

#### 5.3.2 Derived dashboard метрики — **P1**
- **Что.** Materialized views / derived read-models над immutable логами, **никогда не authored числа**:
  - **True retention** = pass-rate карт с interval≥1д (grade≥3=pass) из `Review`.
  - **Mature/young**: `SrsCard.intervalDays≥21` (mature) + `SrsState`.
  - **Words per CEFR**: `GROUP BY VocabEntry.cefrLevel` / `GrammarTopic.cefrLevel`.
  - **Volume/speed**: `Review.reviewedAt/durationMs`, `ExerciseSet.score`.
  - **Error types over time**: из `Attempt`/`HomeworkError` строк (5.2.1) — иначе только weakly.
- **Почему.** Это durable-метрики Anki (Research C §5). Caveat Anki: дневные данные шумные — показывать **месячные тренды**.
- **Схема/impl.** Индексы уже есть (`@@index([srsCardId, reviewedAt])`, `[userId, dueAt]`, `[userId, state]`). Добавить view `retention(cefrLevel)` и `errorType count by week`.

#### 5.3.3 Streaks / goal tracking — **P2**
- **Что.** Серии дней, прогресс к `dailyGoalCards`, отметки достигнутых целей.
- **Почему.** Закрывает known gap «нет streaks beyond dashboard count»; вовлечённость (единственный значимый эффект в TutorLLM).
- **Схема/impl.** Derive из `Attempt.attemptedAt`/`Review.reviewedAt` по дням; цели — события в `TimelineEvent`.

### 5.4 Ownership — export/import (Anki/CSV/JSON)

#### 5.4.1 One-click «Export everything» — **P1**
- **Что.** Кнопка-фича: full JSON dump + CSV per-entity + `.apkg`/`.txt` для vocab + revlog CSV/JSON.
- **Почему.** Данные ученика — самый незаменимый актив, должны быть портативны в открытых, human-readable форматах; `.apkg` — урок анти-примера lock-in (Research C §6). `Review`→revlog экспорт редок и ценен (большинство приложений теряют историю ревью).
- **Схема/impl.** `VocabEntry`+`SrsCard` → Anki CSV/.apkg (немецкие поля → note fields). Версионировать формы JSON-колонок (`schemaVersion`) и документировать, иначе export станет непрозрачным. Маппить enum'ы на стабильные строки (уже string-backed), не полагаться на cuid-ordering.

#### 5.4.2 Round-trip import — **P2**
- **Что.** Импорт обратно (Anki plain-text round-trippable; обновляет заметки).
- **Почему.** Экспорт без импорта = половина анти-lock-in (Research C §7). FSRS-экосистема (open algo/benchmark/datasets) — позитивная модель: история ревью не заперта в одном шедулере.
- **Схема/impl.** Re-importable CSV/JSON, идемпотентность по `[userId, lemma, pos]`.

### 5.5 Pedagogy features — cloze/production дриллы, comprehensible input, CEFR-цели

#### 5.5.1 Production-first форматы по умолчанию (cloze в контексте) — **P0**
- **Что.** Дефолтный формат ревью/упражнений = **production attempt до reveal** + cloze-deletion в *контексте предложения*, не isolated word→translation. MCQ — только для абсолютных beginners или fallback после повторных провалов.
- **Почему.** Retrieval practice (g≈.5-.7) + generation/production effect — одни из крепчайших находок; cloze + frequency-ordered + varied contexts (Research A §1, §3, §7). Encoding-specificity: учить в контексте использования.
- **Схема/impl.** Расширить генератор (`exercise_generate`): cloze по `VocabEntry.examplesJson`; lock «show answer» за попыткой; попытка → grade-сигнал шедулера. Калибровка по уровню: рецептивный cloze beginners, продуктивный intermediate+. Брать слова по frequency; показывать в 5-10 *разных* контекстах со временем.

#### 5.5.2 Comprehensible input / graded reading (i+1) — **P2**
- **Что.** Генерация/подбор текстов с долей незнакомых слов в полосе 2-5% (95-98% покрытие); tap-to-gloss (перевод + add-to-deck); comprehension-вопросы после (→ retrieval §1).
- **Почему.** Объём comprehensible reading улучшает словарь/интуицию/письмо; 95-98% покрытие нужно для incidental acquisition (Research A §4). **Честно:** «много input» — сильно; «input *достаточно сам по себе*» — нет, нужны interaction/feedback/output.
- **Схема/impl.** Per-user known-words модель (из `SrsCard` mature) + frequency-lexicon; LLM генерит graded reader на target CEFR. Glossed-слова → `Proposal`-pipeline.

#### 5.5.3 CEFR can-do дерево целей — **P2**
- **Что.** Curriculum как дерево can-do дескрипторов, маппленное на CEFR; ученик выбирает целевые дескрипторы; прогресс как «can-dos unlocked»; периодический self-assessment.
- **Почему.** CEFR — де-факто метаязык целей; ясность/прозрачность целей, автономия (Research A §10). Закрывает gap «нет curriculum/learning path».
- **Схема/impl.** `CanDoDescriptor(cefrLevel, text, category)` + `LearnerGoal(userId, descriptorId, status)`. Не интервенция сама по себе — рамка для §5.5.2 (level-gating) и §5.3 (прогресс).

---

## 5. Acceptance — как выглядит «ИИ реально знает, что я учу, и адаптируется» (тестируемо)

Фаза принята, если воспроизводимо:

1. **Контур замкнут (P0).** Ученик заваливает упражнение по `GrammarCategory=TENSE` (Perfekt mit sein) утром. Автоматически, без `propose`: (a) создаётся строка `Attempt` (`isCorrect=false`); (b) `GrammarTopic.masteryScore` падает (BKT-wrong update); (c) связанная `SrsCard.dueAt` сдвигается раньше; (d) тема попадает в focus-блок envelope. Вечером в чате тьютор **сам** ссылается на эту ошибку и предлагает дрилл. *Тест:* e2e — провал → проверить 4 эффекта в БД → следующий envelope содержит `<recent_error>` с этой темой.

2. **Контекст по нужде, не по свежести (P0).** При 500+ словах envelope содержит due/lapsed карты и 3-5 слабейших (decayed) тем, **даже если** они не в 20 последних по `updatedAt`. *Тест:* засеять старую слабую тему (low decayed mastery, stale `updatedAt`) → она в focus-блоке, и НЕ в «recent» списке.

3. **Нет stale-похвалы (P0).** Тема, изученная 90 дней назад и не повторённая, показывается как «нужно освежить» (decayed ≪ stored). *Тест:* unit на `formatShared` — `2^(−90/30)` ≈ 12.5% от stored.

4. **Нет галлюцинированного прогресса (P0).** Персона утверждает прогресс только если он есть в `<data>`. *Тест:* запрос «как мои успехи в дативе?» при отсутствии датива в focus-блоке → ответ не выдумывает успех; для «your progress»-сводки — verification-pass флагует неподтверждённые claims.

5. **Прогресс виден во времени (P1).** Dashboard показывает true retention (mature vs young), words per CEFR, error-types-by-week — всё **derived из логов**, месячным трендом. *Тест:* числа дашборда пересчитываются из `Review`/`Attempt`, нигде не authored.

6. **Ретеншн-движок реагирует на lapse мягко (P1).** На FSRS забытая карта снижает stability умеренно, не ресетит в 0 (в отличие от текущего `scheduler.ts:26-41`). *Тест:* сравнить интервал после lapse FSRS vs SM-2 на одном `Review`-логе.

7. **Грамматика повторяется (P1).** `GrammarTopic` имеет spaced production-карты в той же due-очереди, что vocab. *Тест:* грамма-тема появляется в «к повторению» по расписанию.

8. **Данные принадлежат ученику (P1).** One-click export даёт valid `.apkg` (импортируется в Anki), CSV per-entity и full JSON; revlog экспортируется отдельно. *Тест:* экспорт → импорт в чистый Anki → карты и история читаемы.

9. **Production-first (P0).** Дефолтный формат — попытка-до-reveal / cloze-в-контексте; «show answer» залочен за попыткой; MCQ только fallback. *Тест:* сгенерированный set не содержит MCQ для intermediate+ по умолчанию.

> **Что НЕ входит в acceptance (честно).** Мы НЕ заявляем измеримый рост *обученности* как критерий приёмки — доказательная база для «KT+RAG поверх LLM улучшает learning outcomes» тонкая (TutorLLM n=30, прирост незначим). Критерии выше проверяют **релевантность, актуальность, обоснованность и портативность** — то, что доказуемо. Рост обученности проверяем отдельным A/B внутри приложения, не декларацией.

---

## Зависимости / порядок

- **P0-ядро сначала:** 5.2.1 (attempt-лог + per-direction) → 5.2.2 (замыкание) → 5.1.1 (focus-блок) + 5.1.2 (decay) → 5.5.1 (production-first) + grounding-правило персоны. Это минимальный замкнутый адаптивный контур.
- **P1 поверх:** 5.1.3 (BKT), 5.1.5 (RAG), 5.1.6 (rollup), 5.2.3 (FSRS), 5.2.4 (грамма-SRS), 5.3.1-5.3.2 (timeline/метрики), 5.4.1 (export).
- **P2 полировка:** 5.1.4 (ELO), 5.3.3 (streaks), 5.4.2 (import), 5.5.2 (graded reading), 5.5.3 (CEFR-цели).
- **Сквозной структурный принцип** (из Research C): immutable row-per-event логи > перезаписываемые поля и JSON-блобы. `Review` уже такой — образец. Snapshot-поля (`masteryScore`, `weakAreasJson`, `errorSummaryJson`, `threadSummary`) допустимы как *кэши/read-models* поверх логов, но логи — source of truth.
