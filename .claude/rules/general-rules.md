---
description: "General rules: conflict resolution, behavior constraints"
globs: "**"
---

## Conflict Resolution

- **Documentation > agent's "common sense"**. Always.
- If requirement contradicts vault documentation -> ASK, do not decide
- Update vault AFTER confirmation
- In commit message: `docs: update [vault note] -- [reason]`

## General Rules

- Do not invent business logic. If unsure -- ask.
- Do not change existing behavior without explicit request.
- Do not "optimize" working code unless asked.
- Do not add dependencies without approval.
- For refactoring: show plan first, identify blast radius via `vault/atlas/dependency-graph.md`.
- Always enter plan mode and ask questions when uncertain.
- After large tasks, ask for feedback. On positive feedback, update CLAUDE.md or vault.
- For frontend tasks: always study existing components before creating new ones.
