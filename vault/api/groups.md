---
tags: [api, groups, grouping, taxonomy]
date: 2026-06-17
---

# API: `/api/groups` — generic collection grouping

Domain-parametrized CRUD for the two-level taxonomy (`group → subgroup`) shared by **vocab, grammar and notes**. Generalizes the retired `/api/vocabulary/groups` by adding a `domain` discriminator. Spec: [[collection-grouping]] · design: [[collection-grouping-implementation-plan]] · the pattern it generalizes: [[vocab-grouping]].

All routes: auth via `requireUser()`; **owner-only** (`where: { userId }`); standard `{ code, message, data }` envelope. Every query is scoped by `domain`, so a `VOCAB` "Еда" and a `GRAMMAR` "Еда" are different rows. Shared DTOs + constants + the `normGroupName` dedup helper live in `lib/api/collection-groups.ts`; route logic is collocated in the handlers (`app/api/groups/route.ts`, `app/api/groups/[id]/route.ts`) — matching the project's route-collocated shape.

## Domain

`?domain=VOCAB | GRAMMAR | NOTE` — the `GroupDomain` enum (homework/exercises are **not** here — they use derived presentational grouping, no table; see [[collection-grouping]]). Validated by `parseDomain()`; bad/missing → `400`. On `GET`/`POST` it comes from the query/body; on `PATCH`/`DELETE` it is **derived from the row** (the id already pins the domain).

## Endpoints

| Method | Path | Body | Response | Codes |
|--------|------|------|----------|-------|
| GET | `/api/groups?domain=` | — | `GroupTree` | 200, 400 (bad domain) |
| POST | `/api/groups` | `CreateGroupDto & { domain }` | `GroupNode` | 201, 400, 409, 422 |
| PATCH | `/api/groups/[id]` | `UpdateGroupDto` | `GroupNode` | 200, 400, 404, 409, 422 |
| DELETE | `/api/groups/[id]` | — | `{ id, deleted: true }` | 200, 404 |

> **Note:** `DELETE` returns `200 { id, deleted: true }` (not `204`) for consistency with the existing vocab/grammar/note DELETE handlers — carried over from [[vocab-grouping]].

### `GET /api/groups?domain=VOCAB`
Returns the full tree for the domain in one shot: top groups with nested `children` + per-leaf **direct** item counts, plus the ungrouped count.
- `itemCount` is **direct items only** (rows whose `groupId` === this node) — a parent does NOT sum its children.
- `ungroupedCount` = the domain's item model (`vocabEntry` / `grammarTopic` / `classNote`, via the `ITEM_MODEL` map) where `groupId IS NULL`.
- `_count` keys off `COUNT_RELATION[domain]` (`vocabEntries` / `grammarTopics` / `classNotes`).

### `POST /api/groups`
Creates a top group (`parentId` null/absent) or a subgroup. Invariants enforced in code:
- **2-level depth:** a subgroup's `parentId` must reference an **owned, same-domain, TOP** group; pointing at a subgroup → `422`. A foreign or wrong-domain `parentId` → `422`.
- **Top-level dedup** is guarded by an explicit `findFirst` on `parentId: null` (Postgres treats `NULL parentId` as distinct, so `@@unique([userId, domain, parentId, nameNorm])` won't catch it); duplicate within the same parent → `409`.

### `PATCH /api/groups/[id]`
Rename / recolor / reorder / move. Loads the row by `{ id, userId }`, reads its `domain`, then scopes every dedup/parent lookup to that domain. Move guards (mirroring [[vocab-grouping]]):
- self-parent → `422`; new parent must be owned + same-domain + TOP (else `422`);
- a group **that has children** cannot become a subgroup (would create a 3rd level) → `422`;
- rename/move dedup within the target parent (excluding self) → `409`;
- missing/foreign id → `404`.

### `DELETE /api/groups/[id]`
`deleteMany({ where: { id, userId } })`. The DB **cascades** subgroups and **SET NULLs** items across all three relations (`VocabEntry` / `GrammarTopic` / `ClassNote`) → affected items fall back to "ungrouped", never deleted. Missing/foreign → `404`.

## DTOs (camelCase, [[conventions]])

```ts
type GroupDomainStr = 'VOCAB' | 'GRAMMAR' | 'NOTE';

type GroupNode = {
  id: string;
  name: string;
  emoji: string | null;
  color: string | null;
  orderIndex: number;
  itemCount: number;        // DIRECT items on this leaf (domain-neutral; was wordCount)
  children?: GroupNode[];   // present on top-level nodes only
};

type GroupTree = { groups: GroupNode[]; ungroupedCount: number };

type CreateGroupDto = { name: string; parentId?: string | null; emoji?: string; color?: string };
type UpdateGroupDto = { name?: string; parentId?: string | null; emoji?: string; color?: string; orderIndex?: number };
type MoveItemDto    = { groupId: string | null };   // body of the item-PATCH move (was MoveVocabDto)
```

Validation (zod, in the handlers): `name` 1–60 after trim; `emoji` ≤ 8; `color` `^#[0-9a-fA-F]{6}$`.

## Item-PATCH extensions (move an item into a group)

The leaf-move stays on each item's own endpoint (domain-checked: the target group must be owned **and** of the matching domain, else `422`). These remain **partial editors of their own fields** — the body is NOT narrowed to `{ groupId }`-only (predeclared behavior, carried from [[vocab-grouping]]). `null` un-groups.

| Method | Path | Body (extension) | Domain check |
|--------|------|------------------|--------------|
| PATCH | `/api/vocabulary/[id]` | `{ groupId: string \| null }` | `VOCAB` |
| PATCH | `/api/grammar/[id]` | `{ groupId: string \| null }` | `GRAMMAR` |
| PATCH | `/api/notes/[id]` | `{ groupId: string \| null }` | `NOTE` |

## Derived grouping (no endpoint)

`GET /api/exercises` was enriched (`grammarTopicId`, `sourceType`, `grammarTopic: { title }`) so the Exercises page can bucket sets by their linked grammar topic — **read enrichment only**, no group table, no AI. Homework is bucketed client-side by `status`. See [[collection-grouping]].

## Related
- [[collection-grouping]] · [[collection-grouping-implementation-plan]] · [[vocab-grouping]]
- [[Одна-CollectionGroup-с-доменом-VOCAB-GRAMMAR-NOTE-VocabGroup-свёрнута-rename-миграцией]]
- [[_changelog]] · [[database]] · [[conventions]]
