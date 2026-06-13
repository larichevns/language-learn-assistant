-- AlterTable
ALTER TABLE "LearnerProfile" ADD COLUMN     "desiredRetention" DOUBLE PRECISION NOT NULL DEFAULT 0.9;

-- AlterTable
ALTER TABLE "SrsCard" ADD COLUMN     "difficulty" DOUBLE PRECISION,
ADD COLUMN     "learningSteps" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "stability" DOUBLE PRECISION;
