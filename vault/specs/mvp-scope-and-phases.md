---
tags: [spec, mvp, phases, scope]
date: 2026-06-13
status: approved
source: PLAN.md (full blueprint)
---

# MVP Scope & Phases

Authoritative scope decisions for LanguageLearnAssistant. The detailed architecture/Prisma/AI design lives in `PLAN.md`; this note records **what we build first, in what order, and when each phase is done.**

## Approved decisions (2026-06-13)
- **Hero of the first usable version:** Tutor **chat + vocabulary/SRS + homework correction**. This is the daily loop that solves the owner's actual pain ("no good AI tool to actually learn the language").
- **Everything else is built but secondary**, or deferred — see [[post-mvp-backlog]]. Nothing is dropped silently.
- **Dev infra:** local Docker Postgres + in-memory rate-limit/cache → [[Локальная-инфра-Docker-Postgres-плюс-in-memory-guards]].
- **Theme:** calm "study" indigo/teal, dark+light → [[Тема-UI-спокойная-индиго-бирюза]].
- **i18n from day one**, default Russian → [[i18n-с-первого-дня-дефолт-русский]].
- **Auth:** Auth.js v5, Google + email/password, roles user/admin.
- **One Next.js app** (no separate Python AI service) → [[Один-Next.js-проект-вместо-отдельного-AI-сервиса]].

## Hero loop (what "usable for the owner" means)
1. Add/learn German words (with der/die/das, Plural, verb forms) → SRS review.
2. Paste/snap homework → AI structures it and corrects it, explaining each mistake in Russian, as **Apply-able** proposals.
3. Chat with a context-aware tutor that already knows the learner's level, words, and weak spots.

## Phases (max 3 + optional polish)

### Phase 1 — AI layer (provable via CLI against Gemini free tier, no DB/UI) — ✅ DONE (verified 2026-06-13)
`lib/ai`: 5-layer envelope from seed data, Gemini provider (stream + non-stream), `propose` tool, Apply distillation, sanitize, caps, prompt loader, CLI harness, vitest. **Done when** `npx tsx scripts/ai-cli.ts chat "…"` streams a real German answer and `propose`→`apply` yields correct DB-shaped fields; injection neutralized; tests green. Full task list: `PLAN.md` §7 Phase 1.

**Verification evidence:** 17/17 vitest green; `tsc --noEmit` clean; `ai-cli health` → Gemini reachable; `ai-cli chat` streams Russian-with-German tutoring; `ai-cli propose "добавь слово aufstehen"` auto-enriched a full verb card (sein/Partizip II/Präteritum/level/tags/examples) and distilled it through the zod schema; `ai-cli summarize` ran the cheap background model (marked not-billed). The agentic auto-enrich behavior is enforced in `SYSTEM_PERSONA` — see [[ИИ-дообогащает-и-сам-раскладывает-из-краткой-команды]].
Known prompt-tuning follow-ups (not blockers): emit `op=UPDATE`+target_id when a word already exists in context; always include `isSeparable`/`separablePrefix` for separable verbs.

### Phase 2 — Backend (Prisma + Auth + CRUD + AI routes + Admin API + guards) — ✅ DONE (2026-06-13)
Schema + migrations, Auth.js, guards (`requireUser/Owner/Admin/ServiceToken`), DB-backed AI guards (abuse/rate/cost/usage/registry), orchestrator, AI routes (`/api/ai/chat` SSE, summarize, proposals apply/refine/discard), domain CRUD (vocab+review/grammar/homework+correct/notes/exercises), admin API, cron cleanup, seed. **Done when** login works, `/api/ai/chat` streams from a **DB-rebuilt** envelope, propose→apply persists a real `VocabEntry`, cross-user=403 / over-budget=402 / rate-limited=429 / injection=400+`AbuseEvent`, every AI call logs a `UsageEvent`, SRS grade reschedules. `PLAN.md` §7 Phase 2.

**Done & verified:** migration applied; Auth.js v5 split-config (credentials+Google, JWT role/tier) + `/api/auth/register`; guards + middleware; API response envelope; encryption (aes-256-gcm); DB provider registry + `executeCompletion`/`streamCompletion` (7-step guards) + usage tracker + abuse/rate/cost guards; **envelope rebuilt from Postgres**; propose `persist` + Apply dispatcher (transaction, all 9 target appliers, owner-checked, 409 on double-apply, **auto-SRS enrollment** on vocab); routes `/api/ai/chat` (SSE), `/api/threads/[id]/summarize`, `/api/proposals/[id]/{apply,refine,discard}`; hero CRUD `/api/vocabulary` (+`[id]`,+`review` SM-2), `/api/homework` (+`[id]`,+`correct`); `prisma/seed.ts` (provider/models/routing/features/rate-limits/admin/sample). Verified: 21 unit tests, `tsc` clean, **`next build` passes** (15 routes + middleware), `scripts/verify-backend.ts` runs propose→apply offline (+409) AND full Gemini path (chat → propose → apply → `VocabEntry` "der Löffel" + auto SRS), usage logged. zod rejected a bad model `gender:"MASCULINE"` → added a coercion preprocess (der/die/das).

**Now also done (full Phase 2):** Grammar/Notes/Exercises CRUD + `exercise_generate`/`grade` + `grammar_explain`; full Admin API — prompts (CRUD + activate-with-deactivate + diff-ready), variables (CRUD + ref-guard), providers (CRUD + encrypted key + `/test` health + `/refresh-models`), features (CRUD + `/routing` PUT), usage dashboard (groupBy/aggregate), rate-limits (GET/PUT), users (list/search + role/tier PATCH, self-demote guard), playground (run feature, skip rate-limit), moderation (AbuseEvent feed); cron `/api/crons/cleanup` (CRON_SECRET). **41 route handlers**, `next build` green, `tsc` clean, 21 tests.

**Deferred to Phase 3 (need UI/infra):** vision (image) homework correction — needs upload handling; HTTP/SSE E2E — with the Phase-3 UI + login. Admin prompt templates exist in DB but the orchestrator still uses the code `SYSTEM_PERSONA`; wiring DB templates into the envelope is a Phase-3/4 toggle.

### Phase 3 — Frontend (PWA shell + hero UIs + Assistant Dock + Admin UI) — 🟦 HERO DONE & browser-verified (2026-06-13)
Design system (indigo/teal), PWA (manifest/SW/offline SRS/install), shells, auth pages, dashboard, **Vocabulary + SRS review**, **Homework correction**, **Assistant Dock + Proposal cards** (hero), then grammar/exercises/notes, admin UI, a11y + i18n pass, Playwright E2E. **Done when** installable PWA opens offline, the chat→propose→Apply→review loop works end-to-end, homework photo → structured correction, admin UI drives all Phase-2 APIs. `PLAN.md` §7 Phase 3.

**Done & browser-verified:** UI primitives (Button/Card/Input/Badge/Spinner via CVA + theme tokens), SessionProvider, client API + SSE chat consumer, dock store. Auth pages (login/register, credentials + Google). Auth-gated app shell (sidebar + topbar + theme toggle + account menu). Dashboard (live stats from DB). **Vocabulary list + add + SRS review session (flip + 4-grade SM-2)**. **Homework intake + AI correct (proposal cards + applied corrections view)**. **Assistant Dock** (pill↔window, scope chip, streaming markdown, Proposal cards Apply/Refine/Discard wired to `/api/proposals/*`, invalidates queries on Apply). PWA (manifest, SW + registrar, install-ready, SVG icon). Navigable stubs: grammar/exercises/notes/settings/admin. `tsc` clean, `next build` green (all pages+routes+middleware). **Live browser run:** login → dashboard → open Assistant → «добавь слово der Apfel» → streamed reply + Proposal → Apply → `der Apfel` (auto plural `die Äpfel`, auto-SRS «к повторению») appears on the vocab page (6 words). Set `AUTH_SECRET` in `.env`; DB on :55432.

**Phase 3 finish (done 2026-06-13):** full **grammar** (list + detail with markdown/examples/pitfalls + mastery bar), **notes** (list/create + detail with structured view), **exercises** (list + generate-via-proposals + take/auto-grade quiz) screens — stubs replaced. **Mobile drawer** (shared nav-items, hamburger + slide-in). **Per-object scope wiring** (`useScope` sets the dock scope on grammar/notes detail). **Admin UI** (admin layout + sub-nav + server role re-check): overview (live usage), usage detail (by-model + errors), providers (test + refresh-models), users (role/tier), rate-limits (editable), prompts (activate), playground (run feature + tools), moderation (abuse feed). `tsc` clean, `next build` green (42 pages), admin verified live in browser.
Caution learned: never run `next build` while `next dev` is live — it desyncs `.next` and throws "Cannot find module" at runtime; restart dev after a build.

### Phase 4 — polish (in progress)
**Done (2026-06-13):** **TTS pronunciation** — `SpeakButton` (Web Speech API, de-DE) on vocab cards, SRS review front, grammar examples. **Vision homework** — photo upload on the intake form (data URL), `Homework.source=IMAGE`/`imageUrl`; orchestrator threads `images` onto the final user message; `/api/homework/[id]/correct` decodes the photo and sends it to Gemini vision; detail page shows the photo. `tsc` clean, `next build` green (42 pages), homework photo-upload UI verified in browser.

**Also done (2026-06-13, batch 2):** **Thread reload-on-open** — `GET /api/threads/resolve` returns recent turns + pending proposals; dock reloads them on open/scope change (history survives reload). **i18n externalization + en** — `messages/{ru,en}.json` cover all namespaces; refactored chrome (nav/topbar), auth, dashboard, assistant dock, proposal card, and all learner list screens (vocab/review/homework/grammar/exercises/notes) to `useTranslations`/`getTranslations`; **Settings = working language switcher** (cookie `lla_locale` + reload). Verified live: switching to English flips the whole UI (sidebar/topbar/dashboard), switch back to ru works. `tsc` clean, `next build` green (43 pages).

**Also done (2026-06-13, batch 3):** admin **prompt-editor** (`/admin/prompts`): create/edit/activate/delete templates, **variables** CRUD (chips + add/delete), and a **side-by-side diff** vs the active version. **Playwright E2E** (`playwright.config.ts` + `e2e/smoke.spec.ts`, `chromium` installed): 5 specs green — login→dashboard, add-vocab→appears, SRS review loads, admin loads, language switch flips UI. `next build` green (43 pages).

**Remaining (Phase 4 / post-MVP):** admin features/routing UI; wiring DB prompt templates into the orchestrator; import, analytics, more providers — see [[post-mvp-backlog]]. *(Done since: i18n of the `[id]` detail pages, FSRS, export (Anki/CSV), and **full PWA offline** (cached SRS review + IndexedDB write outbox) — shipped in Phase 5 + the polish/offline batch. See [[PWA-офлайн-SW-кэширует-чтения-IndexedDB-outbox-копит-записи]].)*

### Phase 4 — Optional polish
See [[post-mvp-backlog]].

## Post-MVP phases (5–7) — added after the MVP
These extend the shipped MVP; each has its own spec. Status as of 2026-06-13:
- **Phase 5 — Adaptive Learning Loop & Retention** — 🟦 in progress (Slices 0–8 + deferred shipped). Closed loop (error→`Attempt`→BKT mastery→focus-block→tutor), decay-on-read + grounding, production-first, progress/journal (`/progress`), per-direction SRS (incl. reverse translation), **FSRS** (ts-fsrs), grammar-SRS, **export** (JSON/CSV), **nightly rollup** (`crons/rollup` → derived weak-areas + milestones + weekly note). Remaining: RAG (deferred-by-design until corpus is large) · ELO/streaks/import/reading/CEFR-goals. Spec: [[phase-5-adaptive-learning-loop]]; build plan + live-verification log: [[phase-5-implementation-plan]].
- **Phase 6 — Design directions** — ✅ done (market research + 3 directions + wireframes). [[phase-6-design-directions]].
- **Phase 7 — Design implementation** — ✅ done (Direction B gently-muted + centered Google-style assistant; ui-tester verified). [[phase-7-design-implementation]].

## Cross-cutting invariants (every phase)
Envelope rebuilt from DB each send · all user text `sanitize()`+`<data>`-wrapped · writes are proposals only · background ops `isBackground`+`skipRateLimit`, never billed · guards abuse→rate→budget→route→execute→log · ownership before service, admin re-checked server-side · caps silent-trim.

## Related
- [[architecture]] · [[post-mvp-backlog]] · `PLAN.md`
