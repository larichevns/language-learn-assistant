---
description: "When to update which vault notes"
globs: "vault/**"
---

## Vault Update Rules

After making changes, update the corresponding vault notes:

| Change Type | Update |
|-------------|--------|
| Business rule changed | `vault/knowledge/business/{relevant-note}.md` |
| New API flow | `vault/knowledge/scenarios/{flow-name}.md` |
| Architectural decision | `vault/knowledge/decisions/{decision-name}.md` |
| Code convention changed | `vault/atlas/conventions.md` |
| Module added/removed | `vault/atlas/dependency-graph.md` |
| API endpoint changed | `vault/api/{module}.md` + `vault/api/_changelog.md` |
| DB schema changed | `vault/atlas/database.md` |
| Bug found and fixed | `vault/knowledge/debugging/{bug-description}.md` |
| New integration | `vault/knowledge/integrations/{service-name}.md` |
| New code pattern | `vault/knowledge/patterns/{pattern-name}.md` |
| New notes added | `vault/00-home/index.md` (add wiki-link) |

## Naming Convention

All new notes: **assertions, not categories**.
See `.claude/rules/vault-usage.md` for detailed naming rules.

## Mark Changes

Add update marker to modified notes:
```markdown
<!-- Updated: YYYY-MM-DD | reason -->
```
