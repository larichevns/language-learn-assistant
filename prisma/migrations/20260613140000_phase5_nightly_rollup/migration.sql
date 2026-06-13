-- AlterTable: nightly-rollup fields on LearnerProfile (Slice 8). All additive & nullable.
ALTER TABLE "LearnerProfile"
  ADD COLUMN "weakAreasComputedAt" TIMESTAMP(3),
  ADD COLUMN "progressNoteRu" TEXT,
  ADD COLUMN "progressNoteAt" TIMESTAMP(3);
