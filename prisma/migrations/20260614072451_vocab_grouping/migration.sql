-- AlterTable
ALTER TABLE "VocabEntry" ADD COLUMN     "groupId" TEXT;

-- CreateTable
CREATE TABLE "VocabGroup" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "nameNorm" TEXT NOT NULL,
    "emoji" TEXT,
    "color" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VocabGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VocabGroup_userId_parentId_idx" ON "VocabGroup"("userId", "parentId");

-- CreateIndex
CREATE UNIQUE INDEX "VocabGroup_userId_parentId_nameNorm_key" ON "VocabGroup"("userId", "parentId", "nameNorm");

-- CreateIndex
CREATE INDEX "VocabEntry_userId_groupId_idx" ON "VocabEntry"("userId", "groupId");

-- AddForeignKey
ALTER TABLE "VocabEntry" ADD CONSTRAINT "VocabEntry_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "VocabGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VocabGroup" ADD CONSTRAINT "VocabGroup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VocabGroup" ADD CONSTRAINT "VocabGroup_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "VocabGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
