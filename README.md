# LanguageLearnAssistant (LLA)

AI-ассистент для изучения немецкого языка русскоговорящим. Один Next.js-проект: React-фронт + бек (Route Handlers) + AI-библиотека (`lib/ai`). PWA, Postgres + Prisma, Auth.js, Gemini (free tier).

> Полный архитектурный план — `PLAN.md`. База знаний проекта — `vault/` (старт: `vault/00-home/index.md`). Правила работы — `CLAUDE.md`.

## Что делает
Структурирует домашки и классную работу, хранит слова (der/die/das, Plural, формы глаголов) и грамматику, генерирует упражнения, проверяет ошибки с объяснением на русском, и даёт контекстного ИИ-тьютора. Подробнее — `vault/specs/mvp-scope-and-phases.md`.

## Ключевые принципы
- **«Chat is a desk, DB is the memory»** — каждый запрос к ИИ пересобирает 5-слойный envelope из Postgres, не из истории чата.
- **Записи — только через `propose`** — модель не пишет в БД; предлагает карточку, пользователь жмёт Apply.
- Весь пользовательский текст — `sanitize()` + `<data>` (защита от инъекций).

## Стек
Next.js 15 (App Router, TS) · React 19 · Prisma 6 + PostgreSQL 16 · Auth.js v5 · Tailwind 3.4 + shadcn/ui · next-intl (ru по умолчанию) · Serwist (PWA, Фаза 3) · Gemini за провайдер-абстракцией. Подробно: `vault/atlas/stack.md`.

## Быстрый старт
```bash
cp .env.example .env          # затем впиши GEMINI_API_KEY и т.д.
docker compose up -d          # локальный Postgres
npm install
npx prisma migrate dev        # применить схему (Фаза 2)
npm run dev                   # http://localhost:3000
```

### AI-слой (Фаза 1, без БД)
```bash
npx tsx scripts/ai-cli.ts chat "Erkläre den Akkusativ"   # стрим ответа Gemini
npm run test                                              # vitest для lib/ai
```

## Фазы
1. **ИИ-слой** (`lib/ai`) — 5-слойный envelope, Gemini-провайдер, propose/Apply, CLI-проверка.
2. **Бек** — Prisma-схема, Auth.js, CRUD, AI-роуты (SSE), админ-API, guards/usage.
3. **Фронт** — PWA-оболочка, экраны, Assistant Dock + Proposal-карточки, админка.
4. **Опц. полировка** — см. `vault/knowledge/business/post-mvp-backlog.md`.

## Структура
```
app/            Next.js App Router (UI + api/* route handlers)
lib/ai/         AI context engine (envelope, providers, propose, guards, usage)
lib/db, lib/auth, lib/api
prisma/         schema.prisma (источник истины)
messages/       i18n (ru, en)
vault/          база знаний проекта (Obsidian-style)
PLAN.md         полный blueprint
```
