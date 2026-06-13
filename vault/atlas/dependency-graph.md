---
tags: [atlas, dependency-graph]
date: 2026-06-13
---

# Dependency Graph

Coarse module dependencies (arrows = "depends on / imports").

```
app/(app) UI ─┐
app/admin UI ─┼─→ app/api/* (Route Handlers) ─→ lib/api (response, guards)
              │                                  ├─→ lib/auth (Auth.js, requireUser/Owner/Admin)
              │                                  ├─→ lib/db (Prisma client)
              │                                  └─→ lib/ai/orchestrator ─→ lib/ai/{envelope, providers, propose, prompts, thread, features, guards, usage}
components/* ─┘                                                            └─→ lib/db (envelope rebuilt FROM DB)

lib/ai is framework-agnostic: depends only on lib/db (for envelope assembly + persistence) and Node `crypto`/`fetch`.
Phase 1 ran lib/ai against JSON seed data with NO lib/db dependency (a pluggable store).
```

## Blast-radius notes
- Changing the **envelope layer order** affects prefix-cache hit rate, not correctness — but re-check `caps` and the cache boundary marks.
- Changing a **propose payload shape** requires: zod schema (`propose/persist`) + applier (`propose/dispatch`) + the prompt template that teaches the model + any UI that renders the card. Keep them in sync.
- `prisma/schema.prisma` is upstream of nearly everything — schema changes ripple to services, AI appliers, and admin.

## Related
- [[architecture]]
