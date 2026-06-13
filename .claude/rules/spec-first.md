---
description: "Spec-First methodology: write specs before code"
globs: "vault/specs/**"
---

## Spec-First Principle

No code is written until the feature is fully described in a specification.

## When to Create a Spec

- New feature or module
- Significant behavior change
- New integration with external service
- NOT needed for: bug fixes, small refactors, config changes

## Spec Template

Use `vault/specs/SPEC_TEMPLATE.md` as the base.

## 6 Mandatory Blocks Per Module

1. **User Stories** -- "As [role], I want [action], so that [result]". Minimum 3 stories.
2. **Data Model** -- Tables with column types (as in SQL: uuid, text, timestamptz), constraints, FK relationships, RLS policies.
3. **API** -- Method, path, request body, response, status codes. Format close to code: `POST /api/projects`.
4. **Screens** -- Pages and components: what they display, actions, states (loading, error, empty, success).
5. **Business Logic** -- Validation rules, constraints, formulas, state transition conditions.
6. **Edge Cases** -- No data? API down? Concurrent editing? Specific error scenarios with expected behavior.

## Quality Rules

- **Concrete, not abstract**: Not "advanced analytics" but "dashboard with retention graphs by cohort, free->pro conversion, data from Supabase via Edge Function cron"
- **Types as in SQL**: uuid, text, jsonb, timestamptz. The closer to code, the more precise the generation.
- **No TODO stubs**: every section must be filled. If unclear -- ask, don't leave placeholders.
- **Don't ask -- add yourself**: if the answer is in existing vault notes, use it. The spec prompt should prevent AI from asking clarifying questions when the answer is already in the documentation.

## Workflow

1. Create spec: `vault/specs/{feature-name}.md`
2. Review with user
3. Pass to `solution-designer` for implementation plan
4. Execute via `backend-dev` / `frontend-dev` / `database-architect`
