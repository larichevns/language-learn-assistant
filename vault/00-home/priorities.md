---
tags: [home, priorities]
date: 2026-06-13
---

# Current Priorities

## Done (MVP + polish, all verified)
- ✅ **Phase 1 — AI layer** (`lib/ai`): 5-layer envelope, Gemini provider, propose/Apply, sanitize, 21 unit tests.
- ✅ **Phase 2 — Backend**: Prisma schema + migration, Auth.js v5, guards, DB-backed orchestrator, 41 route handlers, admin API, seed, `verify-backend`.
- ✅ **Phase 3 — Frontend**: PWA shell, auth, dashboard, vocab+SRS, homework, grammar/exercises/notes, Assistant Dock + Proposal cards, admin UI (9 sections).
- ✅ **Phase 4 — Polish**: TTS pronunciation, vision homework, thread reload, i18n ru/en + switcher, prompt-editor, Playwright E2E (5 specs green).

See [[mvp-scope-and-phases]] for per-phase detail + verification evidence.

## Next
- 🔜 **Phase 5 — Adaptive Learning Loop & Retention** — [[phase-5-adaptive-learning-loop]]. Close the feedback loops so the tutor truly adapts to what the learner is studying (error-driven review, mastery rollups, FSRS, progress journal, export). This is where the *learning* gets good, not just the plumbing.

## Backlog
- [[post-mvp-backlog]] — deferred items (offline PWA, detail-page i18n, more providers, analytics, …).

## Notes
- Local dev: Postgres in Docker on **:55432** (5432 was taken); `.env` holds `GEMINI_API_KEY` + `AUTH_SECRET` (gitignored). Admin: `admin@lla.local` / `admin12345`.
