---
tags: [api, changelog]
date: 2026-06-13
---

# API Changelog

All routes follow the `{ code, message, data }` envelope. Auth via Auth.js v5 session; mutations are owner-checked; admin routes require `role=ADMIN`. SSE for streaming chat.

## [Unreleased] — entryDate, per-tab search, markdown notes (2026-07-05)
<!-- Updated: 2026-07-05 | entryDate + notes-as-markdown-notebook + per-tab search -->

### Items — user-editable `entryDate` + narrow metadata PATCH
`ClassNote`/`Homework`/`ExerciseSet` gained a user-owned `entryDate` (default `now()`), distinct from `createdAt`; `ClassNote.lessonDate` untouched. Schema + backfill: [[database]] · decision: [[entryDate-это-пользовательская-дата-записи-отдельная-от-createdAt-сортировка-на-клиенте]].
- **Extended** `POST /api/notes` + `PATCH /api/notes/[id]` — accept `entryDate` (ISO). `PATCH` is still the partial editor (title/rawInput/lessonDate/groupId).
- **Extended** `POST /api/homework` — accepts `entryDate` (also used by the note→homework promote copy, below).
- **New** `PATCH /api/homework/[id]` — body `{ title?, entryDate? }` **only**; the correction lifecycle (`status`/`rawInput`/`structuredJson`) stays sealed from this generic editor. `400` bad body, `404` foreign/missing.
- **New** `PATCH /api/exercises/[id]` — body `{ entryDate? }` only (date, no lifecycle). `400`, `404`.
- **Fix** `PATCH /api/notes/[id]` — an explicit `title: null` now **clears** the title (tri-state absent/null/value: `d.title === undefined ? undefined : d.title`); previously a null was silently ignored.
- **No** server `orderBy` change and **no** envelope change: list sort by `entryDate` is client-side (`SortToggle`); `lib/ai/envelope/from-db.ts` still orders by `updatedAt`.

### Notes — markdown notebook + promote-to-homework (no new endpoint)
- `app/(app)/notes/[id]` is now read/edit: read renders markdown (`react-markdown` + `remark-gfm`, **no `rehype-raw`** = raw HTML stays inert), edit mounts `Composer` → `PATCH /api/notes/[id]`. Decision: [[react-markdown-без-rehype-raw-это-санитайзер-заметок-редактор-остаётся-textarea]].
- **"Send to homework"** = `POST /api/homework` copying the note's `title`/`rawInput`/`entryDate` into a `SUBMITTED` Homework (the note stays; AI correction is triggered manually afterwards).

### Lists — client-side per-tab search (no API/DB change)
- All 5 list pages (vocab/grammar/notes/homework/exercises) filter the loaded page (≤100 items, React Query in-memory) via the reusable `SearchInput`; the server `?q=` on vocab/grammar GET stays intentionally unused for uniformity. Pattern: [[клиентский-поиск-по-вкладке-SearchInput-фильтр-до-группировки]].

## [Unreleased] — Collection grouping (2026-06-17)
<!-- Updated: 2026-06-17 | collection-grouping feature -->
Группировка обобщена со словаря на **грамматику и заметки**: `VocabGroup` свёрнута в доменную `CollectionGroup` (`domain` VOCAB|GRAMMAR|NOTE). Спека: [[collection-grouping]] · модуль API: [[groups]] · решение: [[Одна-CollectionGroup-с-доменом-VOCAB-GRAMMAR-NOTE-VocabGroup-свёрнута-rename-миграцией]].

### Groups (generic, domain-parametrized)
- **New** `GET /api/groups?domain=VOCAB|GRAMMAR|NOTE` → `GroupTree` (tops с вложенными `children` + `itemCount` прямых элементов листа, и `ungroupedCount`). `400` при плохом/отсутствующем `domain`.
- **New** `POST /api/groups` (`CreateGroupDto & { domain }`) → `GroupNode` — create top/subgroup; 2-уровневый инвариант + top-level дедуп через явный `findFirst parentId:null` (Postgres считает NULL различными); `409` дубль в пределах родителя, `422` уровень-3 / чужой / иного-домена `parentId`.
- **New** `PATCH /api/groups/[id]` (`UpdateGroupDto`) → `GroupNode` — rename/recolor/move/reorder; `domain` берётся из строки и скоупит все проверки; `422` (уровень-3, top-с-детьми→подгруппа, self-parent, чужой родитель), `409` дубль, `404` чужая/несуществующая.
- **New** `DELETE /api/groups/[id]` → `200 {id,deleted:true}` (каскад подгрупп; у элементов всех трёх доменов `groupId → null` через SET NULL → в «без группы»). `200`-с-телом (не `204`) для консистентности с прочими DELETE.
- **Retired** `/api/vocabulary/groups` + `/api/vocabulary/groups/[id]` (**DELETED**) — консолидированы в `/api/groups?domain=VOCAB`. См. секцию vocab-grouping ниже (помечена superseded).

### Items — group-move расширения
- **Extended** `PATCH /api/grammar/[id]` — принимает `{ groupId: string|null }` (перенос темы; домен-проверка `GRAMMAR`, чужой/иного-домена id → `422`; `null` = ungroup). Остаётся частичным редактором собственных полей темы (`category` ортогонален).
- **Extended** `PATCH /api/notes/[id]` — то же, домен `NOTE`.
- **Extended** `GET /api/exercises` — список теперь возвращает `grammarTopicId` + `sourceType` + `grammarTopic:{ title }` (для производной группировки упражнений по связанной теме). Pure read-enrichment, без новой модели/таблицы/envelope.

### AI write-path
- `propose` `GRAMMAR_TOPIC` и `CLASS_NOTE` payload получили `group/subgroup/groupId/subgroupId` (как у `VOCAB_ENTRY`); Apply `resolveGroupId(tx,userId,domain,p)` делает домен-скоупленный create-or-reuse, проставляя `groupId` в той же транзакции. Cross-domain id-leak отвергается структурно (`domain` в каждом `where`). Envelope-слой 02 рисует блок групп **на домен** (`## Vocabulary/Grammar/Note groups`) с `{g:id}`. См. [[ИИ-дообогащает-и-сам-раскладывает-из-краткой-команды]].
- **Derived (no endpoint):** домашка группируется на клиенте по `status`, упражнения — по связанной теме грамматики; ни таблицы, ни ИИ-таксономии.

## [Unreleased] — 2026-06-17 (chat fixes)

### AI / Threads
- `POST /api/threads/[id]/clear` — **new.** Soft-reset ("New chat") for a scope's thread: hides current turns (`isSummarized=true`, kept in DB), clears `threadSummary`, discards the thread's pending proposals. Owner-checked.
- `POST /api/ai/chat` — **behavior change.** The assistant turn is now persisted only when it carries text — **including a partial answer cut short by Stop/timeout**; empty turns are no longer written. Client `Stop`/disconnect (`req.signal.aborted`) is a graceful stop, not an `error` event. Fixes the "answers the previous message first" bug (dangling user turn coalesced with the new one) together with the `buildEnvelope` history-trim. See [[оборванный-ответ-оставляет-висящий-user-турн-модель-отвечает-на-старое]]. **Also:** after each successful turn it fires the rolling thread summary (below).
- `POST /api/threads/[id]/summarize` — **activated.** Was implemented but never called; now a thin wrapper over the shared `summarizeThreadIfNeeded`, which the chat route fires automatically (rolling summary: fold turns older than the last 12 into `threadSummary`, merging the prior summary; background, non-billed). Threads past the window keep their early context. See [[чат-это-стол-БД-это-память-rolling-summary-написан-но-не-вызывается]].

## [0.1.0] — 2026-06-13 (MVP)

### Auth
- `POST /api/auth/register` — email/password sign-up (creates profile + course).
- `/api/auth/[...nextauth]` — Auth.js (credentials + Google).

### AI
- `POST /api/ai/chat` — SSE tutor chat; envelope rebuilt from DB; emits `token · proposal · usage · finish · done · error`.
- `POST /api/threads/[id]/summarize` — background thread summarizer (cheap model, not billed).
- `GET  /api/threads/resolve` — get-or-create thread for a scope → recent turns + pending proposals.
- `POST /api/proposals/[id]/{apply,refine,discard}` — propose→Apply write path.

### Domain
- Vocabulary: `GET/POST /api/vocabulary`, `GET/PATCH/DELETE /api/vocabulary/[id]`, `GET/POST /api/vocabulary/review` (due queue + SM-2 grading).
- Grammar: `GET/POST /api/grammar`, `GET/PATCH/DELETE /api/grammar/[id]`, `POST /api/grammar/explain`.
- Homework: `GET/POST /api/homework`, `GET/DELETE /api/homework/[id]`, `POST /api/homework/[id]/correct` (text + vision).
- Notes: `GET/POST /api/notes`, `GET/PATCH/DELETE /api/notes/[id]`.
- Exercises: `GET/POST /api/exercises`, `GET/DELETE /api/exercises/[id]`, `POST /api/exercises/generate`, `POST /api/exercises/[id]/grade`.

### Admin (`requireAdmin`)
- prompts (CRUD + `[id]/activate`), variables (CRUD), providers (CRUD + `[id]/test` + `[id]/refresh-models`), features (CRUD + `[id]/routing`), usage, rate-limits (GET/PUT), users (list + `[id]` role/tier), playground, moderation.

### Cron
- `GET /api/crons/cleanup` — prune resolved proposals + old error logs (`CRON_SECRET`).

## [Unreleased] — Phase 5 (Slices 0–8, in progress)
<!-- Updated: 2026-06-13 -->
- **Progress:** `GET /api/progress/stats` (derived metrics — true-retention, mature/young, streak, words-by-CEFR, errors-by-type; now also returns `weeklyNote`/`weeklyNoteAt` from the rollup), `GET /api/progress/timeline` (journal feed).
- **Profile:** `GET /api/profile` (desiredRetention + cefr/langs), `PATCH /api/profile` (set `desiredRetention` 0.80–0.97 — the FSRS slider in Settings).
- **Grammar SRS:** `GET/POST /api/grammar/review` (FSRS grammar cards; production self-grade; grade feeds BKT).
- **Export:** `GET /api/export?format=json|vocab-csv|revlog-csv` (file download, `Content-Disposition`).
- **SRS now per-direction + FSRS:** `POST /api/vocabulary/review` accepts `direction` (DE_TO_RU/RU_TO_DE/PRODUCE_ARTICLE/PRODUCE_PLURAL) and reschedules via FSRS (`ts-fsrs`), persisting DSR state.
- **Adaptive loop (no new public routes):** exercise-grade / SRS-review / homework-correction Apply funnel through `recordAttempt` (append-only `Attempt` + BKT mastery + SRS nudge); the AI envelope gains a focus-block + decay-on-read + grounding. See [[phase-5-implementation-plan]].
- **Nightly rollup:** `GET /api/crons/rollup` (CRON_SECRET-gated, like `crons/cleanup`). Recomputes derived `LearnerProfile.weakAreasJson` from decay+30d error hotspots, stamps `weakAreasComputedAt`, emits `WEAK_AREA_CLEARED`/`STREAK_MILESTONE`, and writes an optional background weekly note (`progress_summary` feature, never billed) in the learner's native language. ⚠️ `CRON_SECRET` is empty in `.env` → cron routes 403 until a real secret is set + server restarted.
- Still to come: RAG (pgvector), import.

## [Unreleased] — Vocab grouping (2026-06-14) — SUPERSEDED 2026-06-17
<!-- Updated: 2026-06-14 | vocab-grouping feature -->
<!-- Updated: 2026-06-17 | superseded by collection-grouping: `/api/vocabulary/groups` РОУТЫ УДАЛЕНЫ, их заменил `/api/groups?domain=VOCAB` (см. секцию Collection grouping выше). `wordCount` → `itemCount`. Эта секция оставлена как история. -->
> **Superseded.** Эти `/api/vocabulary/groups*` роуты **удалены** и заменены generic-`/api/groups?domain=VOCAB` (доменная `CollectionGroup`). Ниже — исходная запись для истории.

2-уровневая таксономия словаря (группа→подгруппа) + авто-раскладка ИИ. Спека: [[vocab-grouping]].
- **New** `GET /api/vocabulary/groups` → `GroupTree` (`groups` с вложенными `children` + `wordCount`, и `ungroupedCount`).
- **New** `POST /api/vocabulary/groups` (`CreateGroupDto`) → `GroupNode` — create-or-reuse по имени; `409` дубль в пределах родителя (top-level дедуп через явный `findFirst parentId:null`, т.к. Postgres считает NULL различными), `422` уровень-3 / чужой `parentId`.
- **New** `PATCH /api/vocabulary/groups/[id]` (`UpdateGroupDto`) → `GroupNode` — переименование/перенос/порядок; `422` (уровень-3, top-с-детьми→подгруппа, self-parent, чужой родитель), `409` дубль, `404` чужая группа.
- **New** `DELETE /api/vocabulary/groups/[id]` → `200 {id,deleted:true}` (каскад подгрупп; у слов `groupId → null` через SET NULL). *Прим.:* 200-с-телом для консистентности с существующим vocab DELETE, не 204 из спеки.
- **Extended** `GET /api/vocabulary?groupId=&ungrouped=true` — фильтр по группе/без группы (поверх существующих `pos`/`q`/пагинации).
- **Extended** `PATCH /api/vocabulary/[id]` — принимает `{ groupId: string|null }` (перенос слова; `null` = в «без группы»). Остаётся частичным редактором собственных полей слова; `groupId` валидируется на принадлежность (`422`).
- **AI write-path:** `propose` `VOCAB_ENTRY` payload получил `group/subgroup/groupId/subgroupId`; Apply-диспетчер делает create-or-reuse и проставляет `VocabEntry.groupId` в той же транзакции; envelope-слой 02 показывает дерево групп с токенами `{g:id}` для переиспользования (см. [[ИИ-дообогащает-и-сам-раскладывает-из-краткой-команды]]).
