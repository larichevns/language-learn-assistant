#!/usr/bin/env bash
# One-command local startup: Postgres (Docker) → migrations → client → seed → Next dev.
# Run from anywhere:   npm run local      (or)   ./scripts/dev.sh
# Idempotent — safe to re-run; it won't wipe data (migrate deploy + upsert seed).
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

say() { printf '\033[1;35m▸\033[0m %s\n' "$1"; }

say "LanguageLearnAssistant — local startup"

# 1. Prerequisites ----------------------------------------------------------
if [ ! -f .env ]; then
  echo "✗ .env is missing. Create it from the template, then fill in the secrets:" >&2
  echo "    cp .env.example .env" >&2
  echo "    # set GEMINI_API_KEY=...  and generate each *_SECRET / ENCRYPTION_KEY with: openssl rand -hex 32" >&2
  exit 1
fi
if ! command -v docker >/dev/null 2>&1; then
  echo "✗ Docker not found — install Docker Desktop and retry." >&2
  exit 1
fi

# 2. Postgres on :55432 (won't clash with a host Postgres on 5432). ----------
#    --wait blocks until the container's healthcheck passes.
say "Starting Postgres (docker compose, port 55432)…"
docker compose up -d --wait

# 3. Dependencies (only when missing) ---------------------------------------
if [ ! -d node_modules ]; then
  say "Installing dependencies…"
  npm install
fi

# 4. Schema + client + seed (all idempotent) --------------------------------
say "Applying migrations…"
npx prisma migrate deploy
say "Generating Prisma client…"
npx prisma generate
say "Seeding (idempotent: admin, Gemini provider, features, templates)…"
npm run db:seed

# 5. Dev server -------------------------------------------------------------
say "Starting Next dev → http://localhost:3000  (sign in with the seeded admin — see .claude/credentials.md)"
npm run dev
