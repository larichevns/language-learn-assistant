---
tags: [spec, grouping, ai, ux, grammar, notes, design, implementation-plan]
date: 2026-06-17
status: draft — design ready to build
---

# Collection Grouping — Solution Design & Implementation Plan

> The **what/why** lives in [[collection-grouping]]; the pattern it generalizes is [[vocab-grouping]] (already shipped, migration `20260614072451_vocab_grouping`). This is the **how**: the exact schema delta + hand-authored fold-in migration, the domain-parametrized group engine, the AI-loop generalization across `from-db`/`layers`/`caps`/`tool`/`apply-db`, the generic `GroupedAccordion` UI + the four reworked pages, the grammar-depth bump, ordered build slices with agent assignments, a test plan mapped to the spec's invariants, and a blast-radius/risk table. No stubs — every section is buildable as written. File refs are confirmed against the current code.

---

## 0. The two decisions that frame everything (LOCKED — do not relitigate)

1. **One generic table, `VocabGroup` folded in.** `VocabGroup` becomes `CollectionGroup` with a `domain GroupDomain { VOCAB | GRAMMAR | NOTE }` discriminator, via a **hand-authored rename migration that preserves every existing row** (existing vocab groups get `domain = VOCAB`). Prisma-migrate will NOT generate a rename — it diffs to `DROP TABLE "VocabGroup"` + `CREATE TABLE "CollectionGroup"`, which would delete the user's groups. We author the SQL by hand (§1.3). This is the single highest-risk step in the whole feature (§8).

2. **Full taxonomy for vocab/grammar/notes; derived presentation for homework/exercises.** Grammar + Notes run the *entire* vocab loop (envelope block with `{g:id}` → persona rule → `propose` group/subgroup payload → `resolveGroupId(domain)` create-or-reuse → grouped accordion UI). Homework groups by `status` buckets and Exercises by linked `grammarTopicId` — **presentation only**: no new table, no AI taxonomy, no envelope block, no `CollectionGroup` rows. `GrammarTopic.category` (the system enum that feeds error-mapping + the mastery block) stays; `groupId` is an **orthogonal** browsable taxonomy that coexists with it.

These mirror the live vocab implementation exactly; the work is *parametrizing by domain*, not inventing new mechanics.

---

## 1. Data model — exact Prisma delta + the fold-in migration

### 1.1 Final Prisma (schema.prisma)

**New enum** (place next to `GrammarCategory`, before/after the existing grouping model):

```prisma
enum GroupDomain {
  VOCAB
  GRAMMAR
  NOTE
}
```

**Rename `VocabGroup` → `CollectionGroup`** (was lines ~284–304), add `domain`, widen relations:

```prisma
// Generic two-level taxonomy (group → subgroup) shared by vocab, grammar and notes.
// Self-referencing; the 2-level invariant is enforced in code, not the DB. Shown to
// the model in envelope layer 02 PER DOMAIN so it can create-or-reuse, not duplicate.
model CollectionGroup {
  id         String      @id @default(cuid())
  userId     String
  domain     GroupDomain                     // discriminator (VocabGroup rows backfill to VOCAB)
  parentId   String?     // null = top-level group; set = subgroup
  name       String
  nameNorm   String      // normalized name for dedup (trim().toLowerCase())
  emoji      String?     // optional UI icon
  color      String?     // optional UI color (hex)
  orderIndex Int         @default(0)

  user          User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  parent        CollectionGroup?  @relation("GroupTree", fields: [parentId], references: [id], onDelete: Cascade)
  children      CollectionGroup[] @relation("GroupTree")
  vocabEntries  VocabEntry[]
  grammarTopics GrammarTopic[]
  classNotes    ClassNote[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([userId, domain, parentId, nameNorm])   // domain ADDED to the vocab key
  @@index([userId, domain, parentId])
}
```

**`VocabEntry`** (line ~228 / ~256): the column stays `groupId String?`; only the relation target name changes — same id values, same `SetNull`, same `@@index([userId, groupId])`:

```prisma
  group VocabGroup?  →  group CollectionGroup? @relation(fields: [groupId], references: [id], onDelete: SetNull)
```

**`GrammarTopic`** (model ~385–409) — add the orthogonal `groupId`; `category` is untouched:

```prisma
  groupId String?
  // ...
  group   CollectionGroup? @relation(fields: [groupId], references: [id], onDelete: SetNull)
  // ...
  @@index([userId, groupId])
```

**`ClassNote`** (model ~570–588) — add `groupId` the same way:

```prisma
  groupId String?
  // ...
  group   CollectionGroup? @relation(fields: [groupId], references: [id], onDelete: SetNull)
  // ...
  @@index([userId, groupId])
```

**`User`** (line 35) — rename the back-relation:

```prisma
  vocabGroups    VocabGroup[]   →   collectionGroups CollectionGroup[]
```

> **Unique-key note (carried from vocab-grouping, still true):** `@@unique([userId, domain, parentId, nameNorm])` dedups subgroups, but Postgres treats `NULL parentId` as distinct, so **top-level dedup is additionally guarded by a `findFirst` in code** (both in the route handler and in `resolveGroupId`). The `domain` segment means a `VOCAB` "Еда" and a `GRAMMAR` "Еда" coexist as different rows — exactly what we want.

### 1.2 The Prisma-migrate gotcha (why this migration is hand-authored)

`prisma migrate dev` compares the schema to the shadow DB and will emit, for the table rename, a destructive pair:

```sql
DROP TABLE "VocabGroup";
CREATE TABLE "CollectionGroup" (...);
```

That drops every existing vocab group. **Do not run `migrate dev` to generate this migration.** Instead:

1. Edit `schema.prisma` to the §1.1 target.
2. Create the migration folder + empty file by hand:
   `prisma/migrations/20260617HHMMSS_collection_grouping/migration.sql`
3. Write the SQL in §1.3 by hand.
4. Apply with **`prisma migrate deploy`** (applies pending migrations verbatim; never re-diffs), then `prisma generate`.
5. Verify drift: `prisma migrate status` reports "up to date" and `prisma migrate diff --from-schema-datamodel ... --to-schema-datasource ...` is empty. (`database-architect` owns this gate — see §6 Slice 0.)

This is the same discipline used for the Phase 5 raw-SQL steps; the project already hand-tunes migrations (e.g. the `SrsCard` unique change in `phase5_adaptive_loop`).

### 1.3 The hand-authored migration SQL

Constraint/index names below are the **actual** names from the shipped `20260614072451_vocab_grouping/migration.sql` (confirmed). A Postgres `ALTER TABLE ... RENAME TO` keeps the rows and auto-updates the *referenced-table* side of FKs, but does **not** rename the constraint/index *identifiers*, and the self-FK still resolves to the renamed table. We rename identifiers explicitly for cleanliness and so the next `migrate diff` is empty.

```sql
-- ── 1) Domain enum ──────────────────────────────────────────────────────────
CREATE TYPE "GroupDomain" AS ENUM ('VOCAB', 'GRAMMAR', 'NOTE');

-- ── 2) Rename the table (PRESERVES ALL ROWS) ────────────────────────────────
ALTER TABLE "VocabGroup" RENAME TO "CollectionGroup";

-- Rename the PK + FK + index identifiers the rename left behind (cosmetic but
-- keeps `prisma migrate diff` empty afterwards). Names are from the vocab migration.
ALTER TABLE "CollectionGroup" RENAME CONSTRAINT "VocabGroup_pkey"        TO "CollectionGroup_pkey";
ALTER TABLE "CollectionGroup" RENAME CONSTRAINT "VocabGroup_userId_fkey"   TO "CollectionGroup_userId_fkey";
ALTER TABLE "CollectionGroup" RENAME CONSTRAINT "VocabGroup_parentId_fkey" TO "CollectionGroup_parentId_fkey";

-- ── 3) Domain column with a default so existing rows become VOCAB ───────────
ALTER TABLE "CollectionGroup" ADD COLUMN "domain" "GroupDomain" NOT NULL DEFAULT 'VOCAB';
-- Drop the default so the column is "required, no default" to match Prisma (new rows must set it).
ALTER TABLE "CollectionGroup" ALTER COLUMN "domain" DROP DEFAULT;

-- ── 4) Rebuild unique + index WITH domain ───────────────────────────────────
DROP INDEX "VocabGroup_userId_parentId_nameNorm_key";
DROP INDEX "VocabGroup_userId_parentId_idx";
CREATE UNIQUE INDEX "CollectionGroup_userId_domain_parentId_nameNorm_key"
  ON "CollectionGroup" ("userId", "domain", "parentId", "nameNorm");
CREATE INDEX "CollectionGroup_userId_domain_parentId_idx"
  ON "CollectionGroup" ("userId", "domain", "parentId");

-- ── 5) Repoint VocabEntry's FK name (column + values unchanged) ─────────────
ALTER TABLE "VocabEntry" RENAME CONSTRAINT "VocabEntry_groupId_fkey" TO "VocabEntry_groupId_fkey_tmp";
ALTER TABLE "VocabEntry" DROP CONSTRAINT "VocabEntry_groupId_fkey_tmp";
ALTER TABLE "VocabEntry" ADD CONSTRAINT "VocabEntry_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "CollectionGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- (The rename in step 2 already retargets the existing FK to the renamed table;
--  the drop+add is belt-and-suspenders to guarantee the reference name resolves
--  to "CollectionGroup" identically to a fresh Prisma migration. If your Postgres
--  already shows the FK referencing "CollectionGroup", steps 5's drop/add is a no-op equivalent.)

-- ── 6) New nullable groupId columns + indexes + FKs (additive, no backfill) ──
ALTER TABLE "GrammarTopic" ADD COLUMN "groupId" TEXT;
ALTER TABLE "ClassNote"    ADD COLUMN "groupId" TEXT;

CREATE INDEX "GrammarTopic_userId_groupId_idx" ON "GrammarTopic" ("userId", "groupId");
CREATE INDEX "ClassNote_userId_groupId_idx"    ON "ClassNote"    ("userId", "groupId");

ALTER TABLE "GrammarTopic" ADD CONSTRAINT "GrammarTopic_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "CollectionGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClassNote" ADD CONSTRAINT "ClassNote_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "CollectionGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

> **Pragmatic simplification.** Step 5's drop/add can be omitted if you confirm (via `\d "VocabEntry"` in psql on the shadow DB after the rename) that the FK already references `"CollectionGroup"`. Postgres retargets it on table rename. Keep the explicit drop/add only if `migrate diff` complains. Either way the self-FK `CollectionGroup_parentId_fkey` correctly references the renamed table with no action beyond the constraint-name rename in step 2.

### 1.4 Rollback

Reverse order, equally non-destructive to row data:

```sql
ALTER TABLE "ClassNote"    DROP CONSTRAINT "ClassNote_groupId_fkey";
ALTER TABLE "GrammarTopic" DROP CONSTRAINT "GrammarTopic_groupId_fkey";
DROP INDEX "ClassNote_userId_groupId_idx";
DROP INDEX "GrammarTopic_userId_groupId_idx";
ALTER TABLE "ClassNote"    DROP COLUMN "groupId";
ALTER TABLE "GrammarTopic" DROP COLUMN "groupId";

DROP INDEX "CollectionGroup_userId_domain_parentId_idx";
DROP INDEX "CollectionGroup_userId_domain_parentId_nameNorm_key";
CREATE UNIQUE INDEX "VocabGroup_userId_parentId_nameNorm_key" ON "CollectionGroup"("userId","parentId","nameNorm");
CREATE INDEX "VocabGroup_userId_parentId_idx" ON "CollectionGroup"("userId","parentId");
ALTER TABLE "CollectionGroup" DROP COLUMN "domain";
ALTER TABLE "CollectionGroup" RENAME TO "VocabGroup";   -- rows intact
-- rename constraints back; DROP TYPE "GroupDomain";
```

Vocab/grammar/note row data is never touched. `GrammarTopic.groupId` / `ClassNote.groupId` are nullable and unbackfilled, so dropping them loses nothing real.

---

## 2. The generic group engine

### 2.1 `lib/api/collection-groups.ts` (generalizes `lib/api/vocab-groups.ts`)

The current `vocab-groups.ts` is **types + `normGroupName` only** (route logic lives in the handlers). We promote it to a domain-parametrized module and keep the proven contract. `GroupNode`/`GroupTree`/`CreateGroupDto`/`UpdateGroupDto` are already domain-neutral in shape — only `wordCount` reads vocab-specific.

```ts
import type { GroupDomain } from '@prisma/client';

export type GroupDomainStr = 'VOCAB' | 'GRAMMAR' | 'NOTE';

export type GroupNode = {
  id: string;
  name: string;
  emoji: string | null;
  color: string | null;
  orderIndex: number;
  itemCount: number;          // RENAMED from wordCount → domain-neutral (direct items on this leaf)
  children?: GroupNode[];     // top-level only
};
export type GroupTree = { groups: GroupNode[]; ungroupedCount: number };

export type CreateGroupDto = { name: string; parentId?: string | null; emoji?: string; color?: string };
export type UpdateGroupDto = {
  name?: string; parentId?: string | null; emoji?: string; color?: string; orderIndex?: number;
};
export type MoveItemDto = { groupId: string | null };   // was MoveVocabDto

/** Single source of truth for group-name dedup normalization (routes + apply-db). */
export const normGroupName = (s: string): string => s.trim().toLowerCase();

/** Which relation holds the per-leaf count, per domain — used by the GET tree builder. */
export const COUNT_RELATION: Record<GroupDomainStr, 'vocabEntries' | 'grammarTopics' | 'classNotes'> = {
  VOCAB: 'vocabEntries',
  GRAMMAR: 'grammarTopics',
  NOTE: 'classNotes',
};

/** The Prisma model delegate whose rows carry groupId, per domain (for ungrouped counts). */
export type DomainItemModel = 'vocabEntry' | 'grammarTopic' | 'classNote';
export const ITEM_MODEL: Record<GroupDomainStr, DomainItemModel> = {
  VOCAB: 'vocabEntry', GRAMMAR: 'grammarTopic', NOTE: 'classNote',
};

export function parseDomain(v: string | null): GroupDomainStr | null {
  return v === 'VOCAB' || v === 'GRAMMAR' || v === 'NOTE' ? v : null;
}
```

**Renaming fallout — `wordCount` → `itemCount`:** the field is referenced in `components/vocabulary/{types.ts:14, group-section.tsx:61/134/147, group-dialogs (DeleteTarget.wordCount)}` and the route GET. Because the vocab page is being promoted to the generic component anyway (§4), this rename happens as part of that promotion — no orphaned references. `totalWords()`/`flattenGroupOptions()` move into the generic component's helpers (`components/groups/types.ts`) renamed to `totalItems()`.

> **Decision:** keep service logic as **route-collocated helpers** rather than a fat service class, matching the existing project shape (the vocab routes inline their logic). `collection-groups.ts` stays a *contract + constants* module; the create/update/delete/tree logic lives in the `/api/groups` handlers (§2.2) so we don't fight the established pattern. The one thing that MUST be shared (and is, already) is `normGroupName`.

### 2.2 `/api/groups` route handlers (generalize `/api/vocabulary/groups`)

New files, parametrized by `?domain=`:

- `app/api/groups/route.ts` — `GET` (tree for a domain) + `POST` (create top/subgroup in a domain)
- `app/api/groups/[id]/route.ts` — `PATCH` (rename/recolor/move/reorder) + `DELETE`

They are a near-mechanical copy of the two vocab handlers with three changes: (a) read+validate `domain` from the query (POST/GET) or derive it from the row (PATCH/DELETE), (b) every `prisma.vocabGroup.*` → `prisma.collectionGroup.*` with `domain` in the `where`, (c) the `_count` select keys off `COUNT_RELATION[domain]`.

**`GET /api/groups?domain=VOCAB`** (mirrors `vocabulary/groups/route.ts:25-65`):

```ts
const domain = parseDomain(new URL(req.url).searchParams.get('domain'));
if (!domain) return handleApiError(new ApiError('invalid_input', 'Bad or missing domain', 400));
const countSel = { [COUNT_RELATION[domain]]: true } as const;     // dynamic _count key

const [rows, ungroupedCount] = await Promise.all([
  prisma.collectionGroup.findMany({
    where: { userId: user.userId, domain },
    orderBy: [{ orderIndex: 'asc' }, { name: 'asc' }],
    select: { id:true, name:true, emoji:true, color:true, orderIndex:true, parentId:true,
              _count: { select: countSel } },
  }),
  // ungrouped count: the domain's item model where groupId is null
  (prisma[ITEM_MODEL[domain]] as any).count({ where: { userId: user.userId, groupId: null } }),
]);
const itemCount = (r) => r._count[COUNT_RELATION[domain]];
// …same tops/children tree assembly as today, emitting GroupNode with itemCount…
```

**`POST /api/groups`** — body `CreateGroupDto & { domain }`. The 2-level invariant, the top-level `findFirst` dedup (NULL-parent), and the 409/422 codes are **identical** to `vocabulary/groups/route.ts:67-110`; every group query just adds `domain` to the `where` (including the parent-ownership check: a subgroup's parent must be owned, top-level, **and same domain**).

**`PATCH /api/groups/[id]`** — load the row by `{ id, userId }` selecting `domain, parentId, nameNorm, _count.children`; thereafter every dedup/parent lookup is scoped to that **row's** `domain`. The move-creates-3rd-level guard and the dup checks are copied verbatim from `vocabulary/groups/[id]/route.ts:26-114`, `+ domain` in each `where`.

**`DELETE /api/groups/[id]`** — `deleteMany({ where: { id, userId } })`; DB cascades subgroups and `SetNull`s items (→ ungrouped) across all three relations.

**Retiring `/api/vocabulary/groups`:** repoint the vocab page to `/api/groups?domain=VOCAB` (two lines in `app/(app)/vocabulary/page.tsx:27` and the proposal chip's query in `proposal-group-path.tsx:36`), then **delete** `app/api/vocabulary/groups/route.ts` + `.../[id]/route.ts`. Recommendation: delete, don't keep a thin wrapper — finishing the consolidation is the point, and the only two callers are ours. The `PATCH /api/vocabulary/[id]` group-move endpoint **stays** (it's the vocab leaf-move; grammar/notes get their own — §2.3).

### 2.3 Extend the three item-PATCH endpoints

Mirror the **exact** pattern already in `app/api/vocabulary/[id]/route.ts` — a separate `MoveGroup` zod parse plus the provided/null/undefined tri-state, and an ownership check that the target group is owned **and of the right domain**:

```ts
// the vocab template (vocabulary/[id]/route.ts):
const MoveGroup = z.object({ groupId: z.string().nullable().optional() });
// …
const groupIdProvided = move.data.groupId !== undefined;
const nextGroupId = move.data.groupId ?? null;
if (groupIdProvided && nextGroupId !== null) {
  const grp = await prisma.collectionGroup.findFirst({
    where: { id: nextGroupId, userId, domain: 'VOCAB' }, select: { id: true },
  });
  if (!grp) throw new ApiError('invalid_input', 'Group not found', 422);
}
// update: { groupId: groupIdProvided ? nextGroupId : undefined }
```

- **`PATCH /api/grammar/[id]`** (`app/api/grammar/[id]/route.ts:23-45`): today it parses `GrammarTopicPayload.partial()` and `updateMany({ where:{id,userId}, data })`. Add the `MoveGroup` parse + `domain:'GRAMMAR'` ownership check, fold `groupId` into the `data` with the tri-state. Response stays the full topic.
- **`PATCH /api/notes/[id]`** (`app/api/notes/[id]/route.ts:25-44`): same, `domain:'NOTE'`.
- These remain **partial editors of their own fields** (predeclared behavior, same as vocab) — the body is NOT narrowed to `{groupId}`-only. (Carry the vocab-grouping clarification forward.)

### 2.4 Extend `GET /api/exercises` (derived grouping needs the topic title)

`app/api/exercises/route.ts:24` currently selects only `_count.items`. The Exercises page groups by linked topic, so the list must expose it:

```ts
// add to the findMany select/include for the list:
grammarTopicId: true,
sourceType: true,
grammarTopic: { select: { title: true } },   // → response item.grammarTopic?.title
```

Response stays `successResponse(listResult(items, total, p))`. No new model, no envelope change — pure read enrichment.

---

## 3. AI loop generalization (the critical path's payoff)

Five seams, each lifted from "vocab" to "per-domain". Vocab stays behaviorally identical; grammar+notes get the same treatment; homework+exercises get nothing here (derived).

### 3.1 `lib/ai/envelope/from-db.ts` — one query, per-domain `SharedInput`

Today `from-db.ts:113-117` loads `prisma.vocabGroup.findMany` for VOCAB only and passes `groups` to `formatShared`. Change to **one query across all three domains**, split in JS:

```ts
// replaces the single vocabGroups query in the Promise.all (line ~113):
prisma.collectionGroup.findMany({
  where: { userId },
  orderBy: [{ orderIndex: 'asc' }, { name: 'asc' }],
  select: {
    id: true, name: true, parentId: true, domain: true,
    _count: { select: { vocabEntries: true, grammarTopics: true, classNotes: true } },
  },
}),
```

Then build three arrays (count picks the matching relation per domain):

```ts
type GNode = { id: string; name: string; parentId: string | null; count: number };
const pick = (d: GroupDomain, rel: 'vocabEntries'|'grammarTopics'|'classNotes'): GNode[] =>
  collGroups.filter((g) => g.domain === d)
            .map((g) => ({ id: g.id, name: g.name, parentId: g.parentId, count: g._count[rel] }));

const vocabGroups   = pick('VOCAB',   'vocabEntries');
const grammarGroups = pick('GRAMMAR', 'grammarTopics');
const noteGroups    = pick('NOTE',    'classNotes');
```

Pass all three into `formatShared` (extend `SharedInput`, §3.2). Also annotate **grammar topics with their group path** (same as vocab words today at `from-db.ts:82` / `:141`): add `group: { select: { name:true, parent:{ select:{ name:true } } } }` to the `grammarTopics` findMany select, and surface `groupPath` on each grammar topic passed to `formatShared`.

`ClassNote` is **not** in the shared envelope today (notes never were), and we keep it that way for the cached layer — the **note group taxonomy** is shown (so the model can reuse note groups when proposing a CLASS_NOTE), but we do not dump note bodies. The note-group block renders whenever `noteGroups` is non-empty.

### 3.2 `lib/ai/envelope/layers.ts` — `formatGroups(label, groups)` + per-domain blocks + persona + addendum

**(a) Generalize the renderer.** Rename `formatVocabGroups` (lines 168-189) to a label-parametrized `formatGroups`:

```ts
function formatGroups(
  label: string,                       // "Vocabulary" | "Grammar" | "Note"
  groups: GNode[] | undefined,
  cap: number,                         // CAPS.GROUPS (shared) — see §3.3
): string {
  if (!groups?.length) return '';
  const tops = groups.filter((g) => g.parentId === null);
  if (!tops.length) return '';
  const childrenOf = (id: string) => groups.filter((g) => g.parentId === id);
  const line = (indent: string, g: GNode) => `${indent}- ${sanitize(g.name)} {g:${g.id}} (${g.count})`;
  const header = `## ${label} groups (reuse these — do NOT duplicate)`;
  // …identical trailing-tops-drop accumulation as today, capped at `cap`…
}
```

**(b) `SharedInput` gains two arrays** (keep `groups` as the vocab one for the smallest diff, or rename all three — recommend renaming for symmetry):

```ts
export interface SharedInput {
  profile: {...};
  vocab: Array<{ lemma; pos?; translationRu?; cefrLevel?; mastery?; groupPath? }>;
  grammarTopics: Array<{ title; category?; bucket?; groupPath? }>;   // + groupPath
  vocabGroups?: GNode[];     // was `groups`
  grammarGroups?: GNode[];   // NEW
  noteGroups?: GNode[];      // NEW
}
```

**(c) Emit the blocks** inside `formatShared`. Vocab groups stay BEFORE the vocab list (so the model reuses while reading words). Grammar groups render just before the `## Grammar mastery` block; note groups after it. Each grammar topic line in `## Grammar mastery` gets the same `· path` annotation the vocab lines already get (`layers.ts:214` pattern):

```ts
const vBlock = formatGroups('Vocabulary', input.vocabGroups, CAPS.GROUPS);
if (vBlock) lines.push(vBlock);
// …vocab list…
const gBlock = formatGroups('Grammar', input.grammarGroups, CAPS.GROUPS);
if (gBlock) lines.push(gBlock);
// …grammar mastery list, each line `- <grammar_title>… · <path>`…
const nBlock = formatGroups('Note', input.noteGroups, CAPS.GROUPS);
if (nBlock) lines.push(nBlock);
```

**(d) Persona rule** (`SYSTEM_PERSONA`, the AUTO-ENRICH bullet at `layers.ts:65-69`). Generalize "GROUP every word" to all three taxonomy domains, and make the **same-domain reuse** explicit (this is what stops a vocab `{g:id}` leaking into a grammar payload):

```
- GROUP every saved item into a broad `group` and a narrow `subgroup` of ITS OWN domain:
  a word → a Vocabulary group, a grammar topic → a Grammar group, a class note → a Note group.
  REUSE a group/subgroup shown in the matching Shared block ("Vocabulary groups" / "Grammar
  groups" / "Note groups") when it fits — pass its `{g:id}` as `groupId`/`subgroupId`. COPY the
  id ONLY from the block of the SAME domain (never paste a Vocabulary id into a grammar topic).
  Create a new group/subgroup ONLY when nothing fits.
```

This is one edit to the static prefix — fine for the cache (changes once).

**(e) Addendum rewrite** (`FEATURE_ADDENDA.grammar_explain`, `layers.ts:100-101`) — see §5.

### 3.3 `lib/ai/envelope/caps.ts` — one shared `GROUPS` cap

Today: `VOCAB_GROUPS: 1200`. With three taxonomies competing inside the same `CAPS.SHARED` (3000) budget, a per-domain hard cap of 1200 each could blow `SHARED`. Choice:

- **Recommended (simple):** replace `VOCAB_GROUPS` with a single `GROUPS: 900` applied independently to each domain block; the final `capText(..., CAPS.SHARED)` in `formatShared` remains the hard backstop that trims trailing content (grammar/note blocks render after vocab, so vocab survives first — matches the established "correctness over completeness" trim order). Update the one reference in `formatVocabGroups`/`formatGroups` and the test's `CAPS.VOCAB_GROUPS` → `CAPS.GROUPS`.
- Alternative: keep three named caps. Not worth the surface area for one learner.

```ts
export const CAPS = {
  UNIT: 6000, SCOPE: 2500, THREAD_SUMMARY: 4000, TURN: 2000,
  SHARED: 3000, FOCUS: 2000,
  GROUPS: 900,            // was VOCAB_GROUPS: 1200 — now per-domain, ×3 fits under SHARED
} as const;
```

### 3.4 `lib/ai/propose/tool.ts` — payload fields + the description string

**(a) Add the four routing fields to `GrammarTopicPayload` (line ~98) and `ClassNotePayload` (line ~228)** — identical to `VocabEntryPayload:92-95`:

```ts
group:      z.string().nullish(),
subgroup:   z.string().nullish(),
groupId:    z.string().nullish(),
subgroupId: z.string().nullish(),
```

`ClassNotePayload` currently is `{ classNoteId, structured }`; it gains the four fields. (Tolerant validation is preserved — these are all `.nullish()`, so a payload without them is still valid; the [[propose-Apply-500-на-вложенных-payload-из-за-формы-модели]] tolerance contract is untouched.)

**(b) Extend the inline `payload` description** (`proposeToolDecl`, `tool.ts:49-50`). Append, after the existing VOCAB_ENTRY group guidance:

> For GRAMMAR_TOPIC: also set `group` (broad theme, e.g. "Времена") and `subgroup` (narrow, e.g. "Прошедшее"); to REUSE, copy a `{g:id}` token **from the Shared "Grammar groups" block** into `groupId`/`subgroupId` — never from another domain's block. For CLASS_NOTE: same, reusing from the **"Note groups"** block. The `category` enum on a grammar topic is separate from its `group` — set both.

### 3.5 `lib/ai/propose/apply-db.ts` — `resolveGroupId(tx, userId, domain, p)` + 3 call sites

**(a) Add the `domain` param** to `resolveGroupId` (currently `apply-db.ts:63-107`) and put `domain` in every `CollectionGroup` query. The body is otherwise unchanged — top-by-id (ownership + `parentId:null` + **`domain`**) → top-by-name find-first-or-create → subgroup-by-id (ownership + `parent===top` + **`domain`**) → subgroup-by-name → `sub ?? top ?? null`:

```ts
async function resolveGroupId(
  tx: Tx, userId: string, domain: GroupDomain,
  p: { group?: string|null; subgroup?: string|null; groupId?: string|null; subgroupId?: string|null },
): Promise<string | null> {
  let topId: string | null = null;
  if (cleanStr(p.groupId)) {
    const g = await tx.collectionGroup.findFirst({
      where: { id: p.groupId as string, userId, domain, parentId: null }, select: { id: true },
    });
    if (g) topId = g.id;
  }
  if (!topId && cleanStr(p.group)) {
    const name = (p.group as string).trim(); const nameNorm = normGroupName(name);
    const existing = await tx.collectionGroup.findFirst({ where: { userId, domain, parentId: null, nameNorm }, select: { id:true } });
    topId = existing?.id ?? (await tx.collectionGroup.create({ data: { userId, domain, parentId: null, name, nameNorm } })).id;
  }
  let subId: string | null = null;
  if (cleanStr(p.subgroupId)) {
    const s = await tx.collectionGroup.findFirst({ where: { id: p.subgroupId as string, userId, domain }, select: { id:true, parentId:true } });
    if (s && topId && s.parentId === topId) subId = s.id;
  }
  if (!subId && cleanStr(p.subgroup) && topId) {
    const name = (p.subgroup as string).trim(); const nameNorm = normGroupName(name);
    const existing = await tx.collectionGroup.findFirst({ where: { userId, domain, parentId: topId, nameNorm }, select: { id:true } });
    subId = existing?.id ?? (await tx.collectionGroup.create({ data: { userId, domain, parentId: topId, name, nameNorm } })).id;
  }
  return subId ?? topId ?? null;
}
```

**Cross-domain rejection is automatic:** a vocab `{g:id}` pasted into a grammar payload won't match `findFirst({ id, userId, domain:'GRAMMAR' })` (different domain) → falls through to name-create or ungrouped. The id never leaks across domains. (This is the spec's headline edge case and it's enforced by the `domain` in the `where`, no extra code.)

**(b) Three call sites:**

| Case | File:line | Change |
|---|---|---|
| `VOCAB_ENTRY` | `apply-db.ts:120` | `resolveGroupId(tx, userId, 'VOCAB', v)` (was no domain) → `groupId` into the upsert exactly as today. |
| `GRAMMAR_TOPIC` | `apply-db.ts:161-183` | Resolve `const groupId = await resolveGroupId(tx, userId, 'GRAMMAR', g)`; add `groupId` to the `data` object (line ~163) so it's set on **both** CREATE and the `updateMany` UPDATE (last-write-wins move, like vocab). `category` stays as-is. |
| `CLASS_NOTE` | `apply-db.ts:291-304` | Resolve `const groupId = await resolveGroupId(tx, userId, 'NOTE', c)`; on UPDATE add `groupId` to `updateMany` data; on CREATE add `groupId` to `create` data. |

`import { normGroupName } from '../../api/vocab-groups'` (line 39) → `'../../api/collection-groups'`.

---

## 4. UI architecture

### 4.1 The generic component family — `components/groups/*`

Promote `components/vocabulary/{group-section, group-dialogs, use-vocab-collapse, types, group-actions}` to `components/groups/*`, parametrized by domain. `WordCard` stays vocab-specific; add sibling leaf cards.

**`components/groups/grouped-accordion.tsx`** — the host (generalizes the accordion body of `vocabulary/page.tsx:154-197` + `group-section.tsx`). Render-prop for the leaf so each page supplies its own card grid:

```ts
export interface GroupedAccordionProps<T> {
  groups: GroupNode[];                              // tree from /api/groups?domain=
  itemsByGroup: Map<string, T[]>;                   // leafId → items (page builds this)
  ungrouped: T[];
  open: string[];
  onOpenChange: (next: string[]) => void;
  actions: GroupActions;                            // onAddSubgroup / onRename / onDelete (unchanged)
  // move-to select on each leaf card:
  options: GroupOption[];                           // flattenGroupOptions(groups)
  movingId: string | null;
  onMove: (itemId: string, groupId: string | null) => void;
  // the leaf contract — page renders one item:
  renderItem: (item: T, ctx: { options: GroupOption[]; moving: boolean; onMove: (g: string|null)=>void }) => ReactNode;
  getItemId: (item: T) => string;
  labels: GroupLabels;                              // i18n strings (ungrouped/emptyGroup/…)
}
```

The nested-Radix subgroup-open-merge trick (`group-section.tsx:126-130`) moves in verbatim — it's domain-agnostic.

**`components/groups/use-collapse.ts`** — `useVocabCollapse` generalized to `useGroupCollapse(storageKey: string)`. Each page passes a distinct key (`lla:vocab:open-groups`, `lla:grammar:open-groups`, `lla:notes:open-groups`) so the three accordions persist independently. (Homework/Exercises use their own keys too even though derived.)

**`components/groups/group-dialogs.tsx`** — `GroupFormDialog` + `DeleteGroupDialog` moved as-is; the only change is they take a `t`/labels prop (or a `namespace` prop) instead of hardcoding `useTranslations('vocabGroup')`, so grammar/notes can pass their copy. `DeleteTarget.wordCount` → `itemCount`.

**`components/groups/types.ts`** — `GroupOption`, `nodeLabel`, `totalItems` (was `totalWords`), `flattenGroupOptions`. Re-export from here; delete the vocab copies.

**Leaf cards (the render-prop bodies):**
- `WordCard` (`components/vocabulary/word-card.tsx`) — **unchanged** behavior; just imports `GroupOption`/types from `components/groups/types`. Still vocab-specific (article rendering, SRS due badge).
- **`components/grammar/grammar-topic-card.tsx`** (NEW) — leaf for grammar: title + `category` badge + CEFR badge + mastery bar (lift the bar from `grammar/page.tsx`), wrapped in a `Link href="/grammar/{id}"`, plus the same "Move to…" `Select` as WordCard (uses `onMove`/`options`).
- **`components/notes/note-card.tsx`** (NEW) — leaf for notes: title (fallback "Без названия") + 90-char `rawInput` preview, `Link href="/notes/{id}"`, + Move-to Select.

### 4.2 Per-page integration

**`/vocabulary`** (`app/(app)/vocabulary/page.tsx`) — swap `GroupSection`/loop for `<GroupedAccordion<VocabRow> renderItem={WordCard…}>`; change the two queries from `/api/vocabulary/groups` → `/api/groups?domain=VOCAB` (key stays `['vocab-groups']` or rename to `['groups','VOCAB']`). Net behavior identical. This is also where the `wordCount→itemCount` rename lands.

**`/grammar`** (FULL — `app/(app)/grammar/page.tsx`, today a flat `sm:grid-cols-2` of Link>Card from `['grammar'] → /api/grammar?pageSize=100`):
- Add a groups query: `['groups','GRAMMAR'] → /api/groups?domain=GRAMMAR`.
- Build `itemsByGroup`/`ungrouped` from `data.items` keyed by `groupId` (same `useMemo` shape as vocab page `:81-88`).
- Render `<GroupedAccordion<GrammarRow> renderItem={(t,ctx)=><GrammarTopicCard …/>}>` with `getItemId={t=>t.id}` and move via `PATCH /api/grammar/{id}` `{groupId}`.
- CRUD groups via the shared dialogs + `/api/groups`. i18n namespace `grammarGroup` (or shared `group` — §4.4).
- States: loading/empty(no topics)/partial(all ungrouped → only that section)/error — same shape as vocab.

**`/notes`** (FULL — `app/(app)/notes/page.tsx`, flat `flex-col` list from `['notes'] → /api/notes?pageSize=100`; keep the create form at top):
- Groups query `['groups','NOTE']`; `GroupedAccordion<NoteRow> renderItem={NoteCard}`; move via `PATCH /api/notes/{id}` `{groupId}`.

**`/homework`** (DERIVED — `app/(app)/homework/page.tsx`, `['homework'] → /api/homework?pageSize=100`, has `status`):
- No groups query, no CRUD, no AI. A **presentational** accordion bucketed by status. Define buckets in code:
  ```ts
  const BUCKETS = [
    { key: 'review',  label: t('bucketReview'),  statuses: ['SUBMITTED','STRUCTURED'] },
    { key: 'corrected', label: t('bucketCorrected'), statuses: ['CORRECTED'] },
    { key: 'drafts',  label: t('bucketDrafts'),  statuses: ['DRAFT'] },
    { key: 'archive', label: t('bucketArchive'), statuses: ['ARCHIVED'] },
  ] as const;   // HomeworkStatus = DRAFT|SUBMITTED|STRUCTURED|CORRECTED|ARCHIVED
  ```
  Render each non-empty bucket as a plain `Accordion`/`AccordionItem` (reuse `components/ui/accordion`) with the existing Link>Card row markup. No `GroupedAccordion` (no move/CRUD) — a thin local component is simpler than bending the generic one. Collapse key `lla:homework:open-buckets`.

**`/exercises`** (DERIVED — `app/(app)/exercises/page.tsx`, `['exercises'] → /api/exercises?pageSize=100`):
- Needs the §2.4 enrichment (`grammarTopic.title`, `sourceType`). Group rows by `grammarTopicId` (label = `grammarTopic.title`), plus a trailing "Прочее / Вручную" bucket for sets with no `grammarTopicId` (the `MANUAL`/other `sourceType`). Same presentational accordion as homework. Keep the generate panel + ProposalCards on top untouched.

### 4.3 Grammar detail — render `rulesJson` (the fix)

`app/(app)/grammar/[id]/page.tsx` already types `rulesJson?: Array<{ rule: string; examples?: string[] }>` (line 23) but **never renders it**. Insert a "Правила" card between the explanation card (ends line 58) and the examples card (line 60):

```tsx
{data.rulesJson && data.rulesJson.length > 0 && (
  <Card className="mb-4">
    <CardContent className="flex flex-col gap-3 p-5">
      <h2 className="text-sm font-semibold">{t('rules')}</h2>
      {data.rulesJson.map((r, i) => (
        <div key={i} className="flex flex-col gap-1">
          <p className="text-sm leading-relaxed [&_strong]:font-semibold">{r.rule}</p>
          {r.examples?.map((ex, j) => (
            <div key={j} className="flex items-center gap-1.5 pl-3 text-sm">
              <SpeakButton text={ex} /><span className="de">{ex}</span>
            </div>
          ))}
        </div>
      ))}
    </CardContent>
  </Card>
)}
```

New i18n key `grammar.rules` ("Правила" / "Rules"). Pure additive render — no data/API change.

### 4.4 Proposal chip extension

`components/assistant/proposal-group-path.tsx` currently fetches the VOCAB tree and shows the path/new-group chip for VOCAB_ENTRY only. Generalize:
- Accept the proposal's `targetType` (the parent `proposal-card.tsx` already has it) → map to domain (`VOCAB_ENTRY→VOCAB`, `GRAMMAR_TOPIC→GRAMMAR`, `CLASS_NOTE→NOTE`); render only for those three.
- Fetch `/api/groups?domain={domain}` with query key `['groups', domain]` (replaces the `/api/vocabulary/groups` call at `:36`).
- The `readGroupPayload`/new-group computation is unchanged; the chip label/markup is unchanged. i18n keys (`newGroup`/`newSubgroup`) move to the shared `group` namespace.

**i18n recommendation:** introduce ONE shared `group` namespace in `messages/{en,ru}.json` holding the structural strings already in `vocabGroup` (addGroup, addSubgroup, rename, delete, moveTo, ungrouped, namePlaceholder, newGroup, newSubgroup, emptyGroup, emptySubgroup, deleteTitle, deleteConfirm, loadError, genericError) — domain-neutral wording, no "word". Keep `vocab`-specific strings (dueBadge, count, etc.) in `vocab`. Add small per-page namespaces `grammar`/`notes`/`homework`/`exercises` entries for their own labels (bucket names, `rules`, empty-state copy). Run `/i18n-audit` after to confirm EN/RU parity.

---

## 5. Grammar depth (Ask 2 — light path only)

Three precise edits; **only** `grammar_explain`, never `tutor_chat`.

**(a) `lib/ai/features/templates.ts:52-56`** — bump effort `low → medium`:

```ts
grammar_explain: {
  slug: 'grammar_explain',
  model: CHAT_MODEL,
  reasoningEffort: 'medium',           // was 'low' — 1024 → 8192 thinking tokens (gemini.ts:23-28)
  proposeTargets: ['GRAMMAR_TOPIC', 'EXERCISE_SET'],
},
```

`mapThinking` (`gemini.ts:23-40`) maps `medium → thinkingBudget: 8192` for the `gemini-2.5` family — no provider change needed.

**(b) `FEATURE_ADDENDA.grammar_explain`** (`layers.ts:100-101`) — rewrite for structured depth:

```
## TASK
Explain the grammar topic in the learner's native language at their CEFR level, with
GERMAN examples (bold). Go DEEP and STRUCTURED:
- A clear `explanationRu` that contrasts German with the learner's L1 (ru↔de) where they diverge.
- 3–5 `rules`, each a concise statement WITH 1–2 German example sentences.
- 3+ `examples` as {de, ru, highlight} (highlight = the focal token/ending).
- 2–3 `pitfalls` specific to Russian speakers (missing articles, wrong Kasus, Perfekt
  haben/sein, verb-second order) — woven into the explanation AND listed.
Then offer to save it via a `propose` call with target_type "grammar_topic" (fields
explanationRu, rules, examples, pitfalls — and group/subgroup per the grouping rule).
```

**(c) Render `rulesJson`** — §4.3 (the previously-dropped field is now shown, closing the loop on "богаче вывод").

**Free-tier cost note.** `medium` is 8× the thinking budget of `low` (8192 vs 1024 tokens) on `gemini-2.5-flash`. It is scoped to a **single, infrequent feature** (explaining a topic — not every chat turn), so the marginal free-tier cost is small and bounded. `tutor_chat` stays `low` deliberately (it's the hot path). Monitor via the existing usage tracking; if quota pressure appears, the knob is one line. Recorded in [[post-mvp-backlog]] as "revisit grammar_explain effort if free-tier 429s rise".

---

## 6. Ordered build slices (critical path + parallel fan-out)

Critical path is **schema → engine → AI-loop**. UI (all pages), derived grouping, and grammar-depth parallelize once the API contract (§2–§3) is fixed. Tiers per `.claude/rules/agent-workflow.md`; this is a Tier-3 module.

| Slice | Delivers | Agent | Depends on | Parallel? |
|---|---|---|---|---|
| **0 · Schema + fold-in migration** | §1 Prisma edit + hand-authored `collection_grouping` migration; `migrate deploy`; drift-clean; `prisma generate` | **database-architect** | — | no — gates everything |
| **1 · Group engine** | `lib/api/collection-groups.ts` (§2.1); `/api/groups` + `/api/groups/[id]` (§2.2); retire `/api/vocabulary/groups`; extend `PATCH /api/grammar/[id]`, `PATCH /api/notes/[id]` (§2.3); extend `GET /api/exercises` (§2.4) | **backend-dev** | 0 | no — fixes the API contract |
| **2 · AI-loop generalization** | `from-db` per-domain query (§3.1); `layers` `formatGroups`+blocks+persona+addendum (§3.2); `caps` `GROUPS` (§3.3); `tool` payload+description (§3.4); `apply-db` `resolveGroupId(domain)`+3 sites (§3.5) | **backend-dev** | 0 | can overlap Slice 1 (different files) but both must land before UI consumes |
| **3 · Generic UI core** | `components/groups/*` (GroupedAccordion, use-collapse, dialogs, types); rework `/vocabulary` onto it (§4.1–4.2) | **frontend-dev** | 1 (API) | ‖ with 4,5,6 after contract |
| **4 · Grammar + Notes pages (FULL)** | `GrammarTopicCard`, `NoteCard`; rework `/grammar` + `/notes` onto GroupedAccordion; grammar-detail `rulesJson` render (§4.2–4.3); proposal chip (§4.4) | **frontend-dev** | 1, 3 | ‖ with 5,6 |
| **5 · Homework + Exercises (DERIVED)** | status-bucket accordion on `/homework`; topic-bucket accordion on `/exercises` (§4.2) | **frontend-dev** | 1 (the `GET /api/exercises` enrichment) | ‖ with 3,4,6 |
| **6 · Grammar depth** | templates effort bump + addendum rewrite (§5a/b) | **backend-dev** | 0 | ‖ with everything (isolated to 2 files) |
| **7 · i18n** | shared `group` namespace + per-page strings; `/i18n-audit` (§4.4) | **frontend-dev** | 3–5 | folds into 3–5 |
| **8 · Tests** | unit + service + envelope (§7) | **test-engineer** | 1, 2 | ‖ once 1+2 land |
| **9 · UI verification** | browser checks (§7) | **ui-tester** | 3–5 | ‖ with 8 |
| **10 · Review** | qa checklist (in-flight) then tech-lead final gate (migration + cross-domain isolation are critical zones) | **qa-reviewer** → **tech-lead-reviewer** | all | final |

**One-line build order:** `0 (schema+migration) → {1 engine ‖ 2 AI-loop ‖ 6 grammar-depth} → {3 UI core → 4 grammar/notes ‖ 5 homework/exercises} ‖ {8 tests ‖ 9 ui-tester} → 10 review`.

Backend (1,2,6) can be one `backend-dev` pass since they share `apply-db`/`tool`/the new module; frontend (3→4,5) is sequential on the generic component then fans out. The API contract is fully fixed by the end of Slice 1, so frontend and test agents start as soon as it lands.

---

## 7. Test plan

Generalize the three existing suites (they already encode the invariants) and add domain-isolation cases. The mocked-`tx` strategy in `resolve-group-id.test.ts` carries over directly — just swap `vocabGroup` → `collectionGroup` on the mock and pass `domain`.

**Unit (vitest):**
- **`lib/ai/propose/resolve-group-id.test.ts`** (generalize B1–B10 + edge): the mock tx's `vocabGroup` becomes `collectionGroup`; assert every `findFirst`/`create` `where`/`data` includes the expected `domain`. Re-run B1–B10 for `domain:'GRAMMAR'` (via a GRAMMAR_TOPIC proposal) to prove the same create-or-reuse. **New D-cases:**
  - **D1 cross-domain id rejected:** GRAMMAR_TOPIC payload with a `groupId` that exists only as `domain:'VOCAB'` → `findFirst({…,domain:'GRAMMAR'})` returns null → falls to name-create/ungrouped; the vocab id never reaches `grammarTopic` data.
  - **D2 domain isolation on create:** GRAMMAR create writes `data.domain==='GRAMMAR'`; NOTE create writes `'NOTE'`.
  - **D3 same name, different domain coexist:** a GRAMMAR "Еда" create does not find the VOCAB "Еда" (different domain in `where`).
- **`lib/ai/envelope/vocab-grouping-layers.test.ts`** → rename/extend to `grouping-layers.test.ts`: keep A1–A10 for the Vocabulary block; add parallel cases that `formatShared` renders **Grammar groups** and **Note groups** headers with `{g:id}` when those arrays are present, each independently capped at `CAPS.GROUPS`, and that the three blocks together stay ≤ `CAPS.SHARED` with vocab surviving the trim first. Assert grammar-topic lines carry the `· path` annotation when `groupPath` is set.
- **`lib/api/vocab-groups.test.ts`** → `collection-groups.test.ts`: keep the `normGroupName` C1–C6 cases (logic unchanged); add tiny tests for `parseDomain` (valid/invalid/null) and the `COUNT_RELATION`/`ITEM_MODEL` maps.
- **Grammar depth:** a test asserting `getFeature('grammar_explain').reasoningEffort === 'medium'` and `getFeature('tutor_chat').reasoningEffort === 'low'` (locks the "only grammar_explain" decision); a `mapThinking('medium','gemini-2.5-flash')` test asserting `thinkingBudget: 8192`.

**API smoke (manual/curl with the test creds, mirroring how vocab-grouping was verified — no app/api test harness exists):**
- `POST /api/groups?domain=GRAMMAR` create top + subgroup → 201; duplicate top name → 409; 3rd-level parent → 422; foreign/`VOCAB`-domain `parentId` → 422; `GET /api/groups?domain=GRAMMAR` returns the tree with `itemCount`; bad domain → 400.
- `PATCH /api/grammar/{id}` `{groupId}` with a GRAMMAR group → 200 + topic shows the group; with a VOCAB group id → 422; `null` → ungroups.
- `PATCH /api/notes/{id}` `{groupId}` symmetric.
- `GET /api/exercises` now returns `grammarTopic.title` + `sourceType`.
- **Loop e2e:** "запиши правило про Perfekt и положи в Времена → Прошедшее" → a GRAMMAR_TOPIC proposal carrying `group/subgroup` → Apply → DB shows a `CollectionGroup(domain:'GRAMMAR')` tree `Времена→Прошедшее` and the topic's `groupId` = the subgroup; re-issue with the same names → no duplicate groups (idempotent reuse). Then assemble the envelope (call the chat route) and confirm a `## Grammar groups` block with the `{g:id}`.

**ui-tester (browser, with `.claude/credentials.md`):**
- `/grammar`: topics render grouped by `группа → подгруппа` with counts; expand/collapse persists across reload (localStorage key distinct from vocab); "Move to…" relocates a topic; create/rename/delete a grammar group; delete-confirm shows the affected count; "Без группы" section present.
- `/notes`: same grouped behavior + move/CRUD.
- `/grammar/{id}`: the new **Правила** card renders rules + German examples with SpeakButtons (the previously-dropped `rulesJson`).
- `/homework`: status buckets (`На проверку`/`Исправлено`/`Черновики`/`Архив`), empty buckets hidden, no move/CRUD controls.
- `/exercises`: sets grouped by linked topic + a "Прочее/Вручную" bucket; generate panel + proposal cards still work.
- `/vocabulary`: unchanged behavior after the engine swap (regression guard).
- Proposal dock: a GRAMMAR_TOPIC proposal shows the `Времена → Прошедшее` chip + "новая группа" marker.

**Explicitly out of scope for tests (carried from spec):** AI *merge* of near-duplicate groups, AI group descriptions, full taxonomy for homework/exercises — all in [[post-mvp-backlog]].

---

## 8. Blast radius / risks

| Module / file | Impact | Detail |
|---|---|---|
| `prisma/schema.prisma` | **Modified** | `VocabGroup`→`CollectionGroup` + `GroupDomain`; `groupId` on Grammar/Note; relation renames on `User`/`VocabEntry`. |
| `prisma/migrations/…_collection_grouping/` | **Created** | Hand-authored fold-in SQL (§1.3). |
| `lib/api/collection-groups.ts` | **Created** | From `vocab-groups.ts`; adds domain constants. |
| `lib/api/vocab-groups.ts` | **Removed** | Replaced by collection-groups (re-export shim optional during transition). |
| `app/api/groups/**` | **Created** | Generic CRUD. |
| `app/api/vocabulary/groups/**` | **Removed** | Consolidated into `/api/groups?domain=VOCAB`. |
| `app/api/{grammar,notes}/[id]/route.ts` | **Modified** | `+ {groupId}` move (domain-checked). |
| `app/api/exercises/route.ts` | **Modified** | `+ grammarTopic.title, sourceType` in list. |
| `lib/ai/envelope/{from-db,layers,caps}.ts` | **Modified** | Per-domain group load + blocks + persona + shared cap. |
| `lib/ai/propose/{tool,apply-db}.ts` | **Modified** | Payload fields + `resolveGroupId(domain)` + 3 sites. |
| `lib/ai/features/templates.ts` | **Modified** | `grammar_explain` effort → medium. |
| `components/groups/**` | **Created** | Generic accordion/dialogs/hook/types. |
| `components/vocabulary/{group-section,group-dialogs,use-vocab-collapse,types,group-actions}.tsx` | **Removed/moved** | Promoted to `components/groups/*`. |
| `components/{grammar,notes}/*-card.tsx` | **Created** | Leaf cards. |
| `app/(app)/{vocabulary,grammar,notes,homework,exercises}/page.tsx` + `grammar/[id]/page.tsx` | **Modified** | Grouped/derived UIs + rulesJson render. |
| `components/assistant/proposal-group-path.tsx` | **Modified** | Per-domain. |
| `messages/{en,ru}.json` | **Modified** | Shared `group` namespace + per-page strings. |
| Affected (downstream, no change) | **Affected** | Any consumer importing from `@/lib/api/vocab-groups` (the vocab page, the proposal chip) must repoint to `collection-groups` — both are in this change set, so no dangling refs. `/vocabulary` behavior must be byte-for-byte regression-tested (it rides the new engine). |

**Risks & mitigations:**

1. **TOP RISK — the fold-in migration deletes data if generated, not authored.** Prisma-migrate diffs the rename to DROP+CREATE (§1.2). *Mitigation:* author the SQL by hand, apply with `migrate deploy` (never `migrate dev` for this one), gate on `migrate status` clean + `migrate diff` empty + a row-count check (`SELECT count(*) FROM "CollectionGroup"` equals the pre-migration `VocabGroup` count) before merge. Take a DB snapshot first. Rollback is non-destructive (§1.4). `database-architect` owns Slice 0 and `tech-lead-reviewer` re-checks it (critical zone: migration + data integrity).
2. **Cross-domain id leak** (a vocab `{g:id}` landing on a grammar topic). *Mitigation:* the `domain` segment in every `resolveGroupId` `where` rejects it structurally (§3.5a); covered by test D1.
3. **Envelope budget blowout** with three taxonomies in `SHARED`. *Mitigation:* per-domain `CAPS.GROUPS` (900×3) under `SHARED` (3000) + the final `capText` backstop trims grammar/note first (vocab survives) (§3.3); covered by the extended layers test.
4. **`wordCount→itemCount` rename** touching 5 vocab component files. *Mitigation:* it happens inside the same component-promotion slice (§4.1) — no half-renamed state ships.
5. **Free-tier 429s** from the `medium` bump. *Mitigation:* scoped to one infrequent feature, `tutor_chat` untouched, one-line revert, monitored (§5).
6. **Note taxonomy with empty envelope context** (notes were never in shared). *Mitigation:* we add only the *group block* (not note bodies) and only when non-empty — the model can still reuse/create note groups; first run shows an empty block → creates from scratch (the spec's "first time" edge case).

---

## 9. Vault updates this design implies

On build completion (per `.claude/rules/doc-updates.md`):
- **ADR:** `vault/knowledge/decisions/` — "Одна CollectionGroup с доменом VOCAB|GRAMMAR|NOTE; VocabGroup свёрнута rename-миграцией" (the fold-in decision + the Prisma-migrate gotcha). And "Домашка/упражнения — производная группировка, не таблица".
- **`vault/atlas/database.md`** — `CollectionGroup`/`GroupDomain` + the three `groupId` columns.
- **`vault/atlas/dependency-graph.md`** — `lib/api/collection-groups`, `components/groups/*`, `/api/groups`.
- **`vault/api/`** — new `/api/groups` doc + changelog; note the retirement of `/api/vocabulary/groups`; the grammar/notes/exercises endpoint extensions.
- **`vault/knowledge/patterns/`** — "domain-parametrized create-or-reuse" generalizing [[ИИ-дообогащает-и-сам-раскладывает-из-краткой-команды]].
- **`vault/specs/vocab-grouping.md`** — already marked as folded into [[collection-grouping]]; flip [[collection-grouping]] status `draft → implemented` and link this plan.
- **`vault/00-home/index.md`** — wiki-link the new notes.
- Anything deferred (AI merge, group descriptions, full HW/exercise taxonomy, grammar_explain effort revisit) → `vault/knowledge/business/post-mvp-backlog.md`.
