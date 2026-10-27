# LanguageLearnAssistant

AI assistant for learning German, built for my own studies (June to July 2026). One Next.js 15 project: React front end, API route handlers and the AI layer in a single codebase, installable as a PWA with offline support.

What it does: keeps homework and class notes structured, stores vocabulary (article, plural, verb forms) and grammar topics, generates exercises, runs spaced repetition on cards, tracks progress and reads words aloud with a German voice. The assistant lives in a dock on every screen and proposes cards; nothing is written to the database until the user clicks Apply.

## Key principles

- "Chat is a desk, the database is the memory": every request to the model is assembled from a 5-layer context envelope built from Postgres, not from chat history.
- Writes only through proposals: the model never writes to the database; it proposes a card and the user applies it.
- All user text is sanitized and wrapped as data to resist prompt injection.

## Stack

Next.js 15 (App Router, TypeScript), React 19, Prisma 6 + PostgreSQL 16, Auth.js v5, Tailwind 3.4 + shadcn/ui, next-intl (Russian by default, English), Serwist (PWA), Gemini behind a provider abstraction, Vitest, Playwright.

## Quick start

```bash
cp .env.example .env      # set GEMINI_API_KEY and the other keys
docker compose up -d      # local Postgres
npm install
npx prisma migrate dev    # apply the schema
npm run dev               # http://localhost:3000
```

```bash
npx tsx scripts/ai-cli.ts chat "Erkläre den Akkusativ"   # stream a Gemini answer without the UI
npm run test                                              # Vitest for lib/ai
npx playwright test                                       # e2e smoke: login, vocabulary, SRS, admin, i18n
```

## Structure

```text
app/            Next.js App Router: screens (dashboard, vocabulary, grammar, homework, exercises, notes, progress, admin) and api/* route handlers
lib/ai/         AI context engine: envelope, providers, propose, guards, usage and cost tracking
lib/db, lib/auth, lib/api
prisma/         schema.prisma (34 models), migrations, seed
messages/       i18n (ru, en)
e2e/            Playwright smoke suite
design/         design directions and wireframes
vault/          project knowledge base (architecture, decisions, debugging notes), in Russian
PLAN.md         full blueprint, in Russian
```

Built with Claude Code using the agents, rules and skills in `.claude/`.
