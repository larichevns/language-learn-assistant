---
tags: [pattern, frontend, radix, accordion, vocab]
date: 2026-06-14
---

# Вложенные Radix-аккордеоны делят одно localStorage-состояние через merge

Сгруппированный словарь (`app/(app)/vocabulary/page.tsx`) — двухуровневый аккордеон: группы верхнего уровня и подгруппы внутри. Состояние «что развёрнуто» персистится в `localStorage` одним плоским массивом id ([[useVocabCollapse]] → `components/vocabulary/use-vocab-collapse.ts`, ключ `lla:vocab:open-groups`).

## Грабли
`@radix-ui/react-accordion` с `type="multiple"` — это **независимые корни**. Вложенный `<Accordion>` (подгруппы) знает только про id своих `AccordionItem`. Если передать ему общий массив `value={open}` и общий `onValueChange={setOpen}`, то при тоггле подгруппы Radix вернёт в `onValueChange` **только id подгрупп этой группы** — и `setOpen` затрёт все id групп верхнего уровня и открытые подгруппы соседних групп. Видимо как «развернул подгруппу → все остальные схлопнулись».

## Решение — scope + merge (в `components/vocabulary/group-section.tsx`)
- Внешний корень (страница) владеет всем массивом `open`.
- Вложенному корню даём **отфильтрованное** значение (только id детей этой группы) и handler, который **сливает** назад:

```ts
const childIds = new Set(children.map((c) => c.id));
const childOpen = open.filter((id) => childIds.has(id));
const onChildOpenChange = (next: string[]) =>
  onOpenChange([...open.filter((id) => !childIds.has(id)), ...next]);
```

Принцип общий для любых вложенных Radix-аккордеонов на одном источнике состояния: **каждому корню — его срез, наружу — merge, а не replace**.

## Связанное
- Примитивы shadcn (`accordion`/`dialog`/`select`) добавлены под `components/ui/` (Radix-зависимости в `package.json`); стилевые отклонения темы (`rounded-2xl`, `border-border`) задаются через `className` на месте вызова, сами примитивы не правим.
- [[conventions]] (one component per file, ≤250 строк; `cn()` только при слиянии условных классов).
