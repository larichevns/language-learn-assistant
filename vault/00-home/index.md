---
tags: [home, index]
date: 2026-06-13
---

# LanguageLearnAssistant Knowledge Vault

AI tutor for a Russian speaker learning German. Single Next.js app. Master blueprint: `PLAN.md`.

## Atlas (Architecture)
- [[architecture]] — system layers + the 5-layer AI context engine + propose/Apply
- [[stack]] — technology stack with rationale
- [[database]] — Prisma/Postgres schema overview
- [[conventions]] — code, API, DB, AI-lib, i18n standards
- [[dependency-graph]] — module dependency map
- [[deploy]] — deployment process (to fill)

## Specs
- [[mvp-scope-and-phases]] — approved MVP scope, hero feature, the phases + verification evidence
- [[phase-5-adaptive-learning-loop]] — make the tutor truly adaptive + retention/journal/export (research-backed spec — the "what/why")
- [[phase-5-implementation-plan]] — Phase 5 solution design: schema deltas, the closed loop (`recordAttempt`), BKT/decay/FSRS, focus-block, 10 build slices, test plan (the "how")
- [[phase-6-design-directions]] — 3 distinct visual directions + market analysis (prototypes in `design/wireframes/`)
- [[phase-7-design-implementation]] — chosen: Direction B gently-muted + centered Google-style assistant; ui-tester verified
- [[SPEC_TEMPLATE]] — template for new feature specs

## Knowledge

### Business
- [[post-mvp-backlog]] — everything deferred past the MVP (do not drop silently)

### Decisions
- [[5-слойный-context-engine-портирован-из-ToonyGamy]]
- [[Записи-это-proposals-единственный-путь-записи-Apply]]
- [[ИИ-дообогащает-и-сам-раскладывает-из-краткой-команды]]
- [[Один-Next.js-проект-вместо-отдельного-AI-сервиса]]
- [[Gemini-free-tier-через-провайдер-абстракцию]]
- [[Локальная-инфра-Docker-Postgres-плюс-in-memory-guards]]
- [[Тема-UI-спокойная-индиго-бирюза]]
- [[i18n-с-первого-дня-дефолт-русский]]
- [[Fable только в solution-designer и tech-lead-reviewer]] — agent model strategy
- [[Язык-ответа-выводится-из-nativeLang-а-не-хардкодится]] — response language is data-driven, not hardcoded in the persona
- [[Loop-записи-обходят-propose-Apply-это-derived-state]] — Phase 5 loop writes (Attempt/BKT/FSRS/timeline/rollup) write directly; they're derived state from the learner's own grades, not model proposals

### Scenarios / Integrations / Patterns
- [[PWA-офлайн-SW-кэширует-чтения-IndexedDB-outbox-копит-записи]] — офлайн ревью из SW-кэша + очередь грейдов в IndexedDB, флаш при возврате связи (без Background Sync — ради iOS)

### Debugging
- [[propose-Apply-500-на-вложенных-payload-из-за-формы-модели]] — Apply 500 для HOMEWORK_CORRECTION/EXERCISE_SET; модель эмитит неканоничную форму → толерантные `z.preprocess` + привязка homeworkId из scope
- [[TTS-читал-по-английски-голоса-Web-Speech-грузятся-асинхронно]] — озвучка читала немецкое английским голосом; `getVoices()` пуст на первом клике → фолбэк на системный дефолт; грей+кэшируй голоса, задавай явный de-DE

## API
- [[_changelog]] — API version history (per-module docs added as routes land)
