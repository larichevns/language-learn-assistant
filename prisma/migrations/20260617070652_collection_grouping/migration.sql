-- Fold VocabGroup into a generic, domain-discriminated CollectionGroup.
-- HAND-AUTHORED (do NOT regenerate with `prisma migrate dev` — it would diff the
-- table rename to DROP TABLE "VocabGroup" + CREATE TABLE "CollectionGroup", deleting
-- every existing vocab group). Apply with `prisma migrate deploy` (verbatim, no re-diff).
-- Validated on a scratch DB: 0 drift vs the datamodel, all rows preserved, domain
-- backfilled to VOCAB. See vault/specs/collection-grouping-implementation-plan.md §1.

-- ── 1) Domain enum ──────────────────────────────────────────────────────────
CREATE TYPE "GroupDomain" AS ENUM ('VOCAB', 'GRAMMAR', 'NOTE');

-- ── 2) Rename the table (PRESERVES ALL ROWS) ────────────────────────────────
ALTER TABLE "VocabGroup" RENAME TO "CollectionGroup";

-- Rename the PK + FK identifiers the table rename left behind (cosmetic but
-- keeps `prisma migrate diff` empty afterwards). Names are from the vocab migration.
ALTER TABLE "CollectionGroup" RENAME CONSTRAINT "VocabGroup_pkey" TO "CollectionGroup_pkey";
ALTER TABLE "CollectionGroup" RENAME CONSTRAINT "VocabGroup_userId_fkey" TO "CollectionGroup_userId_fkey";
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

-- ── 5) Repoint VocabEntry's FK to the renamed table ─────────────────────────
-- The table rename in step 2 already retargets this FK to "CollectionGroup"
-- (verified on a scratch DB), and the constraint name is already the one Prisma
-- expects. The drop+add below is the no-op-equivalent belt-and-suspenders so the
-- reference resolves byte-identically to a fresh Prisma migration.
ALTER TABLE "VocabEntry" DROP CONSTRAINT "VocabEntry_groupId_fkey";
ALTER TABLE "VocabEntry" ADD CONSTRAINT "VocabEntry_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "CollectionGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 6) New nullable groupId columns + indexes + FKs (additive, no backfill) ──
ALTER TABLE "GrammarTopic" ADD COLUMN "groupId" TEXT;
ALTER TABLE "ClassNote"    ADD COLUMN "groupId" TEXT;

CREATE INDEX "GrammarTopic_userId_groupId_idx" ON "GrammarTopic" ("userId", "groupId");
CREATE INDEX "ClassNote_userId_groupId_idx"    ON "ClassNote"    ("userId", "groupId");

ALTER TABLE "GrammarTopic" ADD CONSTRAINT "GrammarTopic_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "CollectionGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClassNote" ADD CONSTRAINT "ClassNote_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "CollectionGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
