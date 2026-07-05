---
tags: [decision, adr, database, notes, homework, exercises]
date: 2026-07-05
---

# entryDate — пользовательская дата записи, отдельная от системных createdAt/updatedAt; сортировка на клиенте

**Решение.** Добавили редактируемое пользователем поле **`entryDate`** на `ClassNote`,
`Homework`, `ExerciseSet` — «*моя* дата этой записи», в отличие от системных
`createdAt`/`updatedAt` (момент физического создания/правки строки, пользователю не
принадлежит). Словарь (`VocabEntry`) в скоуп **не входит**.

## Схема (миграция `20260705064520_add_entry_date_notes_homework_exercises`)
- `entryDate DateTime @default(now())` на всех трёх таблицах — дефолт = момент создания,
  поэтому старый код/API, которые про дату не знают, ничего не ломают.
- `@@index([userId, entryDate])` на каждой (готово под серверную сортировку, если понадобится).
- **Бэкфилл существующих строк — на историческую дату, не на момент миграции**
  (hand-authored SQL): `ClassNote.entryDate = COALESCE(lessonDate, createdAt)`,
  `Homework`/`ExerciseSet` = `createdAt`. Потерь данных 0.

## `lessonDate` НЕ трогали — это другая семантика
У `ClassNote` остаётся `lessonDate DateTime?` — «день урока». `entryDate` — «моя дата записи».
Это разные вещи (конспект урока от 3-го можно завести 5-го), поэтому `entryDate` **добавлен
рядом**, а не переиспользовал `lessonDate`. При бэкфилле `lessonDate` взят как лучший
доступный сигнал исторической даты (через `COALESCE`), но поля остаются независимыми. См.
[[database]].

## API — правки даты идут прямым CRUD (не propose/Apply)
- `entryDate` принимается на `POST` **и** `PATCH /api/notes`, и на `POST /api/homework`.
- **NEW** `PATCH /api/homework/[id]` — тело `{ title?, entryDate? }`, **намеренно узкое**:
  lifecycle коррекции (`status`/`rawInput`/`structuredJson`) из этого generic-PATCH запечатан.
- **NEW** `PATCH /api/exercises/[id]` — тело `{ entryDate? }` (только дата; тоже мимо lifecycle).
- `PATCH /api/notes/[id]` заодно **починен**: явный `title: null` теперь **очищает** заголовок
  (трёхзначная логика `d.title === undefined ? undefined : d.title` — absent/null/value), а не
  игнорируется.

Почему прямой CRUD, а не гейт propose→Apply: это **пользователь правит метаданные своей же
записи**, модель не участвует — тот же класс, что group-move `PATCH` и записи адаптивного
цикла ([[Loop-записи-обходят-propose-Apply-это-derived-state]]). Гейт
[[Записи-это-proposals-единственный-путь-записи-Apply]] защищает от *модели*, а не от владельца.

## Сортировка — только на клиенте, серверный `orderBy` не трогаем
Новый `components/ui/sort-toggle.tsx` (`SortToggle`) переключает `recent ↔ entryDate`. Сорт —
**клиентский мемо**, стоящий сразу после фильтра поиска
([[клиентский-поиск-по-вкладке-SearchInput-фильтр-до-группировки]]) и до группировки. Дефолт —
`recent` (порядок сервера, как было). Ни один GET `orderBy` на бэке не изменён.

## Порядок в ИИ-конверте — вне скоупа (сознательно)
`lib/ai/envelope/from-db.ts` **не тронут**: конверт по-прежнему сортирует по `updatedAt`
(и `dueAt`/`lapses`/`attemptedAt` для SRS), **никогда не по `entryDate`**. Пользовательская
дата — презентационная сортировка списков, она не должна двигать то, что видит модель.

## Отложено ([[post-mvp-backlog]])
`entryDate` для словаря; персист режима сортировки (localStorage); `Homework.noteId` бэклинк
на исходную заметку; удаление ставшего лишним `lessonDate` из тел POST/PATCH `/api/notes`.

## Связано
- [[database]] · [[_changelog]]
- [[нативный-input-type-date-вместо-датапикера-якорь-на-локальный-полдень-против-сдвига-дня]] — как это редактируется в UI
- [[клиентский-поиск-по-вкладке-SearchInput-фильтр-до-группировки]] — фильтр, за которым идёт этот сорт
- [[react-markdown-без-rehype-raw-это-санитайзер-заметок-редактор-остаётся-textarea]]
