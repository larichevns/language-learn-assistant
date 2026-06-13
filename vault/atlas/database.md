---
tags: [atlas, database]
date: 2026-06-13
---

# Database Schema Overview

PostgreSQL via Prisma. Full schema: `prisma/schema.prisma`. Condensed reference + payload contracts: `PLAN.md` §3.

## Groups of tables

### Auth (Auth.js / Prisma adapter)
`User` (+`role: USER|ADMIN`, `tier`, `passwordHash`), `Account`, `Session`, `VerificationToken`.

### Learner domain — the envelope's source of truth
- `Course` + `LearnerProfile` (native=ru, target=de, CEFR level, goals, weak areas) — envelope layer 02/03 root. `weakAreasJson` is a **rollup-derived cache** (rewritten nightly by `crons/rollup` from decay+errors; `weakAreasComputedAt` stamps freshness). `progressNoteRu`/`progressNoteAt` hold the optional weekly note (written in the learner's native language despite the legacy field name).
- `Unit` (lesson; `premise` capped source-of-truth, `summary`, `isCurrent`) — layer 03.
- `VocabEntry` — German-specific: `gender (DER/DIE/DAS)`, `pluralForm`, `genitiveForm`, `isSeparable`+`separablePrefix`, `auxiliary (HABEN/SEIN)`, `partizipII`, `praeteritum`, `governsCase`, `examplesJson`.
- `GrammarTopic` — `category`, `explanationRu`, `rulesJson`, `pitfallsJson`, `masteryScore` (BKT p(L), feeds layer 02) + `masteryUpdatedAt` (decay anchor, bumped only by BKT).
- `LearnerPreference` — key/value tone/correction-style.

### SRS (spaced repetition — FSRS via `ts-fsrs`)
<!-- Updated: 2026-06-13 | Phase 5 Slice 5 + per-direction -->
`SrsCard` — **per-direction** (`@@unique([vocabEntryId, direction])`; `VocabEntry.srsCards[]`): DE→RU recognition, RU→DE production, PRODUCE_ARTICLE, PRODUCE_PLURAL are separate memories. **FSRS** state (`stability`/`difficulty`/`learningSteps`); SM-2 cols kept as legacy/export. `Review` = append-only revlog. `LearnerProfile.desiredRetention` (0.85–0.95) targets FSRS.
`GrammarCard` — same FSRS engine for grammar topics (one per topic, auto-enrolled on Apply); reviewed as **production** + self-graded; the grade also feeds BKT mastery via `recordAttempt`.

### Homework / notes
`Homework` (`rawInput`, `structuredJson`, `correctionsJson`, `errorSummaryJson`, `status`), `ClassNote`.

### Exercises
`ExerciseSet` + `ExerciseItem` (`type`: CLOZE / TRANSLATION / CONJUGATION / ARTICLE_GENDER / PLURAL_FORM / CASE_DECLENSION / SEPARABLE_VERB / PERFEKT_FORM / MCQ / …, `answer`, `userAnswer`, `isCorrect`, `feedbackRu`).

### Adaptive loop (Phase 5)
<!-- Updated: 2026-06-13 | Phase 5 Slice 0 — adaptive loop tables -->
- `Attempt` — **append-only** per-gradeable-event log (`source: EXERCISE_ITEM|SRS_REVIEW|HOMEWORK|CHAT_DRILL`, `isCorrect`, `grade?`, `grammarTopicId?`/`category?` for BKT, `durationMs?`). Source of truth for mastery + error metrics; never overwritten.
- `HomeworkError` — per-mistake rows (`errorType: HomeworkErrorType` German contract, `original`/`corrected`/`explanationRu`, `grammarTopicId?`); `Homework.correctionsJson` kept as display cache.
- `TimelineEvent` — journal read-model (CARD_MATURED, HOMEWORK_CORRECTED, …), read by `/progress`. Derived metrics (`lib/learning/metrics.ts`: true-retention, mature/young, streak, words-by-CEFR, errors-by-type) come from the logs, never authored. See [[phase-5-implementation-plan]].

### Chat & write path
`ChatThread` (`scopeType`+`scopeId`, unique per object; `threadSummary`, `summaryWatermark`) + `ChatMessage`. `Proposal` (`targetType`, `targetId?`, `op`, `payloadJson`, `status`, `appliedEntityId`).

### AI infrastructure (ported from ToonyGamy)
`ProviderConfig` (encrypted key, health), `ModelConfig` (pricing/caps), `FeatureFlag`, `ModelRouting` (priority), `PromptTemplate` (versioned, one active), `PromptVariable`, `UsageEvent` (tokens/cost, idempotent `requestId`, `isBackground`), `RateLimit` (per tier), `AbuseEvent`.

## Conventions
- PK: `cuid()`. Timestamps: `createdAt`/`updatedAt` (timestamptz).
- Soft delete: none (hard delete + cascade rules); generations/usage never cascade-deleted.
- Index every FK + common filter; uniqueness: `(userId, lemma, pos)` on vocab, `(userId, scopeType, scopeId)` on threads, `(featureId, promptType, version)` on templates.

## Related
- [[architecture]] · [[conventions]]
