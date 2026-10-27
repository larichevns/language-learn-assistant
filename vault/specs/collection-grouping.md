---
tags: [spec, grouping, ai, ux, grammar, notes]
date: 2026-06-17
status: implemented
---
<!-- Updated: 2026-06-17 | implemented; 133 unit-тестов зелёные, tech-lead APPROVED. Реализация по [[collection-grouping-implementation-plan]]; миграция `20260617070652_collection_grouping`. API: [[groups]]; решение: [[Одна-CollectionGroup-с-доменом-VOCAB-GRAMMAR-NOTE-VocabGroup-свёрнута-rename-миграцией]]; changelog: [[_changelog]]. -->

> **Реализовано.** Миграция-сворачивание `20260617070652_collection_grouping` (rename, не drop/recreate - 11 групп словаря сохранены, бэкфилнуты в `domain=VOCAB`); generic `/api/groups` + retire `/api/vocabulary/groups`; ИИ-цикл обобщён на грамматику и заметки (`resolveGroupId(domain)` + envelope-блок на домен); производная группировка домашки/упражнений; `grammar_explain` богаче + рендер `rulesJson`. «Как» - в [[collection-grouping-implementation-plan]].

# Spec: Collection Grouping - обобщение группировки на все вкладки + богаче грамматика

> **Обобщает** [[vocab-grouping]]. Шипнутая `VocabGroup` сворачивается в доменно-дискриминированную `CollectionGroup`, и тот же цикл «модель видит таксономию → предлагает с reuse → Apply create-or-reuse» включается для **грамматики** и **заметок**. Домашка и упражнения получают **производную** группировку (presentation-only, без новой таблицы и без ИИ-таксономии). Плюс - богаче вывод ИИ по грамматике.

## Description

Сейчас движок группировки жёстко привязан к словарю в **пяти швах**: таблица `VocabGroup` (`prisma/schema.prisma:284`) → загрузчик `from-db.ts` → envelope-блок `formatVocabGroups` (`layers.ts:168`) → Apply-резолвер `resolveGroupId` (`apply-db.ts:63`) → UI `components/vocabulary/*`. Остальные вкладки плоские: грамматика - сетка карточек (`app/(app)/grammar/page.tsx`), заметки - список (`app/(app)/notes/page.tsx`), домашка - список с бейджами статуса, упражнения - список сетов.

Фича поднимает каждый шов с «vocab» до **доменно-параметризованного**, сворачивает шипнутую `VocabGroup` в общую `CollectionGroup` (дискриминатор `domain`), и проводит **грамматику** и **заметки** через тот же ИИ-цикл, что и словарь: модель **видит** таксономию домена с токенами `{g:id}` в слое 02, **предлагает** group/subgroup, Apply **переиспользует или создаёт**. Это прямое расширение [[ИИ-дообогащает-и-сам-раскладывает-из-краткой-команды]] и замыкание «БД - это память» ([[5-слойный-context-engine-портирован-из-ToonyGamy]]) на новые домены.

**Домашка и упражнения** по своей природе организованы не таксономией, а статусом/датой (домашка) и темой-источником (упражнения), поэтому получают **производную** группировку - чистая презентация поверх существующих полей, без новой схемы, без ИИ. Это честный ответ на «то же самое ко всем вкладкам»: механизм адаптирован под природу каждой вкладки.

Вторая часть - **повысить объём информации ИИ по грамматике**: поднять reasoning effort для `grammar_explain`, переписать таск-аддендум на структурную глубину (правила, контраст ru↔de, примеры, подводные камни) и **починить рендер** - деталка грамматики сейчас принимает `rulesJson`, но не выводит его (`app/(app)/grammar/[id]/page.tsx`).

**Для кого:** учащийся (Никита) - русскоязычный, учит немецкий.

## Scope

**В V1:**
- Доменно-дискриминированная `CollectionGroup` (self-ref, 2 уровня) с enum `GroupDomain { VOCAB | GRAMMAR | NOTE }`.
- **Миграция-сворачивание** `VocabGroup → CollectionGroup` с **сохранением** существующих групп словаря (rename, не drop/recreate).
- `GrammarTopic.groupId`, `ClassNote.groupId`; `VocabEntry.groupId` перенаправлен на `CollectionGroup`.
- Общий сервис `lib/api/collection-groups.ts` + общие роуты `/api/groups` (параметр `domain`).
- ИИ-цикл обобщён: envelope рисует блок групп **на домен** с `{g:id}`; персона учит раскладывать слова **и темы грамматики, и заметки**; `GrammarTopicPayload`/`ClassNotePayload` несут group/subgroup; `resolveGroupId(domain)` - create-or-reuse с доменной проверкой.
- UI: сгруппированный аккордеон для **грамматики** и **заметок** (полная таксономия + CRUD + перенос); карточка proposal показывает путь группы для GRAMMAR_TOPIC/CLASS_NOTE.
- **Производная** группировка: домашка по статусу, упражнения по связанной теме грамматики.
- Грамматика богаче: `grammar_explain` effort `low→medium`; переписанный аддендум; рендер `rulesJson` на деталке.

**Вне V1 (→ [[post-mvp-backlog]]):**
- ИИ-**слияние** близких дублей групп (любого домена).
- **ИИ-описания** групп/тем (короткий авторский intro поверх раздела - опция C3, отложена).
- Полная ИИ-таксономия для домашки/упражнений (вместо производной).
- Drag-and-drop переупорядочивание.
- Группа как scope чата.
- Уровни глубже 2.
- Подъём effort для `tutor_chat` (оставляем `low` ради free-tier-бюджета).

## User Stories

- As **учащийся**, я пишу «запиши правило про Perfekt и разложи по темам», so that ассистент создаёт тему грамматики и сам кладёт её в группу `Времена → Прошедшее`, переиспользуя существующую группу, а не плодя дубль.
- As **учащийся**, добавляя заметку «конспект урока про падежи», so that она попадает в группу заметок `Грамматика → Падежи` (reuse), и я вижу заметки сгруппированными.
- As **учащийся**, я открываю грамматику/заметки, so that вижу темы/заметки по `группа → подгруппа` со счётчиками, сворачиваю разделы, переименовываю/переношу - ровно как в словаре.
- As **учащийся**, я открываю домашку, so that вижу её сгруппированной по статусу (`На проверку` / `Исправлено` / `Черновики` / `Архив`), а упражнения - по теме грамматики, к которой они привязаны.
- As **учащийся**, я открываю тему грамматики, so that вижу не только объяснение и примеры, но и **структурные правила** и контраст ru↔de - ИИ даёт заметно больше информации.
- As **учащийся**, после миграции, so that все мои существующие группы словаря на месте (ничего не потеряно).

## Data Model

### `GroupDomain` (новый enum)
`VOCAB | GRAMMAR | NOTE` - дискриминатор домена. Домашка/упражнения НЕ входят (у них производная группировка, не таблица).

### `CollectionGroup` (новая модель - обобщение `VocabGroup`)
| Column | Type (Prisma) | Nullable | Default | Constraints |
|--------|---------------|----------|---------|-------------|
| id | String | NO | `cuid()` | PK |
| userId | String | NO | - | FK → `User(id)` cascade |
| domain | GroupDomain | NO | - | дискриминатор |
| parentId | String | YES | - | FK → `CollectionGroup(id)` self-ref cascade; `null` = верхний уровень |
| name | String | NO | - | имя темы |
| nameNorm | String | NO | - | `trim().toLowerCase()` для дедупа |
| emoji | String | YES | - | UI |
| color | String | YES | - | UI (hex) |
| orderIndex | Int | NO | `0` | порядок UI |
| createdAt | DateTime | NO | `now()` | |
| updatedAt | DateTime | NO | `@updatedAt` | |

```prisma
enum GroupDomain { VOCAB GRAMMAR NOTE }

model CollectionGroup {
  id         String      @id @default(cuid())
  userId     String
  domain     GroupDomain
  parentId   String?     // null = top-level group; set = subgroup (2 levels, code-enforced)
  name       String
  nameNorm   String
  emoji      String?
  color      String?
  orderIndex Int         @default(0)
  user          User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  parent        CollectionGroup?  @relation("GroupTree", fields: [parentId], references: [id], onDelete: Cascade)
  children      CollectionGroup[] @relation("GroupTree")
  vocabEntries  VocabEntry[]
  grammarTopics GrammarTopic[]
  classNotes    ClassNote[]
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  @@unique([userId, domain, parentId, nameNorm])
  @@index([userId, domain, parentId])
}
```

**Unique:** `@@unique([userId, domain, parentId, nameNorm])` - `domain` добавлен к ключу vocab-версии. Верхний уровень (`parentId = null`) дополнительно страхуется find-first в коде (Postgres трактует NULL как различные).

### Изменения в сущностях
- `VocabEntry.groupId` - **перенаправить** relation на `CollectionGroup` (семантика та же: `onDelete: SetNull`, `@@index([userId, groupId])`). Без миграции данных - те же id.
- `GrammarTopic.groupId String?` **(новое)** → `CollectionGroup` `SetNull` + `@@index([userId, groupId])`. `category` (enum) **остаётся** - он ортогонален (см. Business Logic).
- `ClassNote.groupId String?` **(новое)** → `CollectionGroup` `SetNull` + `@@index([userId, groupId])`.
- `User.vocabGroups` → переименовать обратную связь в `collectionGroups CollectionGroup[]`.

### Миграция (hand-authored, не дефолтный Prisma drop/recreate)
Цель - **сохранить** существующие группы словаря.
```sql
-- 1) enum
CREATE TYPE "GroupDomain" AS ENUM ('VOCAB','GRAMMAR','NOTE');
-- 2) rename таблицы + self-FK/constraint имена
ALTER TABLE "VocabGroup" RENAME TO "CollectionGroup";
-- 3) колонка домена с дефолтом для существующих строк
ALTER TABLE "CollectionGroup" ADD COLUMN "domain" "GroupDomain" NOT NULL DEFAULT 'VOCAB';
-- 4) пересобрать unique с доменом
DROP INDEX  "VocabGroup_userId_parentId_nameNorm_key";
CREATE UNIQUE INDEX "CollectionGroup_userId_domain_parentId_nameNorm_key"
  ON "CollectionGroup"("userId","domain","parentId","nameNorm");
CREATE INDEX "CollectionGroup_userId_domain_parentId_idx"
  ON "CollectionGroup"("userId","domain","parentId");
-- 5) новые nullable-колонки + FK + индексы
ALTER TABLE "GrammarTopic" ADD COLUMN "groupId" TEXT;
ALTER TABLE "ClassNote"    ADD COLUMN "groupId" TEXT;
-- FK на CollectionGroup ON DELETE SET NULL (+ rename FK словаря)
```
Откат: обратный rename + drop колонок/enum. Данные слов/тем/заметок не трогаются.

## API

DTO - camelCase ([[conventions]]). Авторизация - `requireUser()`. Все операции - только владелец (`where: { userId }`).

| Method | Path | Body | Response | Codes |
|--------|------|------|----------|-------|
| GET | /api/groups?domain= | - | `GroupTree` | 200, 400 (bad domain) |
| POST | /api/groups | `CreateGroupDto` (+`domain`) | `GroupNode` | 201, 400, 409, 422 |
| PATCH | /api/groups/[id] | `UpdateGroupDto` | `GroupNode` | 200, 400, 404, 409, 422 |
| DELETE | /api/groups/[id] | - | - | 204, 404 |
| PATCH | /api/grammar/[id] | `{ groupId: string\|null }` (расширение) | `GrammarTopic` | 200, 404, 422 |
| PATCH | /api/notes/[id] | `{ groupId: string\|null }` (расширение) | `ClassNote` | 200, 404, 422 |
| GET | /api/exercises | - (расширить) | items + `grammarTopic:{title}` | 200 |

- **`lib/api/collection-groups.ts`** (обобщение `vocab-groups.ts`): доменно-нейтральные `GroupNode`/`GroupTree`/`CreateGroupDto`/`UpdateGroupDto`, `normGroupName`, и общая логика дерева/create/update(2-level+dedup)/delete, параметризованная `domain`.
- **`/api/vocabulary/groups`**: перенаправить страницу словаря на `/api/groups?domain=VOCAB` (две строки в `vocabulary/page.tsx`) ИЛИ оставить тонкой обёрткой. Рекомендация - перенаправить (завершить консолидацию).

### `propose` tool (write-path модели) - изменение
`GrammarTopicPayload` и `ClassNotePayload` (`lib/ai/propose/tool.ts`) дополняются теми же полями, что у vocab:
```ts
group:      z.string().nullish(),
subgroup:   z.string().nullish(),
groupId:    z.string().nullish(),
subgroupId: z.string().nullish(),
```
Inline-описание `payload` в `proposeToolDecl` дополняется: для GRAMMAR_TOPIC/CLASS_NOTE «положи в `group`/`subgroup`; reuse из соответствующего блока (`## Grammar groups` / `## Note groups`) - копируй `{g:id}` ИМЕННО из блока своего домена». Толерантная валидация сохраняется ([[propose-Apply-500-на-вложенных-payload-из-за-формы-модели]]).

## Screens

### Grammar - `/grammar` (полная таксономия)
- Сетка карточек → **аккордеон `группа → подгруппа`**; лист - карточка темы (title + category badge + CEFR + mastery bar). Раздел «Без группы» внизу. CRUD групп; меню «Перенести в…» на карточке темы.
- States: loading/empty/partial(все без группы)/error/success - как в словаре.

### Notes - `/notes` (полная таксономия)
- Список → аккордеон `группа → подгруппа`; лист - карточка заметки (title + preview). Раздел «Без группы». CRUD + перенос.

### Homework - `/homework` (производная, по статусу)
- Презентационный аккордеон по бакетам статуса: `На проверку` (SUBMITTED/STRUCTURED), `Исправлено` (CORRECTED), `Черновики` (DRAFT), `Архив` (ARCHIVED). Без CRUD, без ИИ, без envelope-блока.

### Exercises - `/exercises` (производная, по теме)
- Аккордеон по связанной теме грамматики (`grammarTopicId` → title) + бакет «Прочее/Вручную» по `sourceType`. Лист - карточка сета. Требует `grammarTopic.title` в ответе списка.

### Grammar detail - `/grammar/[id]` (богаче вывод)
- **Добавить карточку «Правила»** между объяснением и примерами: каждый `rule` + его немецкие `examples` (с `SpeakButton`). Сейчас `rulesJson` принимается, но не рендерится - это и есть починка.

### Proposal card (Assistant Dock)
- `components/assistant/proposal-group-path.tsx` - включить чип пути `группа → подгруппа` и метку «новая группа» также для GRAMMAR_TOPIC/CLASS_NOTE (сейчас только VOCAB_ENTRY).

### Generic UI
- `components/vocabulary/{group-section,group-dialogs,use-vocab-collapse,types}` поднять в `components/groups/*` как общий `GroupedAccordion` (items + render-prop листа + collapse-hook по ключу домена) + диалоги CRUD. `WordCard` остаётся vocab; добавить `GrammarTopicCard`/`NoteCard`.

## Business Logic

### create-or-reuse (ядро) - `resolveGroupId(tx, userId, domain, p)` в `apply-db.ts`
Обобщение текущего `resolveGroupId` (`apply-db.ts:63`): добавляется параметр `domain`, все запросы к `CollectionGroup` фильтруются `where: { domain }`. Логика та же:
1. Норм: `norm(s)=trim().toLowerCase()`; пустое → «не задано».
2. Топ-группа: `groupId` (проверка `userId`+`domain`+`parentId=null`) → иначе по имени find-first(`domain`,`parentId:null`,`nameNorm`) → иначе create.
3. Подгруппа (лист) в пределах топа: `subgroupId` (проверка принадлежности и `parent=топ`) → иначе по имени → иначе create.
4. `entity.groupId = sub?.id ?? top?.id ?? null`.
5. В той же транзакции; идемпотентно (find-first + `@@unique`).
Вызовы: `VOCAB_ENTRY`→`domain VOCAB`, `GRAMMAR_TOPIC`→`GRAMMAR`, `CLASS_NOTE`→`NOTE`.

### Ортогональность `category` vs `groupId` (грамматика)
`GrammarTopic.category` (enum) - **системная** классификация: используется error-mapping и строкой mastery в envelope (`from-db.ts`/`layers.ts:221`). `groupId` - **просматриваемая** таксономия (напр. `Времена → Прошедшее`). Они сосуществуют; ИИ при предложении темы задаёт **оба** (`category` + `group`/`subgroup`) и может засеять топ-группу из имени категории. `groupId` НЕ заменяет `category`.

### Валидация (как в vocab-grouping)
- `name` 1-60 после trim; глубина ровно 2 (родитель-подгруппа → 422); перенос топа-с-детьми в подгруппу → 422; дубль по `(userId,domain,parentId,nameNorm)` (+find-first для топа) → 409; чужой/иного домена `parentId` → 422.

### Грамматика богаче (Ask 2, лёгкий путь)
- `lib/ai/features/templates.ts`: `grammar_explain.reasoningEffort` `low → medium` (1024 → 8192 thinking-токенов). **Только** grammar_explain; `tutor_chat` остаётся `low` (free-tier).
- `FEATURE_ADDENDA.grammar_explain` (`layers.ts:100`): требовать структуру - ясный `explanationRu`; **3-5 `rules`** каждое с немецкими примерами; контраст **ru↔de**, вплетённый в объяснение/подводные камни; **3+ `examples`** (de/ru/highlight); **2-3 `pitfalls`** для русскоязычных.
- Рендер `rulesJson` на деталке (см. Screens).

### AI integration (envelope + персона)
- **Envelope** (`from-db.ts` + `layers.ts`): загрузить `CollectionGroup` по всем доменам одним запросом → передать массивы на домен в `SharedInput`. Обобщить `formatVocabGroups → formatGroups(label, groups)`; рисовать `## Vocabulary groups` / `## Grammar groups` / `## Note groups`, каждый с `{g:id}`. Аннотировать темы грамматики путём группы (как vocab-слова). Капы - `CAPS.*_GROUPS` (или общий `CAPS.GROUPS`), silent-trim.
- **Персона** (`SYSTEM_PERSONA`, `layers.ts:65`): обобщить правило «GROUP every word…» → «раскладывай каждое слово **и тему грамматики, и заметку** в группу→подгруппу СВОЕГО домена; reuse `{g:id}` из блока этого домена». Статический префикс меняется однократно - ок для кэша.
- Домашка/упражнения - **без** envelope-блока групп (производная группировка чисто UI).

### Permissions
- Всё - только владелец; ownership в каждом хендлере. Доменная проверка в резолвере не даёт vocab-id просочиться в grammar-payload.

## Edge Cases
- **Cross-domain id:** модель вставила vocab `{g:id}` в grammar-payload → доменная проверка в `resolveGroupId` отвергает id, падает в name-create (или ungrouped). Группа чужого домена не переиспользуется.
- **Миграция:** rename сохраняет группы словаря; новые колонки nullable, без backfill; откат безопасен.
- **Пусто (первый раз):** блок групп домена пуст → модель создаёт с нуля.
- **Близкий дубль от модели:** минимизируется показом таксономии + reuse-правилом; иначе - ручное переименование (слияние в backlog).
- **Тема/заметка уже существует, приходит CREATE с другой группой:** last-write-wins (как vocab).
- **Удаление группы:** каскад подгрупп; у сущностей `groupId → null` (SetNull) - не теряются, уходят в «Без группы». UI требует подтверждения с числом затронутых.
- **Домашка/упражнения:** производные бакеты пусты, если нет статуса/темы → элемент в «Прочее».
- **Free-tier cost:** `medium` для grammar_explain дороже; ограничено одной фичей; мониторить usage.
- **Переполнение envelope:** блоки на домен капаются независимо, трейлинг-топы режутся первыми (как vocab).

## Priority / Dependencies
- **Priority:** P1 (расширяет hero-флоу на все домены; снимает реальную боль навигации).
- **Depends on:** [[architecture]] · [[vocab-grouping]] · [[5-слойный-context-engine-портирован-из-ToonyGamy]] · [[Записи-это-proposals-единственный-путь-записи-Apply]] · [[ИИ-дообогащает-и-сам-раскладывает-из-краткой-команды]]
- **Touches:** `prisma/schema.prisma` + миграция · `lib/ai/envelope/{from-db,layers,caps}.ts` · `lib/ai/propose/{tool,apply-db}.ts` · `lib/ai/features/templates.ts` · `lib/api/collection-groups.ts` · `app/api/groups/**` · `app/api/{grammar,notes,exercises}/**` · `app/(app)/{grammar,notes,homework,exercises}/**` · `components/groups/*` · `components/assistant/proposal-group-path.tsx`
- **Blocks (future):** ИИ-слияние групп, ИИ-описания тем, полная таксономия домашки/упражнений, группа как scope - все в [[post-mvp-backlog]]
