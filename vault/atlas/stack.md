---
tags: [atlas, stack]
date: 2026-06-13
---

# Technology Stack

Single Next.js app (frontend + backend + AI lib). All TypeScript.

| Layer | Technology | Version | Rationale |
|-------|-----------|---------|-----------|
| Framework | Next.js (App Router) | 15.x | One app = React frontend + Route Handlers backend + RSC; Vercel-ready |
| UI runtime | React / React DOM | 19.x | Server Components + Actions; required by Next 15 |
| Language | TypeScript | 5.6+ | Strict types across AI lib, Prisma, zod |
| ORM / DB | Prisma + PostgreSQL | Prisma 6 / PG 16 | Type-safe DB, migrations, `groupBy`/`aggregate` for usage |
| Auth | Auth.js (next-auth) | 5.0 beta | Sessions, Prisma adapter, credentials + Google, middleware role gating |
| CSS | Tailwind CSS | 3.4 | Mature shadcn/ui support (chosen over 4) |
| Components | shadcn/ui (Radix) | CLI | Owned components: Proposal cards, Assistant Dock, admin tables |
| PWA | @serwist/next + serwist | 9.x | Workbox successor; injectManifest SW, offline SRS |
| Validation | zod | 3.23 | AI request/response, prompt-variable registry, route inputs |
| Server state | @tanstack/react-query | 5.x | Fetch/cache/optimistic + offline persistence for decks |
| Client state | zustand | 5.x | Dock, thread, shell stores |
| i18n | next-intl | 3.x | ru primary UI, de content, en fallback; App Router native |
| Rate-limit/cache | in-memory (dev) → @upstash/ratelimit+redis (prod) | latest | Provider-abstracted; local dev needs no external account |
| AI provider | Google Gemini (free tier) | v1beta REST | Free testing; behind a `Provider` interface so others slot in |
| Encryption | Node `crypto` (aes-256-gcm) | built-in | Provider API keys at rest; key from `ENCRYPTION_KEY` |
| Markdown | react-markdown + remark-gfm | latest | Assistant messages + proposal previews |
| Tests | vitest + Testing Library; Playwright | latest | Unit (AI lib + components); E2E |
| Scripts | tsx | latest | Run the Phase-1 AI CLI without a build |

## Dev infrastructure
- **Local Postgres via Docker Compose** (`docker compose up -d`).
- **Guards (rate-limit/cost/cache) in-memory for dev**, swappable to Upstash for prod — see [[Локальная-инфра-Docker-Postgres-плюс-in-memory-guards]].

## Related
- [[architecture]]
- [[Gemini-free-tier-через-провайдер-абстракцию]]
