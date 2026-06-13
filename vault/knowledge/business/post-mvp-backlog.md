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
- Spaced-repetition for grammar rules (not just vocab).
- Goethe/TELC exam-prep mode (timed mock tests).

## Related
- [[mvp-scope-and-phases]] · `PLAN.md` §7 Phase 4
