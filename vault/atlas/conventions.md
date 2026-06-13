---
tags: [atlas, conventions]
date: 2026-06-13
---

# Conventions

TypeScript end to end. Strict mode on.

## Code
- **Components**: PascalCase (`ProposalCard.tsx`); file matches export.
- **Hooks**: `useXxx` camelCase.
- **Functions/vars**: camelCase. **Constants**: UPPER_SNAKE_CASE. **Types/enums**: PascalCase.
- **Paths**: import via `@/` alias (`@/lib/ai/...`, `@/components/...`).
- **No business-logic `throw`** in services — return a `Result<T>` tuple; Route Handlers translate to HTTP.
- Validate every external input with **zod** at the boundary (route handlers, AI payloads).

## API (Route Handlers)
- REST: `GET` (list/detail), `POST` (create/action), `PUT`/`PATCH` (update), `DELETE` (remove).
- Status codes: 200, 201, 204, 400, 401, 403, 404, 409, 429 (+`Retry-After`), 402 (budget).
- **Response envelope** (`lib/api/response.ts`): `{ code, message, data }` via `successResponse` / `errorResponse`.
- Pagination: `?page=&pageSize=` → `{ items, total, page, pageSize, hasNext }`.
- **Auth/ownership checked BEFORE the service call** in every handler: `requireUser` → `requireOwner(resourceId)` → service. Admin handlers re-check `requireAdmin` server-side (never trust middleware alone).
- AI streaming uses one app SSE protocol: events `token · proposal · usage · done · error`.

## AI lib (`lib/ai`)
- Every user-authored string entering an envelope passes through `sanitize()` + `wrapData()`. The only exception is the fresh user message (layer 06).
- Caps measured in **characters** (`envelope/caps.ts`); silent-trim, never reject.
- Background ops set `isBackground: true` **and** `skipRateLimit: true` and never bill cost.
- `propose` is the model's ONLY write path; the Apply dispatcher is the ONLY writer.
- Provider calls go through the registry/router — never hardcode a model id in a feature.

## Database (Prisma / PostgreSQL)
- Models PascalCase singular; Prisma maps to snake_case tables where needed via `@@map` (optional).
- PK: `String @id @default(cuid())`. Timestamps: `createdAt @default(now())`, `updatedAt @updatedAt`.
- FK fields `xxxId`; **index every FK** and every common filter (`@@index`).
- Define cascade explicitly (`onDelete: Cascade | SetNull`). Money/quota never cascade-deleted.
- JSON blobs use `Json` (jsonb); German content lives in typed columns, Russian explanations in `*Ru` fields.

## i18n
- `next-intl`, namespaces per area. **UI = Russian by default**; `en` fallback exists from day one (see [[i18n-с-первого-дня-дефолт-русский]]).
- **German learning content is always rendered in German** and visually marked — never auto-translated in the UI.

## Frontend patterns
- TanStack Query for server state; React Hook Form + zod for forms; zustand only for genuinely global client state (dock/thread/shell).
- shadcn/ui primitives; Tailwind tokens from the theme (indigo/teal, dark+light `class`). WCAG 2.1 AA.

## Git / worktrees
- See `.claude/rules/git-worktrees.md`. Branch format `type/short-desc` (`feat/ai-envelope`).

## Related
- [[architecture]] · [[stack]]
