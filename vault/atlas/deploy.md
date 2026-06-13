---
tags: [atlas, deploy]
date: 2026-06-13
---

# Deployment

## Local development
```bash
cp .env.example .env          # fill GEMINI_API_KEY; AUTH_SECRET (npx auth secret)
docker compose up -d          # Postgres 16 on host :55432
npm install
npx prisma migrate dev        # apply migrations
npx prisma db seed            # admin@lla.local / admin12345 + Gemini provider + sample data
npm run dev                   # http://localhost:3000
```
Caution: never run `next build` while `next dev` is live — it desyncs `.next` ("Cannot find module"); restart dev after a build.

## Environment variables (`.env`, gitignored)
- `DATABASE_URL` — Postgres (dev: `postgresql://lla:lla@localhost:55432/lla`).
- `GEMINI_API_KEY` — Google AI Studio key (free tier). In prod, set per-provider key in admin (encrypted).
- `AUTH_SECRET` — Auth.js (`npx auth secret`). `AUTH_GOOGLE_ID/SECRET` — optional Google OAuth.
- `ENCRYPTION_KEY` — 32-byte hex (`openssl rand -hex 32`) for provider keys at rest (only needed if storing keys in DB).
- `CRON_SECRET`, `AI_SERVICE_TOKEN` — internal endpoints.

## Production (target)
- **App**: Vercel (Next.js). Set env in project settings.
- **DB**: hosted Postgres (Neon/Supabase) — swap `DATABASE_URL`; run `prisma migrate deploy`.
- **Rate-limit/cache**: move the in-memory guards to Upstash Redis (see [[Локальная-инфра-Docker-Postgres-плюс-in-memory-guards]] + [[post-mvp-backlog]]).
- **Cron**: Vercel Cron → `GET /api/crons/cleanup` with `x-cron-secret`.
- **PWA**: service worker registers in production only (`components/sw-register.tsx`).

## Checks before deploy
`npm run typecheck` · `npm run test` · `npx playwright test` · `npm run build`.

## Related
- [[architecture]] · [[stack]]
