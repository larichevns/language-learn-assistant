---
tags: [decision, infra, dev]
date: 2026-06-13
---

# Локальная инфра — Docker Postgres плюс in-memory guards

**Решение.** Для разработки: PostgreSQL локально через Docker Compose; rate-limit / cost / response-cache — реализация **в памяти процесса** за интерфейсом, без внешних аккаунтов.

**Почему.** Владелец тестирует один; ноль внешних зависимостей = мгновенный старт. Guards и кеш скрыты за интерфейсом (`RateLimiter`, `Cache`), так что на прод свапаем на Upstash Redis без правок вызывающего кода.

**Следствия.**
- `docker-compose.yml` поднимает Postgres 16; `DATABASE_URL` указывает на него.
- In-memory rate-limit корректен только в одном инстансе — для прода/Vercel (несколько лямбд) обязателен Upstash (см. [[post-mvp-backlog]]).
- Прод-путь: hosted Postgres (Neon/Supabase) + Upstash — переключение конфигом.

## Related
- [[stack]] · [[architecture]]
