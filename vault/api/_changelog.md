---
tags: [api, changelog]
date: 2026-06-13
---

# API Changelog

All routes follow the `{ code, message, data }` envelope. Auth via Auth.js v5 session; mutations are owner-checked; admin routes require `role=ADMIN`. SSE for streaming chat.

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
