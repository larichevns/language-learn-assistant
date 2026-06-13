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
- [[phase-5-adaptive-learning-loop]] — make the tutor truly adaptive + retention/journal/export (research-backed)
- [[phase-6-design-directions]] — 3 distinct visual directions + market analysis (prototypes in `design/wireframes/`)
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

### Scenarios / Integrations / Debugging / Patterns
- (to fill as we build)

## API
- [[_changelog]] — API version history (per-module docs added as routes land)
