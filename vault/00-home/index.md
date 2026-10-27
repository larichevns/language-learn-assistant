---
tags: [home, index]
date: 2026-06-13
---

# LanguageLearnAssistant Knowledge Vault

AI tutor for a Russian speaker learning German. Single Next.js app. Master blueprint: `PLAN.md`.

## Atlas (Architecture)
- [[architecture]] - system layers + the 5-layer AI context engine + propose/Apply
- [[stack]] - technology stack with rationale
- [[database]] - Prisma/Postgres schema overview
- [[conventions]] - code, API, DB, AI-lib, i18n standards
- [[dependency-graph]] - module dependency map
- [[deploy]] - deployment process (to fill)

## Specs
- [[mvp-scope-and-phases]] - approved MVP scope, hero feature, the phases + verification evidence
- [[phase-5-adaptive-learning-loop]] - make the tutor truly adaptive + retention/journal/export (research-backed spec - the "what/why")
- [[phase-5-implementation-plan]] - Phase 5 solution design: schema deltas, the closed loop (`recordAttempt`), BKT/decay/FSRS, focus-block, 10 build slices, test plan (the "how")
- [[phase-6-design-directions]] - 3 distinct visual directions + market analysis (prototypes in `design/wireframes/`)
- [[phase-7-design-implementation]] - chosen: Direction B gently-muted + centered Google-style assistant; ui-tester verified
- [[vocab-grouping]] - двухуровневая иерархия словаря (группа→подгруппа) + авто-раскладка ИИ (create-or-reuse); status: implemented (обобщается в [[collection-grouping]])
- [[collection-grouping]] - обобщение группировки на все вкладки (CollectionGroup, домены VOCAB/GRAMMAR/NOTE) + производная группировка домашки/упражнений + богаче грамматика; status: implemented (the "what/why")
- [[collection-grouping-implementation-plan]] - solution design: схема-дельта + hand-authored fold-in миграция, доменный движок групп, обобщение ИИ-цикла, generic GroupedAccordion, build-слайсы + тест-план (the "how")
- [[mobile-responsive-fixes]] - мобильный адаптив: устранение горизонтального переполнения (frontend-only, mobile-first); status: draft - на ревью
- [[SPEC_TEMPLATE]] - template for new feature specs

## Knowledge

### Business
- [[post-mvp-backlog]] - everything deferred past the MVP (do not drop silently)

### Decisions
- [[5-слойный-context-engine-портирован-из-ToonyGamy]]
- [[Записи-это-proposals-единственный-путь-записи-Apply]]
- [[ИИ-дообогащает-и-сам-раскладывает-из-краткой-команды]]
- [[Один-Next.js-проект-вместо-отдельного-AI-сервиса]]
- [[Gemini-free-tier-через-провайдер-абстракцию]]
- [[Локальная-инфра-Docker-Postgres-плюс-in-memory-guards]]
- [[Тема-UI-спокойная-индиго-бирюза]]
- [[i18n-с-первого-дня-дефолт-русский]]
- [[Fable только в solution-designer и tech-lead-reviewer]] - agent model strategy
- [[Язык-ответа-выводится-из-nativeLang-а-не-хардкодится]] - response language is data-driven, not hardcoded in the persona
- [[Loop-записи-обходят-propose-Apply-это-derived-state]] - Phase 5 loop writes (Attempt/BKT/FSRS/timeline/rollup) write directly; they're derived state from the learner's own grades, not model proposals
- [[Одна-CollectionGroup-с-доменом-VOCAB-GRAMMAR-NOTE-VocabGroup-свёрнута-rename-миграцией]] - одна generic-таблица групп на 3 домена + fold-in rename-миграция (gotcha: Prisma-migrate сгенерировал бы DROP/CREATE) + домашка/упражнения как производная группировка
<!-- Updated: 2026-07-05 | entryDate + markdown-notes decisions -->
- [[entryDate-это-пользовательская-дата-записи-отдельная-от-createdAt-сортировка-на-клиенте]] - пользовательская дата записи (notes/homework/exercises), отдельная от createdAt; клиентский сорт-тогл, серверный orderBy и ИИ-конверт не тронуты; словарь вне скоупа
- [[react-markdown-без-rehype-raw-это-санитайзер-заметок-редактор-остаётся-textarea]] - Заметки как markdown-блокнот: react-markdown без rehype-raw = санитайзер (сырой HTML инертен); редактор остаётся textarea (немецкая панель жива); Домашка - вариант задачи через копию

### Scenarios / Integrations / Patterns
- [[PWA-офлайн-SW-кэширует-чтения-IndexedDB-outbox-копит-записи]] - офлайн ревью из SW-кэша + очередь грейдов в IndexedDB, флаш при возврате связи (без Background Sync - ради iOS)
- [[вложенные-Radix-аккордеоны-делят-одно-localStorage-состояние-через-merge]] - сгруппированный словарь: один массив open-id на два уровня аккордеона, scope+merge вместо replace
- [[автогрост-textarea-и-вставка-умлаутов-в-курсор]] - семейство «удобного письма»: автогрост-`Textarea`, `Composer`, панель немецких умлаутов (вставка в курсор через `onMouseDown`+`preventDefault`)
<!-- Updated: 2026-07-05 | per-tab search + native date-input patterns -->
- [[клиентский-поиск-по-вкладке-SearchInput-фильтр-до-группировки]] - переиспользуемый `SearchInput` на всех 5 вкладках; фильтр-мемо стоит ДО группировки (счётчики групп сходятся); клиентский, только по загруженной странице (≤100)
- [[нативный-input-type-date-вместо-датапикера-якорь-на-локальный-полдень-против-сдвига-дня]] - `EntryDateInput`: нативный date-инпут без датапикер-зависимости; полдень локального дня против TZ-сдвига; 16px против iOS-зума

### Debugging
- [[propose-Apply-500-на-вложенных-payload-из-за-формы-модели]] - Apply 500 для HOMEWORK_CORRECTION/EXERCISE_SET; модель эмитит неканоничную форму → толерантные `z.preprocess` + привязка homeworkId из scope
- [[TTS-читал-по-английски-голоса-Web-Speech-грузятся-асинхронно]] - озвучка читала немецкое английским голосом; `getVoices()` пуст на первом клике → фолбэк на системный дефолт; грей+кэшируй голоса, задавай явный de-DE
- [[оборванный-ответ-оставляет-висящий-user-турн-модель-отвечает-на-старое]] - после обрыва стрима тред кончается висящим user-турном; на след. запросе он склеивается с новым и модель отвечает на старое → билдер срезает хвостовые user-турны + роут пишет ассистента только при непустом тексте
- [[чат-это-стол-БД-это-память-rolling-summary-написан-но-не-вызывается]] - суммаризация треда была написана, но мертва; **активирована 2026-06-17** как rolling-summary (фон после каждого ответа, не биллится) → контекст за пределами последних 12 реплик больше не теряется
- [[мобильная-шторка-меню-зажата-в-высоту-топбара-backdrop-blur-создаёт-containing-block-для-fixed]] - мобильное меню обрезалось в 64px и текст наезжал на страницу: `backdrop-filter` топбара делает его containing-block для `fixed` → оверлей зажат в шапку. Фикс - `createPortal` оверлея в `body`. Та же сессия: контраст бордюров/теней, `Composer` стал белым «листом»
<!-- Updated: 2026-07-05 | word-card overflow root cause -->
- [[w-auto-у-Select-триггера-убивает-line-clamp-1-длинный-лейбл-распирает-карточку]] - `line-clamp-1` мёртв без ограниченной ширины: `w-auto` у Select-триггера на карточке слова давал длинному лейблу группы распирать `CardContent` (гориз. переполнение); фикс `w-full min-w-0 max-w-[11rem]` + `flex-wrap`

## API
- [[_changelog]] - API version history (per-module docs added as routes land)
- [[groups]] - `/api/groups` generic collection grouping (domain-parametrized: VOCAB/GRAMMAR/NOTE; replaces `/api/vocabulary/groups`)
