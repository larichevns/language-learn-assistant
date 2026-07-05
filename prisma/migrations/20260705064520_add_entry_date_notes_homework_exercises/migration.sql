-- AlterTable
ALTER TABLE "ClassNote" ADD COLUMN     "entryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "ExerciseSet" ADD COLUMN     "entryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Homework" ADD COLUMN     "entryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill existing rows to their historical date (not the migration run time).
-- Notes prefer the user's already-entered lessonDate, else createdAt; homework/exercises use createdAt.
UPDATE "ClassNote"   SET "entryDate" = COALESCE("lessonDate", "createdAt");
UPDATE "ExerciseSet" SET "entryDate" = "createdAt";
UPDATE "Homework"    SET "entryDate" = "createdAt";

-- CreateIndex
CREATE INDEX "ClassNote_userId_entryDate_idx" ON "ClassNote"("userId", "entryDate");

-- CreateIndex
CREATE INDEX "ExerciseSet_userId_entryDate_idx" ON "ExerciseSet"("userId", "entryDate");

-- CreateIndex
CREATE INDEX "Homework_userId_entryDate_idx" ON "Homework"("userId", "entryDate");
