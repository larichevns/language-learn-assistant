---
tags: [business, backlog, post-mvp]
date: 2026-06-13
---

# POST-MVP Backlog

Everything intentionally deferred past the first usable version. **Rule: nothing leaves the MVP silently — it lands here.** The hero MVP is tutor chat + vocab/SRS + homework correction ([[mvp-scope-and-phases]]).

## Secondary in MVP build, but not the hero (ship after the hero loop works)
- **Exercise generation UI + grading** — schema/AI/route built in Phases 1–2; full UI polish after the hero.
- **Grammar knowledge base UI** — topics list/detail; AI `grammar_explain` exists earlier, the browseable KB UI comes after the hero.
- **Class-notes UI** — intake + structure extraction.

## Deferred (Phase 4 / later)
- **SRS upgrade to FSRS** (replace SM-2): forecast calendar, daily-load balancing, leech detection, per-deck new-card limits, review heatmap.
- **Audio / TTS**: German TTS for cards/examples (Web Speech API or a TTS provider via the abstraction); speech-input practice; read-aloud.
- **Import / export**: CSV + Anki `.apkg` import, JSON backup/export, deck sharing.
- **Analytics**: retention curves, mastery-per-topic, time-on-task; admin charts (Recharts); per-feature funnels.
- **i18n breadth**: full ru/de/en parity, German UI locale, RTL scaffolding. (ru+en fallback ships from day one; this is the *breadth* work.)
- **More AI providers**: OpenAI / Anthropic / DeepSeek behind `BaseProvider`; tier-based routing; `ALLOW_NON_GEMINI_PROVIDERS` guard; explicit Gemini context-caching for large prefixes.
- **Caching & cost tuning**: Upstash prefix/response cache, image-cache cron tuning, batched background ops for free-tier quota.
- **Prod hardening**: Sentry, structured logging, perf budgets, axe audit, CI gates, expanded E2E.
- **Productionization for many users**: move guards in-memory→Upstash, hosted Postgres (Neon/Supabase), billing/tiers if it goes public.

## UI / design polish (Phase 7 follow-ups, from ui-tester)
- Mobile nav drawer: proper slide-in animation (shadcn `Sheet`) — backdrop + z-order already fixed.
- Manual "add word" form: run through the propose/Apply enrichment pipeline (article/gender/plural/level) instead of saving bare lemma+translation.
- Dark mode: raise sidebar text contrast (`text-muted-foreground` → `text-foreground/80`).
- Optional vertically-centered assistant window mode (current: grows up from the bottom composer, per ToonyGamy).
- Generate proper PNG/maskable PWA icons (currently a single SVG).

## Possible future features (ideas, unscheduled)
- Conversation/role-play practice mode with scenario prompts.
- Listening comprehension from German audio/video.
- Calendar/streak reminders + push notifications (PWA).
- Goethe/TELC exam-prep mode (timed mock tests).

## Phase 5 follow-ups (optional polish / deferred within the phase)
<!-- Updated: 2026-06-13 | polish batch after Slice 8 -->
- **Desired-retention slider** — **DONE** (Settings → «Целевое запоминание», 0.80–0.97; `GET/PATCH /api/profile`; verified live: drag → debounced PATCH → DB persisted).
- **Grammar-due on the dashboard** — **DONE** (the «К повторению» card sums vocab + grammar due, with a `{vocab} слов · {grammar} грамм.` breakdown; click routes to wherever work waits).
- **Weekly-note model** — **DONE** (lite→**flash** for tighter format adherence; `cleanNote` still strips stray markdown as a safety net).
- **i18n detail pages** — **DONE** (grammar/homework/notes/exercises `[id]` externalized to `messages/{ru,en}.json`; the `'(фото-домашка)'` rawInput sentinel left as data, not translated).
- **FSRS per-user parameter optimization** once a user has ~1000+ reviews (the `Review` log is the training data); until then, global defaults.
- **Replay `Review` log to seed FSRS stability** for pre-FSRS cards (today they transition fresh on the next review).
- Spaced-repetition for grammar — **DONE** (Slice 6: `GrammarCard` + production self-grade).
- **Nightly rollup deploy (Slice 8 follow-ups):** ✅ `CRON_SECRET` now set (real 32-byte hex; `crons/rollup`+`crons/cleanup` verified 200). At scale, bound `runRollup` to learners active in the last ~30d instead of all profiles. Per-user note opt-out is unbuilt. (For prod, set the secrets as host env vars, not a file.)
- Remaining Phase 5 slices (9 RAG/pgvector · 10 ELO/streaks/import/graded-reading/CEFR-goals) are scoped in [[phase-5-implementation-plan]], not here.

## Chat / thread (2026-06-17)
<!-- Updated: 2026-06-17 | chat fixes session -->
- **Activate thread summarization** — **DONE** (2026-06-17). `summarizeThreadIfNeeded` fires from the chat route after each successful turn (rolling, background, non-billed; folds turns older than the last 12 into `threadSummary`, merging the prior summary). Detail: [[чат-это-стол-БД-это-память-rolling-summary-написан-но-не-вызывается]]. Optional follow-up: surface a collapsible "earlier in this chat (summary)" divider at the top of the dock when `resolve` returns a non-null `summary`.
- **"Continue?" affordance for a dangling user turn** — when `resolve` returns a thread whose last turn is an unanswered USER message (stream was cut), the UI could offer to retry it instead of silently leaving it. (The model side is already fixed — it no longer answers it on the next send.)

## Collection grouping (2026-06-17)
<!-- Updated: 2026-06-17 | deferred from collection-grouping -->
Shipped: generic `CollectionGroup` (domains VOCAB/GRAMMAR/NOTE), full taxonomy for vocab/grammar/notes, derived buckets for homework/exercises, richer `grammar_explain`. Spec: [[collection-grouping]] · decision: [[Одна-CollectionGroup-с-доменом-VOCAB-GRAMMAR-NOTE-VocabGroup-свёрнута-rename-миграцией]]. Deferred:
- **ИИ-слияние близких дублей групп** (любого домена) — сейчас reuse через показ таксономии минимизирует дубли, но слияния нет (только ручное переименование).
- **ИИ-описания групп/тем** — короткий авторский intro поверх раздела (опция «описание разных тем» НЕ взята в V1).
- **Полная ИИ-таксономия для домашки/упражнений** — вместо текущей производной (статус-бакеты / связанная тема); своя таблица + ИИ-раскладка, если когда-нибудь понадобится.
- **Revisit `grammar_explain` reasoning effort** (`low→medium`, 8192 thinking-токенов) — откатить одной строкой, если free-tier 429 участятся. `tutor_chat` сознательно оставлен `low`. Мониторить через usage-tracking.
- **Drag-and-drop переупорядочивание** групп (сейчас `orderIndex` правится через PATCH, без DnD).
- **Группа как scope чата** (открыть тред в контексте конкретной группы).
- **Уровни глубже 2** (сейчас инвариант — ровно 2 уровня, group→subgroup).

## Related
- [[mvp-scope-and-phases]] · `PLAN.md` §7 Phase 4
