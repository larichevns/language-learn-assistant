# CLAUDE.md

## Project

- **Name**: LanguageLearnAssistant (LLA)
- **Stack**: Next.js 15 (App Router, TypeScript) - frontend + backend in one app · React 19 · PostgreSQL + Prisma 6 · Auth.js v5 · Tailwind 3.4 + shadcn/ui · Serwist (PWA) · Gemini (free tier) via a provider abstraction
- **Type**: AI tutor assistant for a **Russian speaker learning German** (web + installable PWA). Vocabulary + SRS, grammar KB, homework intake/correction, exercise generation, context-aware tutor chat.

## Before Starting Any Work

1. Read `vault/00-home/index.md` - map of all project knowledge
2. Read `vault/atlas/conventions.md` - code, API, DB standards
3. Read `vault/atlas/architecture.md` - system layers + the AI context engine
4. Scan `vault/knowledge/decisions/` - why things are the way they are
5. If implementing a feature → read the relevant `vault/specs/*.md`
6. The master blueprint is `PLAN.md` (root) + `vault/specs/mvp-scope-and-phases.md`

## Knowledge Vault

Obsidian-style vault at `vault/`.

- **vault/atlas/** - architecture, stack, conventions, database (rarely changes)
- **vault/api/** - API docs per module + changelog
- **vault/knowledge/** - business rules, decisions, debugging, patterns, integrations
- **vault/specs/** - feature specifications (spec-first)

### Rules
- File names are **assertions**, not categories: `JWT-сессия-без-обращения-к-БД.md` not `auth.md`
- Use `[[wiki-links]]` to connect notes
- After work: update relevant vault notes (`.claude/rules/doc-updates.md`)
- Anything deferred from the MVP → record it in `vault/knowledge/business/post-mvp-backlog.md` (never drop silently)

## Core Principles (ported from ToonyGamy, see `vault/atlas/architecture.md`)

1. **"Chat is a desk, DB is the memory."** Every AI send rebuilds the 5-layer envelope from Postgres, never from chat scroll-back.
2. **Writes are proposals only.** The model has no DB tool; it calls `propose` → a card the user Applies/Refines/Discards. The Apply dispatcher is the sole writer (ownership-checked, idempotent).
3. **All user-authored text is inert data** - `sanitize()` + `<data type="…">` wrap before it enters an envelope.
4. **Static → dynamic layering** for the LLM prefix cache.
5. **Background ops** (summarization, rollups) set `isBackground` **and** `skipRateLimit` and never bill.
6. **Russian-native by default** (`*Ru` fields); German content stays German and is visually marked.

## Build & Development Commands

```bash
# Infra
docker compose up -d                 # local Postgres
# App
npm install
npx prisma migrate dev               # apply migrations
npx prisma db seed                   # seed admin + Gemini provider + templates
npm run dev                          # Next dev server (http://localhost:3000)
npm run build                        # production build
npm run lint                         # ESLint
npx tsc --noEmit                     # type check only
# AI lib (Phase 1, no DB needed)
npx tsx scripts/ai-cli.ts chat "..." # exercise the AI layer against Gemini
npm run test                         # vitest (AI lib + components)
npx playwright test                  # E2E
```

## Architecture (summary)

Single Next.js app. Three concentric layers: **`lib/ai`** (TS port of ToonyGamy's context engine - envelope builder, Gemini provider, propose/Apply, guards, usage) → **Route Handlers** (`app/api/*`: auth, domain CRUD, AI streaming, admin) → **React/PWA frontend** (`app/(app)`, `app/admin`, Assistant Dock + Proposal cards). Postgres via Prisma is the single source of truth that every AI envelope is rebuilt from. Full details: `vault/atlas/architecture.md`.

## Agents

Project agents in `.claude/agents/`, skills in `.claude/skills/` (synced from `project-skeleton`; canon is the skeleton). **Note:** this project is TypeScript/Next.js - `backend-dev` and `frontend-dev` work in TS/React here (not C#/.NET); `database-architect` works on the Prisma schema.

| Agent | Role | Model |
|-------|------|-------|
| `solution-designer` | System Architect | fable |
| `database-architect` | Prisma/Postgres Specialist | opus |
| `backend-dev` | Senior TS/Next Dev | opus |
| `frontend-dev` | Senior React/TS Dev | opus |
| `test-engineer` | Testing (vitest/Playwright) | sonnet |
| `ui-tester` | UI Testing Agent | sonnet |
| `qa-reviewer` | Read-Only Reviewer | sonnet |
| `tech-lead-reviewer` | Tech Lead | fable |

Task tiers: `.claude/rules/agent-workflow.md`.

## Credentials

Test credentials + API keys in `.claude/credentials.md` (gitignored). Gemini key goes in `.env` as `GEMINI_API_KEY` (never commit).
