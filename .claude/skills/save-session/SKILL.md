---
name: save-session
description: "Save current work session to vault. Creates session log, updates priorities, adds new knowledge notes."
---

# Save Session

When user says "save session" or "сохрани сессию", follow these steps:

## Step 1: Create Session Log

Create `vault/sessions/YYYY-MM-DD-{topic}.md`:

```markdown
---
tags: [session]
date: YYYY-MM-DD
---

# Session: {topic}

## What was done
- {list of completed work}

## Decisions made
- {any decisions with rationale}

## Issues encountered
- {bugs, blockers, workarounds}

## Next steps
- {what needs to be done next}

## Files changed
- {list key files modified}
```

## Step 2: Update Priorities

Read and update `vault/00-home/priorities.md`:
- Move completed items out of "In Progress"
- Add new items to "Next Up" based on session outcomes
- Update "Blocked" if anything is waiting

## Step 3: Knowledge Updates

Check if session produced new knowledge:
- **Bug found?** -> Create/update `vault/knowledge/debugging/{description}.md`
- **Decision made?** -> Create/update `vault/knowledge/decisions/{decision}.md`
- **Pattern established?** -> Create/update `vault/knowledge/patterns/{pattern}.md`
- **Integration configured?** -> Create/update `vault/knowledge/integrations/{service}.md`

## Step 4: Update Index

If new notes were created, add wiki-links to `vault/00-home/index.md`.
