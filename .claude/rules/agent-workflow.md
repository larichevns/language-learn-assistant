---
description: "Agent workflow: available agents, task tiers, parallel execution rules"
globs: "**"
---

## Available Agents

| Agent | Role | Model | When to Use |
|-------|------|-------|-------------|
| `solution-designer` | System Architect | **fable** | Before coding: full solution design |
| `database-architect` | DB Specialist | opus | Before backend: schema, migrations |
| `backend-dev` | Senior C#/.NET Dev | opus | Backend implementation |
| `frontend-dev` | Senior React/TS Dev | opus | Frontend implementation |
| `test-engineer` | Testing Specialist | sonnet | Unit tests + API smoke tests |
| `ui-tester` | UI Testing Agent | sonnet | Browser-based UI verification |
| `qa-reviewer` | Read-Only Reviewer | sonnet | Fast checklist pass during module dev |
| `tech-lead-reviewer` | Tech Lead | **fable** | Final holistic review before merge |

**Model strategy**: Fable only where depth pays off -- full planning and the final
review gate. Opus for implementation. Sonnet for mechanical/checklist work.
Rationale: `vault/knowledge/decisions/Fable только в solution-designer и tech-lead-reviewer.md`

## Task Tiers

Pick the SMALLEST tier that fits. Spawning agents for trivial work wastes time and tokens.

### Tier 0 -- Micro (no agents)
Typos, config tweaks, doc edits, one-liners, small style fixes.
-> Main session does it directly. Verify with build/lint. No spec, no review agents.

### Tier 1 -- Bug fix (1-2 agents)
1. Fix: main session, or `backend-dev`/`frontend-dev` if the fix is non-trivial
2. `test-engineer` -- only if the area has tests or the bug deserves a regression test
3. `tech-lead-reviewer` -- ONLY when the fix touches critical zones: auth, money,
   data integrity, migrations. Otherwise skip.
4. Document root cause: `vault/knowledge/debugging/{assertion-named note}.md`

### Tier 2 -- Small feature (3-4 agents)
1. `solution-designer` -- compact design (inline in chat; no spec file required)
2. `backend-dev` and/or `frontend-dev` -- parallel if the design fixed the API contract
3. `test-engineer` -- tests for new logic
4. `tech-lead-reviewer` -- review

### Tier 3 -- Module / large feature (spec-first)
1. `/spec-create` -> `vault/specs/{feature}.md` (6 mandatory blocks) -> user review
2. `solution-designer` -- full architecture from the spec
3. `database-architect` -- only if DB schema changes
4. `backend-dev` || `frontend-dev` -- PARALLEL after API contract is fixed
5. `test-engineer` || `ui-tester` -- PARALLEL (unit/API tests + browser verification)
6. `qa-reviewer` -- fast checklist pass
7. `tech-lead-reviewer` -- final gate

### Refactoring
1. `solution-designer` -- blast radius via `vault/atlas/dependency-graph.md`, plan first
2. `backend-dev` and/or `frontend-dev` -- execute
3. `test-engineer` -- verify nothing broke
4. `tech-lead-reviewer` -- only if behavior could have changed

## Parallel Execution Rules

- Launch independent agents in ONE message -- they run concurrently
- `backend-dev` || `frontend-dev`: only AFTER the API contract is fixed in design/spec
- `test-engineer` || `ui-tester`: always parallelizable
- Never run both `qa-reviewer` AND `tech-lead-reviewer` on a small change:
  qa is the in-progress checklist for modules, tech-lead is the single final gate

## Context Gathering (before heavy agents)

- Use the `Explore` agent or `/vault-graph-walk` for cheap read-only context first
- Do not make opus/fable agents re-discover what a cheap search can find
- Pass gathered context INTO the agent prompt: file paths, vault note names, constraints

## Credentials

Test credentials for API testing and browser testing are in `.claude/credentials.md`.
This file is gitignored. Update it when accounts or environments change.
