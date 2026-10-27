---
tags: [decision, ai, provider, gemini]
date: 2026-06-13
---

# Gemini free tier через провайдер-абстракцию

**Решение.** На старте используем Google Gemini (бесплатный тир) как единственного провайдера, но за интерфейсом `Provider` (`complete/stream/countTokens/healthCheck`). Маршрутизация модели - через БД (`ProviderConfig`/`ModelConfig`/`ModelRouting`), не хардкодом в фичах.

**Почему.** Бесплатно для тестов сейчас; абстракция позволяет добавить OpenAI/Anthropic/DeepSeek без переписывания фич (Phase 4, [[post-mvp-backlog]]).

**Особенности free tier (учесть в адаптере).**
- Лимиты RPM/RPD/токены → ошибка **HTTP 429 `RESOURCE_EXHAUSTED`** с `RetryInfo.retryDelay`. Foreground: пробрасываем 429 + `Retry-After` пользователю, НЕ авто-ретраим. Background (суммаризатор): один ограниченный ретрай.
- Экономия: большинство вызовов `reasoningEffort:'minimal'` (thinkingBudget 0); `homework_correct`/`exercise_generate` - `'low'`.
- Кеш: полагаемся на **implicit prefix caching** (байт-стабильный порядок слоёв 01→02→03), проверяем `usageMetadata.cachedContentTokenCount`. Explicit context caching - опционально позже.
- Ключ в `.env` как `GEMINI_API_KEY` (dev) и в `ProviderConfig.apiKeyEncrypted` (aes-256-gcm, prod). Никогда не коммитим.

**Эталон:** `ToonyGamy/toonygamy-ai/app/providers/gemini.py` (thinking budgets, SSE, vision).

## Related
- [[stack]] · [[architecture]]
