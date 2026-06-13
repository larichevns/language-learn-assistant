---
description: "Rules for working with Obsidian Knowledge Vault"
globs: "vault/**"
---

## File Naming: Assertions, Not Categories

Name notes as statements of fact, not generic categories.

| Bad | Good |
|-----|------|
| auth.md | JWT с refresh token rotation.md |
| database.md | PostgreSQL requires explicit index on FK columns.md |
| pricing.md | три тарифа от 35к до 250к рублей с рассрочкой.md |
| bugs.md | rate limit 500 запросов потом 429 на 5 минут.md |

Claude sees file names before opening content. An assertion in the name immediately indicates relevance.

## Wiki-Links

Use `[[note name]]` to connect related notes:

```markdown
We discovered that [[ChatPlace MCP analytics returns null]]
so we changed [[ChatPlace sync to use chats_list not automations_analytics]]
while respecting [[rate limit 500 requests then 429 for 5 minutes]]
```

## Frontmatter

Every note should have:
```yaml
---
tags: [category, subcategory]
date: YYYY-MM-DD
---
```

## When to Create vs Update

- **Create new note**: new distinct piece of knowledge (bug, decision, pattern, integration)
- **Update existing note**: additional context for existing knowledge
- **Never**: create duplicate notes. Check if a relevant note exists first.

## Session Logs

When user says "save session" or "сохрани сессию":
1. Create `vault/sessions/YYYY-MM-DD-topic.md` with work summary
2. Update `vault/00-home/priorities.md` if priorities changed
3. Create/update knowledge notes for any new insights
4. Update `vault/00-home/index.md` if new notes were added

## Vault Structure

```
vault/
├── 00-home/       -- index + priorities (always read first)
├── atlas/         -- architecture, rarely changes
├── api/           -- API documentation per module
├── knowledge/     -- accumulated project knowledge
│   ├── business/  -- domain rules
│   ├── decisions/ -- ADRs with rationale
│   ├── scenarios/ -- API flow scenarios
│   ├── integrations/ -- external services
│   ├── debugging/ -- bugs + solutions
│   └── patterns/  -- code patterns
├── specs/         -- feature specifications
├── sessions/      -- session logs (gitignored)
└── inbox/         -- unprocessed (gitignored)
```
