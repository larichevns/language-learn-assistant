---
tags: [spec, vocab, ai, ux]
date: 2026-06-14
status: implemented
---
<!-- Updated: 2026-06-14 | implemented (Stage A-E); tech-lead APPROVED. See [[_changelog]] -->
<!-- Updated: 2026-06-17 | обобщается в [[collection-grouping]]: VocabGroup сворачивается в доменную CollectionGroup (domain=VOCAB). Этот спек - исходный паттерн-источник. -->

> **Реализовано.** Миграция `20260614072451_vocab_grouping`; backend (`resolveGroupId` create-or-reuse + envelope groups-блок + CRUD), frontend (сгруппированный аккордеон + чип пути), 34 unit-теста. Уточнение к API ниже: `PATCH /api/vocabulary/[id]` сознательно оставлен **частичным редактором собственных полей слова** (предсуществующее поведение) с добавленным `groupId` - тело не сужено до `{groupId}`-only.

# Spec: Vocab Grouping (группа → подгруппа) с авто-раскладкой ИИ

## Description
Словарь сейчас плоский: `VocabEntry` (`prisma/schema.prisma:223`) имеет только `unitId` (урок) и `tagsJson` (плоские свободные теги, в UI даже не показываются). Иерархии нет, а envelope её и не показывает модели - в слой 02 идут только `lemma [cefr] - перевод` (`lib/ai/envelope/from-db.ts:110`, `lib/ai/envelope/layers.ts:157`). Из-за этого на просьбу «вспомни и добавь много слов по категориям» ассистент не может ни разложить слова, ни переиспользовать существующую категорию - и плывёт (реальный кейс: на запрос про еду открыл ответ словами `der Bahnhof`/`die Führung` из верха списка известных слов).

Фича вводит **двухуровневую иерархию группа → подгруппа** (пример: `Еда` → `Овощи`) как первоклассную реляционную сущность. При добавлении слов ассистент сам раскладывает каждое слово в группу/подгруппу: **переиспользует** существующую, если подходит, или **создаёт новую**. Это расширение принципа [[ИИ-дообогащает-и-сам-раскладывает-из-краткой-команды]] (auto-enrich + auto-route) добавлением **auto-group**, и замыкает «DB - это память» ([[5-слойный-context-engine-портирован-из-ToonyGamy]]): чтобы переиспользовать, а не плодить дубли, модель видит текущую таксономию групп прямо в envelope.

**Для кого:** учащийся (Никита) - русскоязычный, учит немецкий. Вторично - будущая навигация словаря по темам.

## Scope

**В V1:**
- Реляционная модель `VocabGroup` (self-ref, ровно 2 уровня) + `VocabEntry.groupId`.
- Миграция Prisma (существующие слова остаются `groupId = null` → «без группы»).
- Envelope показывает модели таксономию групп (для create-or-reuse) + группу у каждого известного слова.
- `propose` payload для `VOCAB_ENTRY` несёт группу/подгруппу (по имени и/или id); Apply-диспетчер делает **create-or-reuse** и проставляет `groupId`.
- Персона учит раскладывать и **переиспользовать** существующие группы.
- CRUD групп (API) + сгруппированный UI словаря + ручное создание/переименование/перенос слова.
- Карточка proposal показывает путь группы (`Еда → Овощи`) и помечает «новая группа».

**Вне V1 (→ [[post-mvp-backlog]]):**
- ИИ-**слияние** близких дублей групп (`Питание` ≈ `Еда`).
- Массовая ИИ-переразметка уже накопленного словаря (backfill-проход).
- Drag-and-drop переупорядочивание (в V1 - через меню/select).
- Группа как scope чата (оживление `VOCAB_LIST` scope на конкретную группу) - V1.1.
- Уровни глубже 2.

## User Stories
- As a **учащийся**, я пишу «вспомни и добавь Obst, Gemüse, Milchprodukte…», so that ассистент сам создаёт группу `Еда` с подгруппами `Фрукты`/`Овощи`/`Молочное`… и кладёт каждое слово в нужную подгруппу - без указания деталей мной.
- As a **учащийся**, добавляя одиночное слово «добавь Karotte», so that оно попадает в **уже существующую** подгруппу `Еда → Овощи`, а не в новый дубль `Овощи 2`.
- As a **учащийся**, я открываю словарь, so that вижу слова, сгруппированные по `группа → подгруппа` со счётчиками, и могу свернуть/развернуть раздел.
- As a **учащийся**, я вручную переименовываю группу `Еда`→`Питание` или переношу слово в другую подгруппу, so that держу таксономию в порядке.
- As a **учащийся**, я применяю карточку-предложение и вижу на ней путь `Еда → Овощи` и метку «новая группа», so that до Apply понимаю, куда и что ляжет.

## Data Model

### `VocabGroup` (новая модель)
| Column | Type (Prisma) | Nullable | Default | Constraints |
|--------|---------------|----------|---------|-------------|
| id | String | NO | `cuid()` | PK |
| userId | String | NO | - | FK → `User(id)` |
| parentId | String | YES | - | FK → `VocabGroup(id)` (self-ref); `null` = группа верхнего уровня, заполнен = подгруппа |
| name | String | NO | - | имя темы, напр. «Еда» / «Овощи» |
| nameNorm | String | NO | - | нормализованное имя для дедупа (`trim().toLowerCase()` от `name`) |
| emoji | String | YES | - | опц. иконка темы (UI-метаданные) |
| color | String | YES | - | опц. цвет (hex), UI |
| orderIndex | Int | NO | `0` | порядок в UI |
| createdAt | DateTime | NO | `now()` | |
| updatedAt | DateTime | NO | `@updatedAt` | |

**FK:**
- `userId → User(id) on delete cascade`
- `parentId → VocabGroup(id) on delete cascade` (удаление группы каскадно удаляет её подгруппы)

**Indexes / Unique:**
- `@@unique([userId, parentId, nameNorm])` - нет дублей имени в пределах одного родителя (регистронезависимо). У верхнего уровня `parentId = null`; Postgres трактует NULL в unique как различные, поэтому дедуп верхнего уровня дополнительно страхуется в коде find-first по `parentId: null`.
- `@@index([userId, parentId])` - выборка дерева.

**Relations (Prisma):**
```prisma
model VocabGroup {
  id        String   @id @default(cuid())
  userId    String
  parentId  String?
  name      String
  nameNorm  String
  emoji     String?
  color     String?
  orderIndex Int     @default(0)
  user      User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  parent    VocabGroup?  @relation("GroupTree", fields: [parentId], references: [id], onDelete: Cascade)
  children  VocabGroup[] @relation("GroupTree")
  entries   VocabEntry[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@unique([userId, parentId, nameNorm])
  @@index([userId, parentId])
}
```

### `VocabEntry` (изменение)
| Column | Type (Prisma) | Nullable | Default | Constraints |
|--------|---------------|----------|---------|-------------|
| groupId | String | YES | - | FK → `VocabGroup(id) on delete set null`. Указывает на **лист**: подгруппу, либо на группу верхнего уровня, если подгруппы нет |

- Добавить relation `group VocabGroup? @relation(...)` и `@@index([userId, groupId])`.
- `tagsJson` сохраняется как есть (свободные теги ортогональны группам).
- Существующие строки: `groupId = null` (миграция не бэкфиллит).

### `User` (изменение)
- Добавить обратную связь `vocabGroups VocabGroup[]`.

**Инвариант 2 уровней:** валидируется в коде (не в БД): у группы `parentId = null`; у подгруппы `parent.parentId` обязан быть `null`. Создание 3-го уровня → ошибка `422`.

## API

DTO/нейминг - camelCase, как в проекте ([[conventions]]). Авторизация - `requireUser()`.

| Method | Path | Body | Response | Codes |
|--------|------|------|----------|-------|
| GET | /api/vocabulary/groups | - | `GroupTree` (группы с подгруппами + счётчики) | 200 |
| POST | /api/vocabulary/groups | `CreateGroupDto` | `GroupNode` | 201, 400, 409, 422 |
| PATCH | /api/vocabulary/groups/[id] | `UpdateGroupDto` | `GroupNode` | 200, 400, 404, 409, 422 |
| DELETE | /api/vocabulary/groups/[id] | - | - | 204, 404 |
| GET | /api/vocabulary?groupId=&ungrouped= | - | `ListResponse` (фильтр по группе/подгруппе/без группы) | 200 |
| PATCH | /api/vocabulary/[id] | `{ groupId: string \| null }` (расширение) | `VocabEntry` | 200, 400, 404, 422 |

**Типы:**
```ts
type GroupNode = {
  id: string; name: string; emoji: string | null; color: string | null;
  orderIndex: number; wordCount: number;            // прямые слова листа
  children?: GroupNode[];                            // только у верхнего уровня
};
type GroupTree = { groups: GroupNode[]; ungroupedCount: number };

type CreateGroupDto = { name: string; parentId?: string | null; emoji?: string; color?: string };
type UpdateGroupDto = { name?: string; parentId?: string | null; emoji?: string; color?: string; orderIndex?: number };
```

**Ошибки:** `409` - дубль имени в пределах родителя (по `nameNorm`); `422` - нарушение 2-уровневости (родитель сам подгруппа) или `parentId` чужого пользователя; `404` - группа/слово не принадлежит пользователю (ownership через `where: { id, userId }`).

### `propose` tool (write-path модели) - изменение
`VocabEntryPayload` (`lib/ai/propose/tool.ts:74`) дополняется:
```ts
group:      z.string().nullish(),   // имя группы верхнего уровня, напр. "Еда"
subgroup:   z.string().nullish(),   // имя подгруппы, напр. "Овощи"
groupId:    z.string().nullish(),   // явный reuse, если модель взяла id из envelope
subgroupId: z.string().nullish(),   // явный reuse листа
```
Описание `payload` в `proposeToolDecl` дополняется инструкцией: «put each word into a broad `group` (e.g. "Еда") and a narrow `subgroup` (e.g. "Овощи"); **reuse** a group/subgroup shown in the Shared "Vocabulary groups" block (prefer its id) instead of creating a near-duplicate». Сервер по-прежнему толерантно валидирует ([[propose-Apply-500-на-вложенных-payload-из-за-формы-модели]]).

## Screens

### Vocabulary - `/vocabulary` (переработка `app/(app)/vocabulary/page.tsx`)
- **Displays:** аккордеон по `группа → подгруппа`; в каждом листе - текущая сетка карточек слов (`grid sm:2 lg:3`). Заголовок группы: `emoji name (N)`; подгруппа: `name (N)`. Отдельный раздел **«Без группы» (ungrouped)** внизу.
- **Actions:**
  - Свернуть/развернуть группу и подгруппу (состояние сворачивания - в `localStorage`).
  - «+ Группа» / «+ Подгруппа» (inline-форма: имя [+ родитель для подгруппы]).
  - На карточке слова - меню «Перенести в…» (select по дереву групп) → `PATCH /api/vocabulary/[id]`.
  - На заголовке группы - «Переименовать» / «Удалить» (с подтверждением).
  - Ручное добавление слова (текущая форма) - без обязательного выбора группы (ляжет в «Без группы», ассистент/пользователь раскидает позже).
- **States:** loading (spinner), empty (нет слов вообще → текущий empty-текст), partial (есть слова, но все «без группы» → показываем только этот раздел), error (тост + retry), success.

### Proposal card (расширение карточки `VOCAB_ENTRY` в Assistant Dock)
- Если payload несёт `group`/`subgroup` (или ids) - показываем чип пути `Еда → Овощи`.
- Метка «новая группа»/«новая подгруппа», если такого имени у пользователя ещё нет (определяется на клиенте по загруженному `GroupTree`, либо сервером в превью proposal).
- Apply/Refine/Discard - без изменений ([[Записи-это-proposals-единственный-путь-записи-Apply]]).

## Business Logic

### create-or-reuse (ядро, в Apply-диспетчере `lib/ai/propose/apply-db.ts`, case `VOCAB_ENTRY`)
1. Нормализация: `norm(s) = s.trim().toLowerCase()`; пустые/whitespace → трактуются как «не задано».
2. Резолв группы верхнего уровня:
   - если задан `groupId` → проверить принадлежность (`userId`, `parentId = null`); иначе игнор.
   - иначе по `group` имени → `findFirst({ userId, parentId: null, nameNorm })`; если нет - `create`.
3. Резолв подгруппы (лист) в пределах найденной группы:
   - если задан `subgroupId` → проверить (`userId`, `parent = группа из шага 2`).
   - иначе по `subgroup` имени → `findFirst({ userId, parentId: groupId, nameNorm })`; если нет - `create`.
4. `VocabEntry.groupId = subgroup?.id ?? group?.id ?? null` (лист = подгруппа, иначе сама группа, иначе без группы).
5. Всё внутри той же транзакции `tx`, что и upsert слова; **идемпотентно** (повторный Apply того же proposal → те же группы за счёт `find-first` + `@@unique`).
6. Существующее авто-зачисление SRS-карточек (`apply-db.ts:82`) не меняется.

### Валидация
- `name`: 1-60 символов после `trim`; не пустое.
- Глубина: ровно 2 уровня. `POST/PATCH` с `parentId`, у которого `parentId != null` → `422`.
- Перенос (`PATCH groups/[id]` со сменой `parentId`): группа верхнего уровня с детьми **не может** стать подгруппой (иначе появится 3-й уровень) → `422`.
- Дубль: `@@unique([userId, parentId, nameNorm])`; верхний уровень - доп. `find-first` по `parentId: null` перед create.

### AI integration (envelope + персона)
- **Envelope (`from-db.ts` + `layers.ts:formatShared`)**: в слой 02 добавляется блок **«Vocabulary groups»** - компактное дерево `группа → подгруппа (N)` с **id** каждого узла (чтобы модель могла вернуть `groupId`/`subgroupId` для точного reuse). Дополнительно у каждого слова в списке известных проставляется его подгруппа: `lemma [cefr] - перевод · Еда→Овощи`. Кап - в рамках `CAPS.SHARED`; при переполнении группы режутся по `orderIndex`/использованию (silent-trim, см. `caps.ts`). Слой 02 остаётся «CACHE B»: меняется только при изменении данных - допустимо.
- **Персона (`SYSTEM_PERSONA`, раздел «BE PROACTIVE: AUTO-ENRICH & ROUTE», `layers.ts:53`)**: добавить правило - «Каждое новое слово клади в широкую `group` и узкую `subgroup`. ПЕРЕИСПОЛЬЗУЙ группу/подгруппу из блока “Vocabulary groups”, если она подходит по смыслу (бери её id) - не плоди близкие дубли. Создавай новую группу/подгруппу только если ничего не подходит. Группа = широкая тема (Еда), подгруппа = узкая (Овощи)». Обновить [[ИИ-дообогащает-и-сам-раскладывает-из-краткой-команды]] после реализации.
- `reasoningEffort` для chat - без изменений (`low`, как в `lib/ai/features/templates.ts`).

### Permissions
- Все операции - только владелец (`userId` из сессии), ownership-проверка в каждом хендлере ([[conventions]]). Группы строго приватны (как и весь словарь).

## Edge Cases
- **Нет групп (первый раз):** `GroupTree.groups = []`, все слова в «Без группы». Envelope-блок «Vocabulary groups» пуст - модель создаёт группы с нуля.
- **Близкий дубль от модели** («Питание» при наличии «Еда»): минимизируется показом таксономии + правилом reuse в персоне. Если всё же создан - пользователь переименовывает/переносит вручную (слияние - в [[post-mvp-backlog]]).
- **Слово уже существует (`userId+lemma+pos`) и приходит CREATE с другой группой:** upsert обновляет поля, включая `groupId` → слово **переезжает** (last-write-wins, как и прочие поля сейчас).
- **Одноимённые подгруппы в разных группах** (`Овощи` под `Еда` и под `Сад`): разрешено - unique по `(userId, parentId, nameNorm)`.
- **Удаление группы:** каскадно удаляются подгруппы; у слов `groupId → null` (`on delete set null`) - слова не теряются, уходят в «Без группы». UI требует подтверждения с числом затронутых слов.
- **Перенос, ведущий к 3-му уровню / чужой родитель:** `422`, операция отклоняется.
- **API недоступно (UI):** мутации через react-query → тост об ошибке + сохранение оптимистично откатывается; список перезапрашивается.
- **Конкурентные правки:** last-write-wins, без оптимистичных блокировок (как в остальном приложении).
- **Переполнение envelope:** число групп/слов в слой 02 капается (`CAPS.SHARED`), режется тихо; модель всё равно может создать недостающее - корректность важнее полноты списка.
- **Миграция:** только DDL (новая таблица + nullable-колонка + FK), без бэкфилла; откат безопасен (drop колонки/таблицы), данные слов не трогаются.

## Priority / Dependencies
- **Priority:** P1 (улучшает hero-флоу добавления слов; не блокирует MVP, но снимает реальную боль).
- **Depends on:** [[architecture]] · [[5-слойный-context-engine-портирован-из-ToonyGamy]] · [[Записи-это-proposals-единственный-путь-записи-Apply]] · [[ИИ-дообогащает-и-сам-раскладывает-из-краткой-команды]]
- **Touches:** `prisma/schema.prisma` · `lib/ai/envelope/{from-db,layers,caps}.ts` · `lib/ai/propose/{tool,apply-db}.ts` · `app/api/vocabulary/**` · `app/(app)/vocabulary/page.tsx` · Assistant Dock proposal card
- **Blocks (future):** группа как scope чата (`VOCAB_LIST`), ИИ-слияние групп - оба в [[post-mvp-backlog]]
