---
name: vault-graph-walk
description: Walk through Obsidian-style wiki-links in vault/ to gather relevant context for a task. Use when starting work on a feature/bug and you need to surface related decisions, business rules, scenarios, and prior specs without reading the whole vault. Output is a compact context bundle, not raw note dumps.
argument-hint: [task-or-feature-keyword] [optional: starting-note-path] [optional: depth]
context: fork
allowed-tools: Read, Grep, Glob, Bash(ls *), Bash(test *), Bash(find *)
---

# Vault Graph Walk

Surface the most relevant slice of an Obsidian-style vault for a given task by following `[[wiki-links]]` from a seed note. Output is a curated context summary, not a wall of notes.

## When to Trigger

- User starts work on a feature / bug / refactor and the project has a `vault/` folder
- User asks: "что мы знаем про X?", "найди контекст по Y", "context for Z"
- Before reaching for `grep -r` across the whole repo when a structured vault exists

**Skip** if there is no `vault/` folder in the project — fall back to plain grep across docs/README.

## Workflow

### Step 1 — Verify vault exists

```bash
test -d vault && echo "vault_found"
test -f vault/00-home/index.md && echo "has_home_index"
```

If no vault, report and stop. Suggest user just use grep.

### Step 2 — Find seed note(s)

The seed is the starting point for the walk. Pick in this order:

1. **Explicit path** from user argument (if provided)
2. **Keyword match** on filenames (assertions-as-filenames pattern):
   ```bash
   find vault -type f -name "*.md" -iname "*{keyword}*"
   ```
3. **Content match** in note titles and headers:
   ```bash
   grep -rli "^#.*{keyword}" vault/ --include="*.md"
   ```
4. **Tag match** in frontmatter:
   ```bash
   grep -rl "tags:.*{keyword}" vault/ --include="*.md"
   ```

If multiple candidates, prefer in order: `vault/specs/` > `vault/knowledge/business/` > `vault/knowledge/decisions/` > `vault/knowledge/scenarios/` > `vault/api/`.

If no seed found, report top-5 closest filename matches and ask user to pick.

### Step 3 — Extract wiki-links

For each note in the frontier, extract `[[link-name]]` references:

```bash
grep -oE '\[\[[^]]+\]\]' "{note-path}" | sort -u
```

Resolve each link to a file path:

```bash
# Try exact match in vault root and common subdirs
find vault -type f -name "{link-name}.md"
```

If a link resolves to multiple files (ambiguous), prefer the one in the same subdir as the source note.

If a link does not resolve (broken link), note it but do not fail.

### Step 4 — BFS walk

Walk breadth-first from seed(s) to depth N (default 2, max 3 to avoid blowup):

- Visited set to prevent cycles
- Hard cap: 30 notes total across the walk
- Skip session logs (`vault/sessions/`) unless task explicitly mentions a session — they bloat context without adding rules

For each visited note, capture:

- **Title** (first `#` heading)
- **Tags** (frontmatter)
- **Date** (frontmatter or "Updated:" marker)
- **Summary**: first paragraph after title (or `## Summary` section if present)
- **Key claims**: 1-3 bullet points that look load-bearing (assertions, rules, constraints)

### Step 5 — Detect staleness

Flag any note where:

- `<!-- Updated: YYYY-MM-DD -->` is older than 6 months
- Frontmatter `date:` is older than 6 months AND no recent `Updated:` marker
- Status is `draft` or `wip` in frontmatter

Stale notes go to the report with a ⚠ marker so the user knows to verify before relying on them.

### Step 6 — Output context bundle

Produce a compact summary, **not** a dump of all notes. Target ≤ 200 lines of output.

Format:

```markdown
# Vault Walk: {seed-name}
Depth: {N} | Notes visited: {count} | Stale: {count}

## Seed
- **{seed-note-title}** (`{path}`)
  {1-2 sentence summary}

## Related Knowledge

### Decisions (vault/knowledge/decisions/)
- **{title}** — {1-line key claim}
- **{title}** — {1-line key claim} ⚠ stale (last updated YYYY-MM-DD)

### Business Rules (vault/knowledge/business/)
- **{title}** — {1-line key claim}

### Scenarios (vault/knowledge/scenarios/)
- **{title}** — {flow summary}

### API (vault/api/)
- **{module}** — {endpoints relevant to task}

### Prior Specs (vault/specs/)
- **{spec-name}** — status: {draft|approved|implemented}

## Broken Links
- `[[link-name]]` referenced from `{source-note}` — file not found

## Recommended Reading Order
1. {most relevant note} — start here
2. {second-most relevant}
3. {third}

## Open Questions
- {question raised in visited notes but not answered}
```

### Step 7 — Hand off

Report the bundle to the user. Suggest:

- If a relevant spec exists → "Read `{spec-path}` before implementing"
- If conflicting decisions found → "Decisions {A} and {B} appear to conflict on {topic} — clarify before proceeding"
- If stale notes found on critical path → "Verify {note} against current code"

## Quality Rules

- **One claim per bullet**. If a bullet has "and" + "also", split it
- **Skip empty sections**. If no decisions were touched, don't render the Decisions header
- **Prefer assertion-style note titles verbatim** ("PostgreSQL requires explicit index on FK columns") — those are the highest-signal items
- **Do not paraphrase business rules**. Quote them. Paraphrasing risks distortion
- **Do not include session logs** unless task explicitly references a date

## Notes for Claude

- Run inside a forked context (skill metadata sets `context: fork`) so the parent conversation stays clean
- Walk is read-only. Never modify vault notes from this skill — that's the job of `doc-updates.md` workflow
- If the user has a `.claude/rules/vault-usage.md`, respect its file-naming conventions when picking seeds (assertions over categories)
