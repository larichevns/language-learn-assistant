---
tags: [decision, database, grouping, ai, migration]
date: 2026-06-17
---

# Одна CollectionGroup с доменом VOCAB|GRAMMAR|NOTE; VocabGroup свёрнута rename-миграцией

**Решение.** Вместо отдельной таблицы групп на каждый домен - **одна generic-таблица `CollectionGroup`** (self-ref, 2 уровня) с дискриминатором `domain GroupDomain { VOCAB | GRAMMAR | NOTE }`. Шипнутая `VocabGroup` **сворачивается** в неё **rename-миграцией с сохранением строк**, а не drop/recreate. Тот же ИИ-цикл «модель видит таксономию → предлагает с reuse → Apply create-or-reuse» включается для грамматики и заметок. Реализовано: [[collection-grouping]] (обобщение [[vocab-grouping]]), миграция `20260617070652_collection_grouping`.

**Почему одна таблица, а не три.** Механика группировки идентична во всех доменах (group→subgroup, `nameNorm`-дедуп, 2-уровневый инвариант, create-or-reuse, envelope-блок с `{g:id}`). Три таблицы = тройное дублирование схемы, роутов, резолвера, UI и тестов ради одного учащегося. `domain` в ключе `@@unique([userId, domain, parentId, nameNorm])` + `@@index([userId, domain, parentId])` даёт изоляцию доменов бесплатно: `VOCAB`-«Еда» и `GRAMMAR`-«Еда» сосуществуют как разные строки. Работа свелась к **параметризации по домену**, а не к изобретению новой механики.

**Изоляция доменов структурная, не на проверках.** В `resolveGroupId(tx, userId, domain, p)` (`apply-db.ts`) `domain` входит в каждый `where` к `CollectionGroup`. Поэтому vocab-`{g:id}`, вставленный моделью в grammar-payload, **не находится** (`findFirst({ id, userId, domain: 'GRAMMAR' })` → null) и падает в name-create или ungrouped - id не просачивается между доменами без отдельного кода. Это headline edge-case спеки, закрытый одной колонкой в ключе (тест D1).

## Gotcha: Prisma-migrate сгенерировал бы деструктивный DROP/CREATE

`prisma migrate dev` диффит схему к shadow-БД и переименование таблицы видит как **пару**:
```sql
DROP TABLE "VocabGroup";
CREATE TABLE "CollectionGroup" (...);
```
- что **удалило бы все существующие группы словаря** (у учащегося их было 11). Поэтому миграция **написана руками**, не сгенерирована:
1. Правим `schema.prisma` к целевому виду (`VocabGroup`→`CollectionGroup` + `domain` + `groupId` на `GrammarTopic`/`ClassNote`).
2. Создаём папку миграции и пустой `migration.sql` руками.
3. Пишем SQL: `CREATE TYPE "GroupDomain"` → `ALTER TABLE "VocabGroup" RENAME TO "CollectionGroup"` (строки целы) → переименовать PK/FK-идентификаторы → `ADD COLUMN "domain" … DEFAULT 'VOCAB'` затем `DROP DEFAULT` (старые строки бэкфилятся в VOCAB, у новых дефолта нет - как в Prisma) → пересобрать unique/index с `domain` → repoint FK `VocabEntry` → additive nullable `groupId` + FK + index на `GrammarTopic`/`ClassNote`.
4. Применяем **`prisma migrate deploy`** (накатывает pending verbatim, без повторного диффа) - **никогда `migrate dev` для этой миграции** - затем `prisma generate`.
5. Гейт: `migrate status` «up to date» + `migrate diff` пустой + row-count `CollectionGroup` == pre-migration `VocabGroup`. Снапшот БД до. Откат недеструктивен (обратный rename + drop nullable-колонок/enum; данные слов/тем/заметок не трогаются).

Это та же дисциплина, что и для raw-SQL шагов Phase 5 (напр. unique-change `SrsCard`). Подтверждено на scratch-БД: 0 drift, все строки сохранены, `domain` бэкфилнут в VOCAB. Это самый высокорисковый шаг фичи; владелец гейта - `database-architect`, перепроверяет `tech-lead-reviewer` (критическая зона: миграция + целостность данных).

## Связанное решение: домашка/упражнения - производная группировка, не таблица

Полную таксономию (своя таблица + ИИ-раскладка) получают **только** vocab/grammar/notes. **Домашка и упражнения** организованы по своей природе не таксономией, а **статусом** (домашка) и **темой-источником** (упражнения), поэтому получают **производную, презентационную** группировку:
- домашка - бакеты по `Homework.status` (`На проверку`/`Исправлено`/`Черновики`/`Архив`), чисто на клиенте;
- упражнения - бакеты по связанной `grammarTopicId` (+ «Прочее/Вручную» по `sourceType`), для чего `GET /api/exercises` лишь дообогащён `grammarTopic.title` + `sourceType`.

**Никакой** новой таблицы, `CollectionGroup`-строк, envelope-блока или ИИ-таксономии для них. Это честный ответ на «то же самое ко всем вкладкам»: механизм адаптирован под природу каждой вкладки, а не натянут силой. Полная ИИ-таксономия для домашки/упражнений - в [[post-mvp-backlog]], если когда-нибудь понадобится.

## Применение
- Схема/миграция: `prisma/schema.prisma` (`CollectionGroup` + `GroupDomain`, `groupId` на `GrammarTopic`/`ClassNote`), `prisma/migrations/20260617070652_collection_grouping`.
- Резолвер: `resolveGroupId(tx, userId, domain, p)` в `lib/ai/propose/apply-db.ts`; контракт/константы - `lib/api/collection-groups.ts`.
- Envelope: блок групп **на домен** (`## Vocabulary/Grammar/Note groups`) в `lib/ai/envelope/{from-db,layers}.ts`; общий `CAPS.GROUPS` (900, на домен).
- Это прямое расширение [[ИИ-дообогащает-и-сам-раскладывает-из-краткой-команды]] (auto-group теперь на 3 домена) и замыкание «БД - это память» ([[5-слойный-context-engine-портирован-из-ToonyGamy]]) на новые домены.

## Related
- [[collection-grouping]] · [[collection-grouping-implementation-plan]] · [[vocab-grouping]]
- [[ИИ-дообогащает-и-сам-раскладывает-из-краткой-команды]] · [[Записи-это-proposals-единственный-путь-записи-Apply]] · [[5-слойный-context-engine-портирован-из-ToonyGamy]]
- [[database]] · [[groups]] · [[post-mvp-backlog]]
