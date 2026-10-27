---
tags: [decision, ai, context-engine]
date: 2026-06-13
---

# 5-слойный context engine портирован из ToonyGamy

**Решение.** AI-слой LLA - это TypeScript-порт context engine из `~/Dev/ToonyGamy` (`toonygamy-ai`), который владелец назвал образцовым. Сохраняем те же идеи: 5-слойный envelope (static→dynamic для prefix-кеша), `<data>`+sanitize против инъекций, per-object треды, авто-суммаризация по watermark, char-капы, толерантность к пустым блокам.

**Почему.** Паттерн уже доказан в проде ToonyGamy; он решает ровно нашу задачу - собирать богатый, но управляемый контекст из БД и держать стоимость токенов под контролем. Изобретать заново - риск и трата времени.

**Маппинг домена.** comic→Course/LearnerProfile, lore/characters/style→знания (grammar/vocab/preferences), chapter→Unit/Lesson, scope object→homework/topic/vocab-list/exercise. См. `PLAN.md` §3.1 и [[architecture]].

**Эталон для чтения:** `ToonyGamy/toonygamy-ai/app/services/envelope_builder.py`, `context_service.py`, `providers/gemini.py`, `vault/specs/aict-v2-context-engine-and-workbench.md`.

## Related
- [[Записи-это-proposals-единственный-путь-записи-Apply]] · [[architecture]]
