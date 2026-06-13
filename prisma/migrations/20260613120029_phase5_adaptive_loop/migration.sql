-- CreateEnum
CREATE TYPE "AttemptSource" AS ENUM ('EXERCISE_ITEM', 'SRS_REVIEW', 'HOMEWORK', 'CHAT_DRILL');

-- CreateEnum
CREATE TYPE "HomeworkErrorType" AS ENUM ('KASUS', 'GENUS', 'NUMERUS', 'WORTSTELLUNG', 'VERBKONJUGATION', 'PRAEPOSITION', 'ARTIKEL', 'RECHTSCHREIBUNG', 'ZEITFORM', 'SONSTIGES');

-- AlterTable
ALTER TABLE "GrammarTopic" ADD COLUMN     "masteryUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "Attempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" "AttemptSource" NOT NULL,
    "targetId" TEXT NOT NULL,
    "vocabEntryId" TEXT,
    "grammarTopicId" TEXT,
    "category" "GrammarCategory",
    "direction" "ReviewDirection",
    "isCorrect" BOOLEAN NOT NULL,
    "grade" INTEGER,
    "errorTypeJson" JSONB,
    "durationMs" INTEGER,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomeworkError" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "homeworkId" TEXT NOT NULL,
    "errorType" "HomeworkErrorType" NOT NULL,
    "original" TEXT NOT NULL,
    "corrected" TEXT NOT NULL,
    "explanationRu" TEXT NOT NULL,
    "grammarTopicId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HomeworkError_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Attempt_userId_attemptedAt_idx" ON "Attempt"("userId", "attemptedAt");

-- CreateIndex
CREATE INDEX "Attempt_userId_grammarTopicId_idx" ON "Attempt"("userId", "grammarTopicId");

-- CreateIndex
CREATE INDEX "Attempt_userId_category_attemptedAt_idx" ON "Attempt"("userId", "category", "attemptedAt");

-- CreateIndex
CREATE INDEX "Attempt_userId_isCorrect_attemptedAt_idx" ON "Attempt"("userId", "isCorrect", "attemptedAt");

-- CreateIndex
CREATE INDEX "HomeworkError_userId_createdAt_idx" ON "HomeworkError"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "HomeworkError_homeworkId_idx" ON "HomeworkError"("homeworkId");

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkError" ADD CONSTRAINT "HomeworkError_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkError" ADD CONSTRAINT "HomeworkError_homeworkId_fkey" FOREIGN KEY ("homeworkId") REFERENCES "Homework"("id") ON DELETE CASCADE ON UPDATE CASCADE;
