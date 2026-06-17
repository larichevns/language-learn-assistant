---
tags: [atlas, dependency-graph]
date: 2026-06-13
---

# Dependency Graph
<!-- Updated: 2026-06-17 | collection-grouping: components/groups/*, app/api/groups/**, lib/api/collection-groups; removed vocab-groups + app/api/vocabulary/groups -->

Coarse module dependencies (arrows = "depends on / imports").

```
app/(app) UI ─┐
app/admin UI ─┼─→ app/api/* (Route Handlers) ─→ lib/api (response, guards)
              │                                  ├─→ lib/auth (Auth.js, requireUser/Owner/Admin)
              │                                  ├─→ lib/db (Prisma client)
              │                                  └─→ lib/ai/orchestrator ─→ lib/ai/{envelope, providers, propose, prompts, thread, features, guards, usage}
components/* ─┘                                                            └─→ lib/db (envelope rebuilt FROM DB)

# Phase 5 adaptive loop:
app/api/{exercises/[id]/grade, vocabulary/review, grammar/review} ─→ lib/learning (record-attempt→bkt · nudge · timeline · metrics) ─→ lib/db
                                                                   └─→ lib/srs/scheduler (FSRS via ts-fsrs)        [review routes]
lib/ai/propose/apply-db ─→ lib/learning (homework errors→recordAttempt · timeline) + auto-enroll SrsCard/GrammarCard
app/(app)/progress ─→ app/api/progress/{stats,timeline} ─→ lib/learning/metrics (all derived from Review/Attempt/SrsCard logs)
app/api/crons/rollup ─→ lib/learning/rollup ─→ {metrics, decay, error-map, timeline} + lib/ai/orchestrator (background weekly note, never billed)

# Collection grouping (2026-06-17 — generalizes vocab-grouping to all domains):
app/(app)/{vocabulary,grammar,notes} ─→ components/groups/* (GroupedAccordion · use-collapse · group-dialogs · types) ─→ app/api/groups/** (GET/POST · [id] PATCH/DELETE) ─→ lib/api/collection-groups (DTOs + domain maps + normGroupName) ─→ lib/db
components/{grammar/grammar-topic-card, notes/note-card} ─→ components/groups/types          # leaf render-props for the generic accordion
lib/ai/propose/apply-db ─→ resolveGroupId(tx,userId,domain,p) ─→ lib/api/collection-groups (normGroupName) + lib/db (CollectionGroup, domain-scoped create-or-reuse)
lib/ai/envelope/{from-db,layers,caps} ─→ per-domain group block (## Vocabulary/Grammar/Note groups, {g:id}, CAPS.GROUPS)
app/(app)/{homework,exercises} ─→ DERIVED presentational buckets (status / linked grammarTopic) — NO groups API, NO CollectionGroup rows
# REMOVED in this change: lib/api/vocab-groups (→ collection-groups) · app/api/vocabulary/groups/** (→ /api/groups?domain=VOCAB) · components/vocabulary/{group-section,group-dialogs,use-vocab-collapse,types,group-actions} (→ components/groups/*).
# See [[Одна-CollectionGroup-с-доменом-VOCAB-GRAMMAR-NOTE-VocabGroup-свёрнута-rename-миграцией]] · [[groups]] · [[collection-grouping]].

# PWA offline:
public/sw.js (caches reads) ‖ app/(app)/{vocabulary,grammar}/review ─→ lib/offline/outbox (postOrQueue) ─→ IndexedDB; components/offline-sync (flush on reconnect) mounted in app/(app)/layout. See [[PWA-офлайн-SW-кэширует-чтения-IndexedDB-outbox-копит-записи]].

lib/ai is framework-agnostic: depends only on lib/db (for envelope assembly + persistence) and Node `crypto`/`fetch`.
Phase 1 ran lib/ai against JSON seed data with NO lib/db dependency (a pluggable store).
```

## Blast-radius notes
- Changing the **envelope layer order** affects prefix-cache hit rate, not correctness — but re-check `caps` and the cache boundary marks.
- Changing a **propose payload shape** requires: zod schema (`propose/persist`) + applier (`propose/dispatch`) + the prompt template that teaches the model + any UI that renders the card. Keep them in sync.
- `prisma/schema.prisma` is upstream of nearly everything — schema changes ripple to services, AI appliers, and admin.
- **SRS is per-direction** (`@@unique([vocabEntryId, direction])`): `VocabEntry.srsCards[]` is a LIST — anything reading it must handle multiple cards; the review UI is direction-aware (DE→RU, RU→DE, PRODUCE_ARTICLE/PLURAL).
- **FSRS scheduling** lives in `lib/srs/scheduler.ts` (ts-fsrs); shared by vocab + grammar reviews. The `Review` log is the raw revlog kept for future per-user optimization.
- **Loop writes bypass propose/Apply**: `recordAttempt` / FSRS / BKT / timeline are deterministic state written from the learner's OWN grade actions — not model proposals. The model stays a non-writer.

## Related
- [[architecture]]
