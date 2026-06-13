-- CreateEnum
CREATE TYPE "TimelineEventType" AS ENUM ('CARD_MATURED', 'UNIT_COMPLETED', 'HOMEWORK_CORRECTED', 'CEFR_CHANGED', 'GOAL_REACHED', 'STREAK_MILESTONE', 'WEAK_AREA_CLEARED');

-- CreateTable
CREATE TABLE "TimelineEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "TimelineEventType" NOT NULL,
    "refType" TEXT,
    "refId" TEXT,
    "payloadJson" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimelineEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TimelineEvent_userId_occurredAt_idx" ON "TimelineEvent"("userId", "occurredAt");

-- AddForeignKey
ALTER TABLE "TimelineEvent" ADD CONSTRAINT "TimelineEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
