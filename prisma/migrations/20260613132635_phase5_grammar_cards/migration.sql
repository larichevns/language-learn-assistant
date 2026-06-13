-- CreateTable
CREATE TABLE "GrammarCard" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "grammarTopicId" TEXT NOT NULL,
    "state" "SrsState" NOT NULL DEFAULT 'NEW',
    "stability" DOUBLE PRECISION,
    "difficulty" DOUBLE PRECISION,
    "learningSteps" INTEGER NOT NULL DEFAULT 0,
    "easeFactor" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "intervalDays" INTEGER NOT NULL DEFAULT 0,
    "repetitions" INTEGER NOT NULL DEFAULT 0,
    "lapses" INTEGER NOT NULL DEFAULT 0,
    "dueAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GrammarCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GrammarCard_grammarTopicId_key" ON "GrammarCard"("grammarTopicId");

-- CreateIndex
CREATE INDEX "GrammarCard_userId_dueAt_idx" ON "GrammarCard"("userId", "dueAt");

-- AddForeignKey
ALTER TABLE "GrammarCard" ADD CONSTRAINT "GrammarCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrammarCard" ADD CONSTRAINT "GrammarCard_grammarTopicId_fkey" FOREIGN KEY ("grammarTopicId") REFERENCES "GrammarTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
