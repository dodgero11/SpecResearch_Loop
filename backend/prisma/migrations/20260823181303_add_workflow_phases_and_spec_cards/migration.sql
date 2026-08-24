-- CreateEnum
CREATE TYPE "WorkflowPhase" AS ENUM ('IDEA', 'IDEA_DECOMPOSITION', 'RESEARCH_AND_GAP', 'CONTRIBUTION_AND_EXPERIMENT', 'JUDGES_AND_CONFIRMATION', 'FINAL_SPECIFICATION');

-- CreateEnum
CREATE TYPE "SpecCardType" AS ENUM ('PROBLEM', 'RESEARCH_QUESTION', 'GAP_CANDIDATE', 'CONTRIBUTION', 'CLAIM', 'EVIDENCE', 'CONSTRAINT', 'OPEN_QUESTION');

-- CreateEnum
CREATE TYPE "SpecCardStatus" AS ENUM ('CONFIRMED', 'PROPOSED', 'MISSING', 'AMBIGUOUS', 'UNSUPPORTED', 'CONFLICT');

-- CreateEnum
CREATE TYPE "SpecCardLinkType" AS ENUM ('CLAIM_EVIDENCE', 'DEPENDS_ON', 'SUPPORTS', 'CONTRADICTS');

-- AlterTable
ALTER TABLE "WorkflowRun" ADD COLUMN     "completedPhases" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "currentPhase" "WorkflowPhase" NOT NULL DEFAULT 'IDEA';

-- CreateTable
CREATE TABLE "SpecCard" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "specIterationId" TEXT NOT NULL,
    "type" "SpecCardType" NOT NULL,
    "status" "SpecCardStatus" NOT NULL DEFAULT 'PROPOSED',
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpecCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpecCardLink" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "specIterationId" TEXT NOT NULL,
    "sourceCardId" TEXT NOT NULL,
    "targetCardId" TEXT NOT NULL,
    "type" "SpecCardLinkType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpecCardLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SpecCard_specIterationId_type_status_idx" ON "SpecCard"("specIterationId", "type", "status");

-- CreateIndex
CREATE INDEX "SpecCard_projectId_specIterationId_idx" ON "SpecCard"("projectId", "specIterationId");

-- CreateIndex
CREATE INDEX "SpecCardLink_specIterationId_type_idx" ON "SpecCardLink"("specIterationId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "SpecCardLink_sourceCardId_targetCardId_type_key" ON "SpecCardLink"("sourceCardId", "targetCardId", "type");

-- AddForeignKey
ALTER TABLE "SpecCard" ADD CONSTRAINT "SpecCard_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ResearchProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecCard" ADD CONSTRAINT "SpecCard_specIterationId_fkey" FOREIGN KEY ("specIterationId") REFERENCES "SpecIteration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecCardLink" ADD CONSTRAINT "SpecCardLink_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ResearchProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecCardLink" ADD CONSTRAINT "SpecCardLink_sourceCardId_fkey" FOREIGN KEY ("sourceCardId") REFERENCES "SpecCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecCardLink" ADD CONSTRAINT "SpecCardLink_targetCardId_fkey" FOREIGN KEY ("targetCardId") REFERENCES "SpecCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
