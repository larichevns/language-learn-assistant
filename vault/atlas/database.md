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
- `Course` + `LearnerProfile` (native=ru, target=de, CEFR level, goals, weak areas) — envelope layer 02/03 root.
- `Unit` (lesson; `premise` capped source-of-truth, `summary`, `isCurrent`) — layer 03.
- `VocabEntry` — German-specific: `gender (DER/DIE/DAS)`, `pluralForm`, `genitiveForm`, `isSeparable`+`separablePrefix`, `auxiliary (HABEN/SEIN)`, `partizipII`, `praeteritum`, `governsCase`, `examplesJson`.
- `GrammarTopic` — `category`, `explanationRu`, `rulesJson`, `pitfallsJson`, `masteryScore` (feeds layer 02).
- `LearnerPreference` — key/value tone/correction-style.

### SRS (spaced repetition, SM-2; FSRS-ready)
`SrsCard` (`state`, `easeFactor`, `intervalDays`, `dueAt`) + `Review` (graded history).

### Homework / notes
`Homework` (`rawInput`, `structuredJson`, `correctionsJson`, `errorSummaryJson`, `status`), `ClassNote`.

### Exercises
`ExerciseSet` + `ExerciseItem` (`type`: CLOZE / TRANSLATION / CONJUGATION / ARTICLE_GENDER / PLURAL_FORM / CASE_DECLENSION / SEPARABLE_VERB / PERFEKT_FORM / MCQ / …, `answer`, `userAnswer`, `isCorrect`, `feedbackRu`).

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
