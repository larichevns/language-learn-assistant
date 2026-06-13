---
name: spec-create
description: Create a feature specification with 6 mandatory blocks (User Stories, Data Model, API, Screens, Business Logic, Edge Cases) before implementation. Use when starting a new feature, module, or major integration. Detects vault/specs/ folder and uses SPEC_TEMPLATE.md if present, otherwise uses built-in template.
argument-hint: [feature-name] [optional: brief description]
allowed-tools: Read, Write, Glob, Grep, Bash(ls *), Bash(test *)
---

# Spec-First Feature Specification

Create a complete feature specification before any code is written. Enforces the spec-first principle: no implementation without all 6 mandatory blocks filled.

## When to Trigger

- User says: "новая фича", "new feature", "let's build X", "добавь модуль", "spec for"
- User wants to start a non-trivial implementation
- Before any architectural / API / DB work on a new capability

**Skip** for bug fixes, small refactors, config changes — these don't need a spec.

## Workflow

### Step 1 — Detect environment

Check if project uses spec-first vault pattern:

```bash
test -d vault/specs && echo "vault_specs_found"
test -f vault/specs/SPEC_TEMPLATE.md && echo "template_found"
test -f .claude/rules/spec-first.md && echo "rules_found"
```

- If `vault/specs/` exists → write spec there as `vault/specs/{feature-name}.md`
- If `vault/specs/SPEC_TEMPLATE.md` exists → load and use it as base
- Otherwise → write spec to `docs/specs/{feature-name}.md` or `specs/{feature-name}.md` (whichever convention the repo uses; create the folder if neither)

### Step 2 — Gather feature context

Before writing the spec, briefly ask the user OR infer from conversation:

1. **What problem does this solve?** (1 sentence)
2. **Who is the primary user?** (role/persona)
3. **What's the smallest valuable scope?** (MVP boundary)

If the user already provided enough context, skip the questions and proceed.

### Step 3 — Search vault for relevant existing knowledge

If `vault/` exists, search for prior decisions, business rules, and related specs:

```bash
grep -r "{feature-keyword}" vault/knowledge/ vault/specs/ vault/api/ 2>/dev/null
```

Reference findings via `[[wiki-links]]` in the spec.

### Step 4 — Write the spec with 6 mandatory blocks

**Frontmatter** (Obsidian style):

```yaml
---
tags: [spec, {domain}]
date: YYYY-MM-DD
status: draft
---
```

**Block 1 — User Stories** (минимум 3)
- Format: `As [role], I want [action], so that [result]`
- Concrete roles (Buyer, Purchaser, Admin) not "user"
- Concrete actions ("create a pre-order with 3 line items") not "manage data"

**Block 2 — Data Model**
- Table per entity with columns: `name`, `type`, `constraints`, `notes`
- Types as in SQL: `uuid`, `text`, `jsonb`, `timestamptz`, `numeric(18,2)`
- FK relationships explicit: `→ users(id) on delete restrict`
- Index hints if performance-sensitive

**Block 3 — API**
- Method + path + auth scope
- Request body (TypeScript or JSON schema)
- Response (success + error shapes)
- Status codes (200, 201, 400, 403, 404, 409, 422)
- Idempotency / pagination / filtering if applicable

**Block 4 — Screens**
- Page or component name + route
- What it displays (lists, forms, modals)
- Actions available (with permission scope)
- States: loading / empty / error / success / partial

**Block 5 — Business Logic**
- Validation rules (with concrete bounds: "min 1, max 10000")
- State transitions (state diagram if non-trivial)
- Formulas (pricing, discounts, taxes — with examples)
- Permissions matrix (who can do what)
- Race conditions / locking strategy if concurrent

**Block 6 — Edge Cases**
- No data: empty list, empty filter result, first-time user
- API down: retry policy, fallback UX
- Concurrent editing: optimistic locking? last-write-wins?
- Partial failures: payment succeeds, email fails — what then?
- Data validation: invalid input, oversized payloads, malicious input

### Step 5 — Quality gate

Before finishing, verify each block answers "yes":

- [ ] Concrete, not abstract? (no "advanced analytics", no "robust handling")
- [ ] Types as in SQL/TS, not English? ("uuid" not "ID")
- [ ] No TODO / TBD / "to be defined"? Fill or remove the section
- [ ] At least 3 user stories with distinct roles or actions?
- [ ] Every API method has full request + response + status codes?
- [ ] Every screen state covered (loading/empty/error/success)?

If any block is incomplete, ask the user OR mark `<!-- needs input: {what} -->` so the human can fill it.

### Step 6 — Cross-reference and report

After writing:

1. Add `[[wiki-links]]` to related vault notes (if vault exists)
2. Report file path to user
3. Suggest next step: "Pass to solution-designer agent" if such agent exists, otherwise "Review and approve before implementation"

## Template (fallback when no project template exists)

```markdown
---
tags: [spec, {domain}]
date: YYYY-MM-DD
status: draft
---

# {Feature Name}

## Problem
One paragraph: what problem does this solve, for whom.

## Scope
What is in / out of scope for V1.

## 1. User Stories
- As {role}, I want {action}, so that {result}
- As ...
- As ...

## 2. Data Model
### `table_name`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | pk default gen_random_uuid() | |
| ... | ... | ... | ... |

FK: `column → other_table(id) on delete {cascade|restrict|set null}`
Index: `(column1, column2)` for ...

## 3. API
### `POST /api/v1/{resource}`
Auth: `{role}`
Request:
```json
{ ... }
```
Response 201:
```json
{ ... }
```
Errors: 400 (validation), 403 (no permission), 409 (conflict)

## 4. Screens
### `{ScreenName}` — `/route`
- Displays: ...
- Actions: ...
- States: loading | empty | error | success

## 5. Business Logic
- Validation: field X must be ..., field Y in [a, b, c]
- State transitions: `draft → pending → approved → archived` (only forward except archived → ∅)
- Formula: total = sum(line.price * line.qty) - discount
- Permissions: only {role} can {action}

## 6. Edge Cases
- No data: ...
- Concurrent edit: ...
- API failure: ...
- Invalid input: ...

## References
- [[related-note-1]]
- [[related-note-2]]
```

## Notes for Claude

- Do **not** start writing code until the user explicitly approves the spec
- If the user pushes to skip the spec, remind once that spec-first is a project rule (cite `.claude/rules/spec-first.md` if it exists), then defer to their decision
- Update `vault/00-home/index.md` with a wiki-link to the new spec if vault is present
