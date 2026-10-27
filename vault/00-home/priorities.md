---
tags: [home, priorities]
date: 2026-06-13
---

# Current Priorities

## Done (all verified live)
- ✅ **Phase 1 - AI layer** (`lib/ai`): 5-layer envelope, Gemini provider, propose/Apply, sanitize.
- ✅ **Phase 2 - Backend**: Prisma + Auth.js v5, guards, DB-backed orchestrator, route handlers, admin API, seed.
- ✅ **Phase 3 - Frontend**: PWA shell, auth, dashboard, vocab+SRS, homework, grammar/exercises/notes, Assistant Dock + Proposal cards, admin UI.
- ✅ **Phase 4 - Polish**: TTS, vision homework, thread reload, i18n ru/en + switcher, prompt-editor, Playwright E2E.
- ✅ **Phase 6/7 - Design**: gently-muted theme (Nunito, colored cards, streak) + centered Google-style assistant.
- ✅ **Phase 5 - Adaptive Learning Loop** (Slices 0-8): closed loop (error→`Attempt`→BKT→focus-block→tutor), decay-on-read + grounding, production-first exercises, progress/journal (`/progress`), per-direction SRS incl. reverse translation, **FSRS** (`ts-fsrs`), grammar SRS, export (JSON/CSV), nightly rollup (`crons/rollup`). Build log: [[phase-5-implementation-plan]].
- ✅ **Polish batch**: grammar-due on dashboard, desired-retention slider (`/api/profile`), weekly-note→flash, i18n of `[id]` detail pages.
- ✅ **PWA offline**: cached SRS review (service worker) + IndexedDB write outbox synced on reconnect - [[PWA-офлайн-SW-кэширует-чтения-IndexedDB-outbox-копит-записи]].

See [[mvp-scope-and-phases]] for per-phase detail + verification evidence.

## Next (future iterations)
- 🔜 **Import** - round-trip to the export (CSV/JSON, idempotent by `[userId, lemma, pos]`).
- 🔜 **CEFR can-do goals + graded reading** (i+1, tap-to-gloss → proposal pipeline).
- 🔜 **RAG / pgvector** - deferred by design until the corpus is large; the deterministic focus-block is correct until then.
- 🔜 **Prod deploy** - secrets as host env vars (not `.env`); rotate the Gemini key; real `build && start`.

## Backlog
- [[post-mvp-backlog]] - admin features/routing UI, DB prompt templates into the orchestrator, analytics, PNG/maskable icons, push/streak reminders, `.apkg`, rollup 30d-active bound.

## Notes
- **Run locally:** `npm run local` (Postgres on :55432 → migrate → seed → `next dev`). Manual steps in [[mvp-scope-and-phases]] / `CLAUDE.md`.
- `.env` (gitignored) holds `GEMINI_API_KEY`, `AUTH_SECRET`, and the generated `CRON_SECRET` / `ENCRYPTION_KEY` / `AI_SERVICE_TOKEN`. Admin seed: `admin@lla.local` / `admin12345`.
- **PWA offline only activates in a production build** (`build && start`) - the service worker is not registered in `next dev` by design.
