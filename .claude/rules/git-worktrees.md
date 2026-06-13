---
description: "Git worktree branch naming conventions"
globs: "**"
---

## Git Worktrees

**Format**: `type/short-desc` (kebab-case)

**Types**:
- `feat/` -- new feature
- `fix/` -- bug fix
- `refactor/` -- refactoring without behavior change
- `chore/` -- infrastructure, dependencies, CI
- `docs/` -- documentation
- `test/` -- tests

**Rules**:
- Description: 2-4 words reflecting the task
- Latin only, lowercase, hyphens
- No generic names (`fix/bugfix`, `feat/update`)
