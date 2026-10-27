---
tags: [atlas, architecture, ai, context-engine]
date: 2026-06-13
---

# System Architecture

## Overview
LanguageLearnAssistant is a single **Next.js (App Router, TypeScript)** application that is, at once, the React frontend, the backend (Route Handlers), and an AI library. It is an AI tutor for a Russian speaker learning German. The design ports ToonyGamy's AI **context engine** (the part the owner praised) to TypeScript - see `PLAN.md` for the full blueprint and [[5-слойный-context-engine-портирован-из-ToonyGamy]] for the decision.

The spine of the system is one invariant: **Postgres is the memory; the chat is just a desk.** Every AI call rebuilds a 5-layer prompt envelope from the database - never from chat history - and the only way the model changes the database is by emitting a `propose` card that the user must **Apply**.

## Layers (outside-in)

```
┌─ app/(public)         landing / login / register
├─ app/(app)            authed shell: rail + topbar + RightPanel + Assistant Dock
├─ app/admin            role-gated admin (prompts, providers, usage, rate-limits, …)
│
├─ app/api/*            Route Handlers (the "backend")
│    auth, domain CRUD (vocab/grammar/homework/notes/exercises),
│    ai/chat (SSE), proposals/[id]/apply|refine|discard, admin/*, crons/*
│
├─ lib/ai/*             the AI context engine (framework-agnostic TS)
│    envelope/ (builder, layers, context-manager, caps, sanitize)
│    providers/ (base, gemini, gemini-cache, registry)
│    propose/ (tool, persist, dispatch)   prompts/ thread/ features/ guards/ usage/
│    orchestrator.ts - executeCompletion() 7-step flow
│
├─ lib/db, lib/auth, lib/api    Prisma client, Auth.js + guards, response envelope
└─ prisma/schema.prisma         single source of truth (see [[database]])
```

## The AI context engine (5-layer envelope)
Static → dynamic, so the cacheable prefix is byte-stable across a thread's turns. Gemini has no per-message system slot: layer 01 → `systemInstruction`; 02-05 fold into the leading cacheable `user` turn; recent turns are real `user`/`model`; the new message trails.

```
01 system        persona (German tutor, reply in Russian), rules, output contract   [CACHE A]
02 shared        learner profile + vocab mastery + grammar mastery (derived, capped) [CACHE B]
03 current unit  active lesson / homework premise (source of truth, capped)          [CACHE C]
04 scope object  exactly what the chat chip points at (+ feature mode addendum)
05 thread        rolling summary (system note) + last N verbatim turns
06 user message  the only un-wrapped user text (it IS the instruction)
```

- **Injection defense:** every user-authored field is `sanitize()`d (NFKC → strip control → escape `& < >` → trim, *in that order*) and wrapped in `<data type="…">…</data>`. The system prompt declares `<data>` contents inert.
- **Caps** are measured in characters (deterministic). Every layer is optional/tolerant (silent-trim, never reject).
- **Scopes:** one chat thread per object (`GLOBAL | COURSE | UNIT | VOCAB_ENTRY | VOCAB_LIST | GRAMMAR_TOPIC | HOMEWORK | CLASS_NOTE | EXERCISE_SET`). Thread auto-summarizes past a watermark via a background, non-billed call.

## Write path - propose / Apply (the model is never a writer)
1. The model calls one polymorphic `propose(target_type, op, target_id?, summary, payload)` tool.
2. The server zod-validates the payload and persists a `Proposal` row (`PENDING`) → emits a card over SSE.
3. The user clicks **Apply** → the Apply dispatcher (sole writer, ownership-checked, idempotent) distills the payload into typed rows (`VocabEntry`, `GrammarTopic`, `Homework.correctionsJson`, `ExerciseSet`+items, …).
4. The applied write re-aggregates into layers 02/03 on the next send - closing the "DB is the memory" loop. **Refine** supersedes + re-runs; **Discard** drops it. Neither writes the target.

## Orchestrator - `executeCompletion()` (7 steps, every AI feature)
`abuse → resolve prompt template → rate-limit → daily budget → route to provider/model → build request from DB → call provider → log usage`. Guards run cheapest-first. Background ops set `isBackground` **and** `skipRateLimit` and never bill.

## Providers
`Provider` interface (`complete/stream/countTokens/healthCheck`). `GeminiProvider` talks v1beta REST (`x-goog-api-key`, `:generateContent` / `:streamGenerateContent?alt=sse` / `:countTokens`), maps reasoning effort → thinking budget, handles vision (`inline_data`), forwards finish reasons, and fail-soft strips cache markers if a future provider rejects them. A DB-driven `registry` decrypts keys and routes by feature (`ModelRouting` priority, skip unhealthy).

## Auth & Admin
Auth.js v5, JWT session (role/tier in the token → middleware gates without a DB hit). Defense in depth: `middleware.ts` (locale → auth → admin gate) **plus** server guards (`requireUser/requireAdmin/requireOwner/requireServiceToken`) re-checked in every handler. Admin panel manages the AI infra (prompts/versions, providers/keys, model routing, feature flags, usage, rate-limits, users, playground, abuse moderation).

## Modules / data flow
`React UI → Route Handler (guard + zod) → service → Prisma`. AI: `Assistant Dock → POST /api/ai/chat (SSE) → orchestrator → envelope(from DB) → Gemini → tokens + proposal events → ChatMessage/Proposal rows`. SRS: `review UI → POST /api/vocabulary/review → SM-2 scheduler → SrsCard.dueAt`.

## Related
- [[stack]] · [[database]] · [[conventions]] · [[dependency-graph]]
- [[mvp-scope-and-phases]] · [[post-mvp-backlog]]
- [[Записи-это-proposals-единственный-путь-записи-Apply]] · [[5-слойный-context-engine-портирован-из-ToonyGamy]]
