---
name: component-log-update
description: Append an entry to src/components/COMPONENT_LOG.md after creating a new reusable UI component. Use immediately after writing a new component file under src/components/ or src/ui/. Prevents the "I created the component but forgot the log" failure mode.
argument-hint: [component-name] [optional: file-path]
allowed-tools: Read, Edit, Write, Glob, Grep, Bash(ls *), Bash(test *), Bash(git *)
---

# Component Log Updater

After creating a new reusable UI component, append a record to the project's component log so future work can find and reuse it.

## When to Trigger

Activate **immediately after** any of:

- Writing a new file under `src/components/`, `src/ui/`, `app/components/`, or `components/`
- Creating a `.jsx`, `.tsx`, `.vue`, `.svelte` file that exports a reusable visual component
- User says: "создал компонент", "added component", "new component"

**Skip** when:

- The file is a page / route / layout (not a reusable atom)
- The file is a hook, util, or context (no visual surface)
- COMPONENT_LOG.md does not exist in the project (just report and skip)

## Workflow

### Step 1 — Locate the log

Try in order:

```
src/components/COMPONENT_LOG.md
src/ui/COMPONENT_LOG.md
components/COMPONENT_LOG.md
app/components/COMPONENT_LOG.md
```

If none exists, **do not create one** — report to user: "Project has no COMPONENT_LOG.md, skipping log update. Create one if you want this skill to track components."

### Step 2 — Detect existing log format

Read the first 50 lines of the log to learn its conventions:

- Table format? (Name | Path | Purpose | Props)
- List format? (`### ComponentName` headers with bullets)
- Custom columns? (Status, Added by, Date, Tags)

**Match the existing format exactly**. Do not invent a new structure.

### Step 3 — Extract component metadata from the source

Read the component file to fill in:

- **Name** — exported component name
- **Path** — relative path from project root
- **Purpose** — 1 sentence: what visual + functional role it serves
- **Props** — main props (skip default React props like `children`, `className`, `ref`)
- **Variants** — if the component has `variant` / `size` / `state` props, list values
- **Dependencies** — if it composes other internal components, list them
- **Date** — today's date (YYYY-MM-DD)

### Step 4 — Check for duplicates

Before appending, grep the log for the component name:

```bash
grep -i "{ComponentName}" src/components/COMPONENT_LOG.md
```

If a row already exists:

- If component was edited (not added): suggest updating the existing row instead
- If different component with same name: warn user and ask for resolution

### Step 5 — Append entry

Insert in the correct section (alphabetical / category-based — follow existing order).

If table format:

```markdown
| {Name} | src/components/.../File.jsx | {one-line purpose} | {props} | {YYYY-MM-DD} |
```

If list format:

```markdown
### {Name}
- **Path**: `src/components/.../File.jsx`
- **Purpose**: {one-line purpose}
- **Props**: `{prop1: type}`, `{prop2: type}`
- **Added**: {YYYY-MM-DD}
```

### Step 6 — Verify

Re-read the log to confirm the entry was added in the right place and follows the format. Report file:line to the user.

## Quality Rules

- **Purpose must be specific**: "Modal dialog with confirm/cancel actions and dismissible overlay" — not "modal component"
- **Props are the public API**: list what callers need to know, not internal state
- **One line per row**: if you need a paragraph, the component is too complex — flag it for review
- **Do not duplicate code from the component**: the log is a directory, not a manual

## Project-Specific Conventions

If `CLAUDE.md` or `.claude/rules/` mentions component conventions (design tokens, naming, file structure), reference them in the purpose only if violated — log entries should describe what is, not what should be.

## Notes for Claude

- Run this **after** the user has accepted the component (file written successfully)
- Do not block on this — if the log update fails, the component still exists. Report and move on
- If the user creates many components in one session, batch them: append all entries at once rather than re-reading the log N times
