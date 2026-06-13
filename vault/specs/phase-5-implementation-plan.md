---
tags: [spec, phase-5, design, implementation-plan, adaptive, srs, bkt, fsrs]
date: 2026-06-13
status: in progress — Slices 0–8 + deferred shipped (P0 done; P1: progress, per-direction, FSRS, grammar-SRS, export, nightly rollup)
---

# Phase 5 — Solution Design & Implementation Plan

> **Build status (2026-06-13).** **Slices 0–3 DONE — the full P0 is live-verified.**
> - **0 (schema):** `Attempt`, `HomeworkError`, `masteryUpdatedAt` (migration `20260613120029_phase5_adaptive_loop`).
> - **1 (loop):** `lib/learning/{bkt,error-map,record-attempt,nudge}.ts`; wired into exercise-grade + SRS-review + homework-correction Apply; sets bind to their topic via thread scope. *Verified:* fail exercise → `Attempt` logged → mastery 0.45→0.17 (exact BKT) → grammar page shows 17%.
> - **2 (adaptive context):** `lib/learning/decay.ts`; focus-block as Layer 03.5 (`from-db.loadFocus` + `layers.formatFocus`, in the volatile `messages[1]`, never the cached prefix); decayed mastery surfaced as **stable buckets** in shared (no cache-busting drift); `## GROUNDING` persona rule. *Verified:* assembled envelope carries `<weak_topic>`/`<recent_error>`/due-cards, and the tutor referenced them unprompted ("слабая тема — Perfekt… ошибки связаны с Zeitform").
> - **3 (production-first):** `exercise_generate` addendum → cloze-in-context / production, **MCQ only for A1/fallback**, targets focus weak-areas; SRS review is now **attempt-before-reveal** (recall input → check → reveal + ✓/✗ + grade). *Verified live.*
> - **Persona fixes (this session):** response language is **data-driven from `nativeLang`** (no hardcoded "reply in Russian") + match the learner's input language; no greeting mid-conversation. See [[Язык-ответа-выводится-из-nativeLang-а-не-хардкодится]].
> - **4 (progress & journal):** `TimelineEvent` (migration `20260613124553`); emit points `CARD_MATURED` (review route, on crossing 21d) + `HOMEWORK_CORRECTED` (apply); `lib/learning/{metrics,timeline}.ts`; `GET /api/progress/{stats,timeline}`; `/progress` page (true-retention, mature/young, streak, words-by-CEFR, errors-by-type, journal feed) + nav link. *Verified live:* both emit paths fired through real routes → 2 timeline events; every stat cross-checked vs DB; both endpoints 200; page renders (ru), console clean. *(Dashboard-enrich deferred — optional polish.)*
> - **Deferred items — DONE:** **dashboard-enrich** (true-retention chip → /progress + streak unified to count all activity, single `metrics.computeStreak`); **per-direction `SrsCard`** (`@@unique([vocabEntryId, direction])`, `VocabEntry.srsCards[]`, migration `20260613130000`) — auto-enroll now makes DE→RU + **RU→DE (reverse translation)** + PRODUCE_ARTICLE for nouns; direction-aware review UI (each direction shows/checks its own answer); grade routes to the correct direction card (verified: grading the article card advanced only it); existing deck backfilled with RU→DE. All Slice-0 schema deferrals now shipped.
> - **5 (FSRS):** `ts-fsrs` 5.4.1 (approved); `SrsCard.stability/difficulty/learningSteps` + `LearnerProfile.desiredRetention` (migration `20260613131723`); `lib/srs/scheduler.ts` rewritten on the DSR model — a lapse lowers stability *moderately* (no SM-2 reset), schedules toward desired retention; review route persists DSR state + stores difficulty in the revlog. *Verified:* NEW card→Good ⇒ stability 2.31 / difficulty 2.12 / LEARNING (live); unit test confirms lapse keeps residual stability (acceptance #6). *(Desired-retention slider UI deferred — engine uses 0.9 default.)*
> - **6 (grammar SRS):** `GrammarCard` (FSRS state, one per topic; migration `20260613132635`); auto-enroll on topic Apply; `GET/POST /api/grammar/review`; `/grammar/review` page = **production** review (recall the rule → reveal explanation/examples/pitfalls → self-grade), reusing the FSRS scheduler; grade feeds BKT via `recordAttempt`. *Verified live:* review → GrammarCard LEARNING (stability 2.31) + topic mastery 0.173→**0.562** (BKT) + Attempt logged. Data-driven (no hardcoded topics).
> - **7 (export):** `lib/export` (full versioned JSON dump + Anki-importable vocab CSV + revlog CSV; `toCsv` helper); `GET /api/export?format=json|vocab-csv|revlog-csv` (file download, `Content-Disposition`); Settings → «Экспорт данных» (3 download buttons). *Verified live:* all 3 formats HTTP 200 with correct content (JSON dump: 10 vocab w/ srsCards, 6 reviews, attempts, timeline; CSV header rows). *(`.apkg` packaging deferred — CSV is already Anki-importable.)*
> - **8 (nightly rollup):** `lib/learning/rollup.ts` (pure `computeWeakAreas`/`diffClearedAreas`/`pickStreakMilestones`/`cleanNote` + `runRollup`/`runRollupForUser`); `GET /api/crons/rollup` (CRON_SECRET-gated, like `crons/cleanup`). Recomputes `weakAreasJson` from decayed grammar mastery + 30-day error hotspots (≥3 to qualify), stamps new `LearnerProfile.weakAreasComputedAt`, emits `WEAK_AREA_CLEARED` (diff vs prior **derived** baseline — suppressed on first run so a manual/proposal seed isn't falsely "cleared") + `STREAK_MILESTONE` (deduped within the streak window). Optional best-effort weekly note (`progress_summary` background feature, lite model, `isBackground`+`skipRateLimit` → never bills) written in the learner's **nativeLang** (not hardcoded), markdown-stripped to one paragraph by `cleanNote`, shown on `/progress`. `weakAreasJson` is now a **rollup-derived cache**; the live focus-block still computes weakness each send, so a missed cron only means a slightly-stale cached list (hot path untouched). *Verified live:* rollup recomputed `weakAreasJson` → `["времена глагола"]` (TENSE×3 hotspot; the 0.561-decayed Perfekt topic correctly excluded as above-threshold; WORD_ORDER×1 below the floor); first-run cleared-suppression confirmed (0 bogus events); steady-state re-run idempotent (0 events); STREAK_MILESTONE proved via reversible 7-day synthetic-activity test (emitted `{days:7}` once, deduped on re-run, then cleaned up); note generated grounded + in RU, renders clean on `/progress`. *(Found: `CRON_SECRET` is `""` in `.env` → both crons 403 until a real secret is set; see backlog.)*
> - Tests: **55 green** (was 44; +`rollup` pure helpers, +`cleanNote`).
> - **Polish batch (done after Slice 8):** desired-retention slider (Settings + `GET/PATCH /api/profile`) · grammar-due folded into the dashboard «to review» number (+breakdown) · weekly-note model lite→flash · i18n of the `[id]` detail pages. All verified live.
> - **Next:** Slice 9 (RAG/pgvector) · 10 (ELO/streaks/import/graded-reading/CEFR-goals). Optional polish left: `.apkg` export.

> The **what/why/research** lives in [[phase-5-adaptive-learning-loop]]. This is the **how**: exact schema deltas, the closed-loop mechanism, algorithm specs, envelope wiring, API/UI surface, build slices, and a test plan mapped 1:1 to that spec's acceptance criteria. No stubs — every section is buildable as written. File references are confirmed against the current code.

---

## 0. The one architectural decision that frames everything

**Loop writes are NOT `propose/Apply`.** The propose→Apply gate ([[Записи-это-proposals-единственный-путь-записи-Apply]]) exists because *the model* must never write the learner's authored data. Phase 5's loop writes — an `Attempt` row, a `masteryScore` recompute, a `dueAt` nudge, a `TimelineEvent` — are **deterministic, server-side, derived from the learner's own gradeable action** (they submitted an answer; they graded a card). They are exactly the same class as the existing SRS review path, which already writes `SrsCard` + `Review` directly (`app/api/vocabulary/review/route.ts`) without a proposal.

So: the model stays a non-writer. The *learner's actions* deterministically update *derived state*. The source of truth is append-only event logs (`Review`, new `Attempt`); snapshot fields (`masteryScore`, `weakAreasJson`, `errorSummaryJson`) are caches recomputable from the logs. This is the spec's "logs-events, not overwritable fields" principle ([[phase-5-adaptive-learning-loop]] §Зависимости).

**Decision recorded as ADR:** [[Loop-записи-обходят-propose-Apply-это-derived-state]].

---

## 1. TL;DR — what gets built, in order

| Slice | Priority | Delivers | Acceptance it unlocks |
|---|---|---|---|
| **0 · Schema** ✅ | P0 | `Attempt`, `HomeworkError`, `masteryUpdatedAt` shipped. *(per-direction `SrsCard` + `TimelineEvent` deferred — see status note)* | (foundation) |
| **1 · Close the loop** ✅ | P0 | `recordAttempt()` funnel wired into grade route + homework Apply + SRS review; BKT mastery; exercise-error → SRS nudge; topic-binding via thread scope | #1 (a,b ✓ live) |
| **2 · Adaptive context** ✅ | P0 | Focus-block (Layer 03.5, volatile) + decay-on-read (bucketed in shared) + persona grounding + language now data-driven | #2, #3, #4 (✓ live) |
| **3 · Production-first** ✅ | P0 | Generator → cloze/production, MCQ only A1/fallback; SRS review = attempt-before-reveal | #9 (✓ live) |
| **4 · Progress & journal** ✅ | P1 | `TimelineEvent` + emit points; `/api/progress/{stats,timeline}` (derived); `/progress` page + nav | #5 (✓ live) |
| **5 · FSRS** ✅ | P1 | `ts-fsrs` swap; `stability`/`difficulty`/`learningSteps` + `desiredRetention`; lapse keeps residual stability | #6 (✓) |
| **6 · Grammar SRS** ✅ | P1 | `GrammarCard` (FSRS) + auto-enroll; `/grammar/review` production self-grade; grade → BKT | #7 (✓ live) |
| **7 · Export** ✅ | P1 | `/api/export` JSON + vocab-CSV (Anki) + revlog-CSV; Settings download buttons (`.apkg` deferred) | #8 (✓ live) |
| **8 · Nightly rollup** ✅ | P1 | `GET /api/crons/rollup` recomputes derived `weakAreasJson` from decay+errors, emits WEAK_AREA_CLEARED/STREAK_MILESTONE, writes optional native-lang weekly note (`/progress`) | #2 (scale), #5 (✓ live) |
| **9 · RAG** | P1→ | pgvector + embeddings + hybrid retrieval (build when corpus is large, not day 1) | #2 (scale) |
| **10 · Polish** | P2 | ELO ability-band, streaks, import, graded reading, CEFR can-do tree | — |

**P0 milestone = a demoable closed loop** (Slices 0–3): fail an exercise in the morning → `Attempt` logged + mastery drops + card pulled earlier + error in the focus-block → that evening the tutor references the mistake unprompted.

---

## 2. Data model — exact Prisma deltas

All additive except the `SrsCard` unique change (which needs a data backfill). One new migration on top of the `20260613080418_init` baseline.

### 2.1 New: `Attempt` — the append-only spine

Every gradeable event, immutable, one row. This is what makes FSRS-on-exercises, trend dashboards, and clean export possible (today `grade/route.ts:41-44` overwrites one cell → no time series).

```prisma
enum AttemptSource {
  EXERCISE_ITEM
  SRS_REVIEW
  HOMEWORK
  CHAT_DRILL      // tutor-initiated micro-drill in chat
}

model Attempt {
  id             String           @id @default(cuid())
  userId         String
  source         AttemptSource
  targetId       String           // ExerciseItem.id | SrsCard.id | Homework.id
  vocabEntryId   String?
  grammarTopicId String?          // resolved skill for BKT
  category       GrammarCategory? // denormalized for fast error-by-category metrics
  direction      ReviewDirection?
  isCorrect      Boolean
  grade          Int?             // 0–5 when graded on a scale (SRS), null for binary
  errorTypeJson  Json?            // [{ errorType, token }] for partial credit / analysis
  durationMs     Int?
  attemptedAt    DateTime         @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, attemptedAt])
  @@index([userId, grammarTopicId])
  @@index([userId, category, attemptedAt])
  @@index([userId, isCorrect, attemptedAt])
}
```

Add `attempts Attempt[]` to `User`. (We index by `userId` + denormalize `category`/`grammarTopicId` rather than hard FKs to keep the log write cheap and never block on a deleted topic — the log outlives its referents.)

### 2.2 New: `HomeworkError` — corrections as rows, not a blob

`Homework.correctionsJson` stays as a *derived display cache*; the durable signal becomes rows so "ошибки артиклей падают с марта" is a query, not a reparse.

```prisma
enum HomeworkErrorType {     // mirrors the persona correction contract (layers.ts:24-26)
  KASUS RECHTSCHREIBUNG GENUS NUMERUS WORTSTELLUNG
  VERBKONJUGATION PRAEPOSITION ARTIKEL ZEITFORM SONSTIGES
}

model HomeworkError {
  id             String            @id @default(cuid())
  userId         String
  homeworkId     String
  errorType      HomeworkErrorType
  original       String            @db.Text
  corrected      String            @db.Text
  explanationRu  String            @db.Text
  grammarTopicId String?
  createdAt      DateTime          @default(now())

  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  homework Homework @relation(fields: [homeworkId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt])
  @@index([homeworkId])
}
```

`HomeworkErrorType → GrammarCategory` map (in `lib/learning/error-map.ts`) feeds BKT:
`KASUS→CASE · GENUS→ARTICLE · ARTIKEL→ARTICLE · WORTSTELLUNG→WORD_ORDER · VERBKONJUGATION→VERB_CONJUGATION · PRAEPOSITION→PREPOSITION · ZEITFORM→TENSE · NUMERUS→OTHER · RECHTSCHREIBUNG→OTHER · SONSTIGES→OTHER`.

### 2.3 Changed: `SrsCard` — per-direction cards + FSRS fields + masteryUpdatedAt anchor

```prisma
model SrsCard {
  // ... existing fields ...
  direction    ReviewDirection @default(DE_TO_RU)   // NEW
  // FSRS (Slice 5) — nullable until migration runs:
  stability    Float?                               // NEW
  difficulty   Float?                               // NEW
  // remove:  vocabEntryId String @unique
  // add:
  @@unique([vocabEntryId, direction])               // CHANGED: was @unique on vocabEntryId
  @@index([userId, dueAt])
  @@index([userId, state])
}
```

`GrammarTopic` gets a decay anchor so editing the title doesn't reset decay:

```prisma
model GrammarTopic {
  // ...
  masteryUpdatedAt DateTime @default(now())   // NEW — bumped ONLY by BKT, not by content edits
}
```

`LearnerProfile` gets ELO state (Slice 10), FSRS target, and a rollup freshness stamp:

```prisma
model LearnerProfile {
  // ...
  abilityJson         Json?    // { CASE: 1200, TENSE: 1180, ... } per GrammarCategory (Slice 10)
  desiredRetention    Float    @default(0.9)   // FSRS slider 0.85–0.95 (Slice 5)
  weakAreasComputedAt DateTime?                 // nightly-rollup freshness guard (Slice 8)
}
```

### 2.4 New: `TimelineEvent` — the journal read-model (Slice 4)

```prisma
enum TimelineEventType {
  CARD_MATURED UNIT_COMPLETED HOMEWORK_CORRECTED
  CEFR_CHANGED GOAL_REACHED STREAK_MILESTONE WEAK_AREA_CLEARED
}

model TimelineEvent {
  id          String            @id @default(cuid())
  userId      String
  type        TimelineEventType
  refType     String?
  refId       String?
  payloadJson Json?             // { level, topic, streakDays, ... }
  occurredAt  DateTime          @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, occurredAt])
}
```

CEFR history needs no separate table: a `CEFR_CHANGED` row *is* the history (fixes the spec's "single mutable cefrLevel loses history").

### 2.5 New (Slice 10): `CanDoDescriptor` + `LearnerGoal`

```prisma
model CanDoDescriptor {
  id        String          @id @default(cuid())
  cefrLevel CefrLevel
  category  GrammarCategory?
  textRu    String          @db.Text
  textDe    String?         @db.Text
  goals     LearnerGoal[]
  @@index([cefrLevel])
}
model LearnerGoal {
  id           String   @id @default(cuid())
  userId       String
  descriptorId String
  status       String   @default("active") // active | reached | paused
  reachedAt    DateTime?
  user       User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  descriptor CanDoDescriptor @relation(fields: [descriptorId], references: [id], onDelete: Cascade)
  @@unique([userId, descriptorId])
}
```

### 2.6 pgvector (Slice 9, build-later)

Not configured today (confirmed: no extension, no columns). When the corpus is large: `CREATE EXTENSION vector;` via a raw-SQL migration, add `embedding Unsupported("vector(768)")?` to `VocabEntry`/`GrammarTopic`/`ClassNote`, an IVFFlat index, and an `embed` background feature. **Until then, the deterministic focus-block (§4) + capped `take` is correct** — RAG is the scaling path, not day 1.

### 2.7 Migration & backfill notes

- One migration `phase5_adaptive_loop`. The only non-trivial step is `SrsCard`: drop `@unique(vocabEntryId)`, add `direction` (default `DE_TO_RU`), add `@@unique([vocabEntryId, direction])`. Existing rows backfill to `DE_TO_RU` cleanly (one card each → no collision).
- `masteryUpdatedAt` backfills to `updatedAt`.
- `Attempt`/`HomeworkError` start empty; an optional one-off backfill can replay `ExerciseItem.isCorrect` + `Homework.correctionsJson` into them (nice-to-have, not required for correctness).
- Reconfirm DB on **port 55432** (do not clash with the host's other Postgres on 5432).

---

## 3. The closed loop — `recordAttempt()` (Slice 1, the heart of P0)

One funnel every gradeable surface calls. New module `lib/learning/record-attempt.ts`:

```ts
// Pure-ish service: takes a Prisma tx, returns side-effects to surface in the response.
export async function recordAttempt(tx: Tx, e: {
  userId: string;
  source: AttemptSource;
  targetId: string;
  vocabEntryId?: string;
  grammarTopicId?: string;
  category?: GrammarCategory;
  direction?: ReviewDirection;
  isCorrect: boolean;
  grade?: number;
  errorTypeJson?: unknown;
  durationMs?: number;
}): Promise<{ attemptId: string; masteryBefore?: number; masteryAfter?: number; events: TimelineEventType[] }>
```

What it does, in order, inside the caller's transaction:

1. **Append `Attempt`** (always — the immutable truth).
2. **BKT mastery update** (§3.1) on the resolved `GrammarTopic`: read `masteryScore`, apply correct/wrong update, write `masteryScore` + bump `masteryUpdatedAt`. If no topic resolves (pure vocab item), skip — vocab mastery is the SRS card itself.
3. **Threshold events**: if mastery crosses up through a band → maybe `WEAK_AREA_CLEARED`; SRS maturation handled at the card site (§3.4).

What it deliberately does **not** do: schedule SRS. Scheduling is owned by whoever holds a card. This keeps responsibilities clean and avoids double-shifting.

### Wiring (the three call sites)

| Surface | File | Change |
|---|---|---|
| **Exercise grading** | `app/api/exercises/[id]/grade/route.ts:41-51` | For each answer, after computing `isCorrect`, call `recordAttempt({ source: EXERCISE_ITEM, targetId: item.id, vocabEntryId: item.vocabEntryId, grammarTopicId: set.grammarTopicId, category, isCorrect })` **inside the existing `$transaction`**. Keep the in-place `ExerciseItem.update` (it's the latest-answer cache). **Additionally**, on `isCorrect===false` and a linked `vocabEntryId` with a card → `nudgeCardEarlier()` (§3.4). |
| **SRS review** | `app/api/vocabulary/review/route.ts` POST | The scheduler already owns the schedule + writes `Review`. Add `recordAttempt({ source: SRS_REVIEW, targetId: card.id, vocabEntryId, grade, isCorrect: grade>=3, direction })` for BKT + log + timeline. Do **not** nudge (scheduler already set `dueAt`). |
| **Homework correction Apply** | `lib/ai/propose/apply-db.ts:103-117` (`HOMEWORK_CORRECTION` arm) | When applying the correction, also insert one `HomeworkError` row per mistake, and `recordAttempt({ source: HOMEWORK, targetId: homeworkId, grammarTopicId?, category: map(errorType), isCorrect: false })` per error. Keep writing `correctionsJson`/`errorSummaryJson` as the display cache. |

### 3.1 BKT (Slice 1 mastery math)

`lib/learning/bkt.ts`. Fixed params (no per-skill fit — single learner, sparse data): `G=0.2, S=0.1, T=0.15, L0=0.1`.

```
correct: pLobs = pL*(1-S) / ( pL*(1-S) + (1-pL)*G )
wrong:   pLobs = pL*S     / ( pL*S     + (1-pL)*(1-G) )
next:    pL'   = pLobs + (1-pLobs)*T
masteryScore = clamp(pL', 0, 1)
```

Seed `masteryScore` (currently default `0`) → treat `0` as "unseen" and start BKT from `L0=0.1` on first evidence. **Honest caveat (carry into UI copy):** one learner + rare per-topic attempts = noisy estimate; render as a smoothed *signal/bucket*, never a hard truth (see §4.3 bucketing).

### 3.2 Decay-on-read (Slice 2)

`lib/learning/decay.ts`: `effective = stored * 2^(-Δdays / halfLife)`, `Δdays = (now - masteryUpdatedAt)/DAY`, `halfLife` per `GrammarCategory` (default **30d**; longer for high-repetition/stable topics). Applied wherever mastery is *surfaced or ranked* (focus-block, `formatShared`, nightly rollup) — never written back (decay is a read-time lens; the rollup is what persists recomputed values).

### 3.3 ELO ability-band (Slice 10)

`lib/learning/elo.ts`: `expected = 1/(1+10^((Ritem-Rlearner)/400))`; `Rlearner += K*(actual-expected)`, `K=32`; seed item difficulty from `cefrLevel`+mastery. Stored in `LearnerProfile.abilityJson` per category. Used only to target the generator (§8) at ability±100 — for one learner it's an ability tracker, not crowd difficulty.

### 3.4 Exercise-error → SRS nudge

`lib/learning/nudge.ts`: `nudgeCardEarlier(tx, vocabEntryId, userId)` — for each of the word's per-direction cards in `REVIEW`, pull `dueAt` to `min(dueAt, now + 1d)` and set `state=LAPSED` if it was due far out. This is the "exercise errors and reviews feed one queue" requirement (spec §5.2.2) without letting exercises overwrite the FSRS/SM-2 state — it only *advances* the due date.

---

## 4. Adaptive context — focus-block, decay, grounding (Slice 2, P0)

### 4.1 Focus-block queries (`lib/ai/envelope/from-db.ts`)

Add a `loadFocus(userId)` that joins the existing `Promise.all` (49-55). Uses existing indexes (`@@index([userId, dueAt])`, the new `Attempt` indexes):

```ts
const [dueCards, lapsedCards, weakTopicsRaw, recentErrors] = await Promise.all([
  prisma.srsCard.findMany({ where: { userId, dueAt: { lte: now }, state: { not: 'SUSPENDED' } },
    orderBy: { dueAt: 'asc' }, take: 8, include: { vocabEntry: { select: { lemma:true, translationRu:true } } } }),
  prisma.srsCard.findMany({ where: { userId, lapses: { gt: 1 } },
    orderBy: { lapses: 'desc' }, take: 5, include: { vocabEntry: { select: { lemma:true } } } }),
  prisma.grammarTopic.findMany({ where: { userId }, take: 40 }), // decay+sort in JS (§3.2)
  prisma.attempt.findMany({ where: { userId, isCorrect: false },
    orderBy: { attemptedAt: 'desc' }, take: 10 }),
]);
```

`weakTopics = weakTopicsRaw.map(decay).sort(asc).slice(0,5)`. Then trim the legacy recency lists harder — `vocab take:20`, `grammar` becomes the decayed view — because *freshness now lives in the focus-block*, not in the 60-word dump (`from-db.ts:51-52`).

### 4.2 `formatFocus()` (`lib/ai/envelope/layers.ts`)

New formatter, each item wrapped to preserve the `## DATA VS INSTRUCTIONS` contract:

```
# Focus — what to work on now (computed, not authored)
## К повторению сейчас
- <data type="due_card">Haus — дом</data> · <data type="due_card">gehen — идти</data> …
## Часто забываешь
- <data type="weak_card">Wechselpräpositionen</data> …
## Слабые темы (с учётом забывания)
- <data type="weak_topic">Perfekt mit sein</data> — освежить (decayed ~12%)
## Недавние ошибки
- <data type="recent_error">Kasus: "mit der Hund" → "mit dem Hund"</data> …
```

### 4.3 Caching discipline — the part that's easy to get wrong

The envelope is static→dynamic so the prefix caches (`architecture.md` §"The AI context engine"). Two Phase-5 features threaten that and must be placed/shaped correctly:

- **The focus-block is highly volatile** (changes whenever a card comes due or an error logs). It must sit **after** the cached prefix `01 system · 02 shared · 03 unit`, as a new **Layer 03.5** in the volatile tail next to `04 scope`. **Required edit:** add a `focus: string` field to `EnvelopeData` (in `lib/ai/envelope/builder.ts`) and render it between `unit` and `scope`. Verify the builder's concatenation order when implementing.
- **Decay drifts continuously**, so surfacing a raw decayed percentage in the *cached* `shared` (02) layer would bust CACHE B on every send. Fix: in `formatShared`, render mastery as a **quantized bucket** (`освоено ≥80% · закрепляется 50–80% · учится 20–50% · слабое <20%`) computed from the decayed value. Buckets only flip when a threshold is crossed → byte-stable within a session. The precise "needs refresh" signal lives in the volatile focus-block, where churn is expected.
  - This satisfies acceptance #3: a 90-days-stale 85% topic decays to `0.85·2^(-90/30) ≈ 10.6%` → bucket "слабое / освежить". The unit test asserts the *bucket/label*, not a literal float.

### 4.4 Persona grounding addendum (`SYSTEM_PERSONA`, layers.ts:10-72)

Append a `## GROUNDING` block (still static, so cache-safe) — this is acceptance #4:

```
## GROUNDING — claim only what the data shows
Judge progress ONLY from the Focus and Shared blocks. Never invent or assume
mastery. If asked "how am I doing with X" and X is absent from the data, say you
have no recent signal and offer to practice it — do not fabricate success.
Praise a topic only if its bucket is "освоено/закрепляется" or it is absent from
recent errors. When you reference a mistake, cite the <recent_error> you were given.
```

For the explicit "your progress" summary feature, a cheap verification pass flags unsupported claims (Slice 4, optional).

---

## 5. Retention engine (Slices 5–6, P1)

### 5.1 FSRS swap (Slice 5)
Replace `lib/srs/scheduler.ts` internals with **`ts-fsrs`** (open-source JS port; `npm i ts-fsrs` — needs approval per general-rules "no deps without approval"). Migration is a **recompute, not a schema migration** — `Review` is already an append-only revlog with interval/ease deltas + timing. Steps:
- Add `stability`/`difficulty` to `SrsCard` (§2.3); keep SM-2 columns as legacy/export.
- Map the literal button (Again/Hard/Good/Easy) ↔ existing `grade` 0–5 reversibly (Again=1, Hard=3, Good=4, Easy=5 — already the UI mapping, scheduler.ts:1-4).
- `desiredRetention` slider (0.85–0.95) on profile → FSRS `request_retention`.
- The lapse behavior is the win: FSRS lowers *stability* moderately instead of the brutal `repetitions=0; intervalDays=0` reset (`scheduler.ts:26-41`). **Honest:** the "−20–30% reviews" figure is from simulation; the proven gain is prediction accuracy. Per-user param optimization only after ~1000 reviews; until then global defaults.

### 5.2 Grammar SRS (Slice 6)
`GrammarTopic` gets cards on the **same** engine. Implementation: a polymorphic card via `Attempt`/scheduling is heavier than reusing `SrsCard`; recommended path = add `grammarTopicId String?` to `SrsCard` and relax the vocab FK to optional, OR a thin `GrammarCard` sibling — decide at build time based on how much `SrsCard` logic is vocab-specific (the review queue UI assumes `vocabEntry`). Each review is a **production** task (build/transform a sentence by the rule) with focused corrective feedback (highlight the error *token*, "почти — проверь окончание", invite self-correct), interleaving confusable structures (Perfekt sein/haben).

---

## 6. Progress & journal (Slice 4, P1)

### 6.1 `TimelineEvent` emit points
- `CARD_MATURED` — in the review route when a card crosses `intervalDays>=21`.
- `HOMEWORK_CORRECTED` — in the `HOMEWORK_CORRECTION` Apply arm.
- `UNIT_COMPLETED` — when a unit's exercises/criteria pass (define threshold).
- `CEFR_CHANGED` — whenever `LearnerProfile.cefrLevel` changes (also serves as history).
- `STREAK_MILESTONE` / `WEAK_AREA_CLEARED` — from the nightly rollup (Slice 8).

### 6.2 Derived metrics — `GET /api/progress/stats`
Everything computed from immutable logs, **never authored numbers** (acceptance #5):
- **True retention** = pass-rate (`grade>=3`) of `Review` rows where `prevInterval>=1`, bucketed by month.
- **Mature vs young** = `count(SrsCard.intervalDays>=21)` vs `<21`, by `SrsState`.
- **Words per CEFR** = `groupBy VocabEntry.cefrLevel`.
- **Errors by week × category** = `groupBy Attempt(isCorrect=false)` over week+category (needs §2.1).
- **Volume/speed** = `Review.reviewedAt/durationMs`, `ExerciseSet.score` trend.
Caveat from Anki: daily data is noisy → the UI shows **monthly trends**.

### 6.3 UI
- New `/progress` page: timeline feed (from `TimelineEvent`) + charts (retention curve, errors-by-category-over-time, words-by-CEFR). Use a light chart lib already acceptable in stack, else simple SVG bars (no new dep without approval).
- Enrich `/dashboard` (currently 4 raw counts, `app/(app)/dashboard/page.tsx`) with true-retention + due/mature and a streak chip.

---

## 7. Ownership — export/import (Slices 7 & 10)

- **`GET /api/export?format=json|csv`** (Slice 7, P1): full JSON dump (versioned with `schemaVersion`) + per-entity CSV + a separate **revlog CSV/JSON** from `Review` (rare and valuable — most apps lose review history). German fields map cleanly to Anki note fields.
- **`.apkg`** sub-slice: genuine packaging (sqlite + zip) — isolate as its own task; ship CSV/JSON first.
- **`POST /api/import`** (Slice 10, P2): round-trippable CSV/JSON, idempotent by `[userId, lemma, pos]`.

---

## 8. Pedagogy — production-first generator (Slice 3, P0) + P2 items

**Slice 3 (P0):** change `exercise_generate` so the **default** is production/cloze-in-context, MCQ only as A1/fallback:
- Edit `FEATURE_ADDENDA.exercise_generate` (`layers.ts:76-77`): instruct cloze from `VocabEntry.examplesJson`, RU→DE production, transform tasks; "MCQ only for A1 or after repeated failure."
- Inject an ability/difficulty hint (from §3.3 when Slice 10 lands; until then from `cefrLevel`+bucketed mastery).
- **Client**: lock "показать ответ" behind a typed attempt (the review/exercise runner) — the production effect needs the attempt before reveal. The grade signal then flows through §3 (`recordAttempt`).

**P2:** graded reading (i+1, 95–98% coverage, tap-to-gloss → `Proposal` pipeline) and the CEFR can-do tree (§2.5) as the goal framing.

---

## 9. API surface (new / changed)

| Method · Path | Slice | Notes |
|---|---|---|
| `POST /api/exercises/[id]/grade` | 1 | now also funnels through `recordAttempt` + nudge (body unchanged) |
| `POST /api/vocabulary/review` | 1,5 | adds `recordAttempt`; FSRS fields in response later |
| `GET /api/progress/stats` | 4 | derived metrics (above) |
| `GET /api/progress/timeline?cursor=` | 4 | paginated `TimelineEvent` feed |
| `GET /api/export?format=` | 7 | json/csv (+ revlog) |
| `POST /api/import` | 10 | round-trip |
| `GET /api/crons/rollup` | 8 | `x-cron-secret` like `crons/cleanup` |
| `PATCH /api/profile` | 5 | add `desiredRetention` |

All follow the existing envelope (`successResponse`/`handleApiError`), guards (`requireUser` → ownership), zod-at-boundary conventions.

## 10. UI surface (new / changed)

- `/progress` (new) — timeline + monthly charts.
- `/dashboard` (enrich) — retention, mature/young, streak chip.
- Review/exercise runner (change) — reveal-locked-behind-attempt; production input field; per-direction card label.
- Settings (change) — desired-retention slider; export button.
- Assistant focus surfacing (optional) — show the focus-block items as quick-drill chips in the dock.

## 11. Module layout (new files)

```
lib/learning/
  record-attempt.ts   // the funnel (§3)
  bkt.ts              // §3.1
  decay.ts            // §3.2
  elo.ts              // §3.3 (Slice 10)
  nudge.ts            // §3.4
  error-map.ts        // HomeworkErrorType → GrammarCategory
  metrics.ts          // §6.2 derived queries
  timeline.ts         // emit helpers (§6.1)
lib/ai/envelope/
  from-db.ts          // + loadFocus (§4.1)
  layers.ts           // + formatFocus, formatShared bucketing, persona GROUNDING (§4)
  builder.ts          // + focus slot (§4.3)
lib/srs/scheduler.ts  // → ts-fsrs (Slice 5)
lib/export/           // json/csv/apkg writers (Slice 7)
app/api/progress/     // stats + timeline
app/api/crons/rollup/ // §8
app/(app)/progress/   // UI
```

## 12. Seed / feature-flag additions

- `progress_summary` — background feature (`isBackground:true`, `skipRateLimit:true`, model `gemini-2.5-flash-lite` like `thread_summarize`) for the optional nightly progress note. Add to `prisma/seed.ts` features block (currently 6 slugs).
- (P2) `graded_reading` feature.
- `CRON_SECRET` already used by `crons/cleanup`; reuse for `crons/rollup`. Document the external scheduler hitting it.

---

## 13. Edge cases (spec-first block 6)

| Case | Behavior |
|---|---|
| No attempts yet | BKT stays at `L0`; focus-block renders "пока нечего повторять — начни упражнение/добавь слова"; metrics show empty states. |
| Sparse per-topic data | BKT treated as smoothed signal; UI copy avoids false precision; buckets, not decimals. |
| Concurrent grading of same topic | `Attempt` is append-only (no conflict). BKT snapshot is a read-modify-write inside the grade tx; last-writer wins on the *cache* — truth is the log, and the nightly rollup reconciles. |
| Decay drift busting cache | Bucketed mastery in cached `shared`; precise decayed values only in volatile focus-block (§4.3). |
| Streak day boundary | No stored tz → use UTC day for v1; note it; revisit when tz is stored. |
| FSRS with <1000 reviews | Global default params; per-user optimization gated behind a review-count threshold. |
| Cron didn't run (stale `weakAreasComputedAt` >24h) | Focus-block falls back to live error counts instead of the cached rollup. |
| Card-error vs review-error double count | Review path schedules (owns `dueAt`); exercise path only *nudges earlier* (§3.4) — never both schedule. |
| Large deck export | Stream/paginate the CSV/JSON writer. |
| Deleted topic referenced by old `Attempt` | Log keeps denormalized `category` + nullable `grammarTopicId`; analytics survive deletion. |

---

## 14. Test plan (mapped to [[phase-5-adaptive-learning-loop]] §Acceptance)

**Unit (vitest):**
- `bkt.ts` — correct/wrong updates move `p(L)` in the right direction; converges with repeated correct (acceptance #1 math).
- `decay.ts` + `formatShared` — 90-days-stale 85% → bucket "слабое/освежить" (acceptance #3).
- `scheduler` FSRS vs SM-2 on a fixed `Review` log — FSRS lapse keeps residual interval, SM-2 resets to ~0 (acceptance #6).
- `metrics.ts` — true-retention/mature counts recomputed from seeded `Review`/`Attempt` equal expected; assert no number is read from a snapshot field (acceptance #5).
- `formatFocus` — a seeded stale-but-weak topic appears in focus and NOT in the recency list (acceptance #2).

**Integration / e2e (Playwright):**
- **The loop (acceptance #1):** seed a `TENSE` exercise → submit a wrong answer → assert in DB: (a) `Attempt(isCorrect=false)` exists, (b) topic `masteryScore` dropped, (c) the linked `SrsCard.dueAt` moved earlier, (d) the next assembled envelope (call the chat endpoint) contains a `<recent_error>` for that topic. The chat reply references it.
- **Production-first (acceptance #9):** generate a set for an intermediate level → assert no `MCQ` items by default; reveal locked until an attempt is submitted.
- **Export (acceptance #8):** export → import into a clean Anki (or a parser fixture) → cards + revlog readable.

**Explicitly NOT an acceptance criterion (honesty, carried from the spec):** measurable *learning-outcome* gains. The base evidence ("KT+RAG over an LLM tutor improves outcomes") is thin (TutorLLM n=30, +5% non-significant). We verify **relevance, freshness, grounding, portability** — provable now — and leave outcome claims to an in-app A/B.

---

## 15. Vault updates this design implies

- **ADR created:** [[Loop-записи-обходят-propose-Apply-это-derived-state]] (§0).
- Decay caching discipline (§4.3 — decay lives in the volatile focus-block, mastery is bucketed in the cached shared layer) is documented inline here + in `lib/learning/decay.ts`; not split into its own ADR.
- On build: update `vault/atlas/database.md` (new models), `vault/api/_changelog.md` + per-module API docs, `vault/atlas/dependency-graph.md` (`lib/learning/*`), and flip [[mvp-scope-and-phases]] Phase 5 status.
- Anything deferred from a slice → `vault/knowledge/business/post-mvp-backlog.md`.

## 16. Risks & honest calls

- **Most leverage, least cost:** Slices 1–2 (close the loop + decay + focus). Do these first; they deliver the headline "ИИ реально знает, что я учу" with no new deps and low risk.
- **`ts-fsrs` + `.apkg`** are the only pieces needing a dependency / real packaging effort → isolated, approval-gated.
- **RAG (Slice 9)** is deliberately last and conditional — building it before the corpus is large is premature optimization.
- **BKT/ELO are single-learner noisy** — shipped as smoothed signals feeding context + UI buckets, never as authoritative scores. This is stated in copy and tests.

---

## Build order (one line)

`Slice 0 (schema) → 1 (loop) → 2 (focus+decay+grounding) → 3 (production-first)` = **P0 closed loop, demoable** → then P1 `4 (progress) · 5 (FSRS) · 6 (grammar SRS) · 7 (export) · 8 (rollup) · 9 (RAG)` → P2 `10 (ELO/streaks/import/reading/CEFR)`.
