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

## [Unreleased]
- Phase 5 adaptive-loop endpoints (mastery rollups, export/import) — see [[phase-5-adaptive-learning-loop]].
