-- Per-direction SRS cards (minimum-information principle): a word can have a
-- separate memory per ReviewDirection. Existing cards backfill to DE_TO_RU,
-- and since the old unique was on vocabEntryId alone there are no collisions.

-- AlterTable
ALTER TABLE "SrsCard" ADD COLUMN "direction" "ReviewDirection" NOT NULL DEFAULT 'DE_TO_RU';

-- DropIndex
DROP INDEX "SrsCard_vocabEntryId_key";

-- CreateIndex
CREATE UNIQUE INDEX "SrsCard_vocabEntryId_direction_key" ON "SrsCard"("vocabEntryId", "direction");
