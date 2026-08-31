-- AlterTable
ALTER TABLE "ConfirmationQuestion" ADD COLUMN     "customAnswer" TEXT,
ADD COLUMN     "options" TEXT[],
ADD COLUMN     "selectedIndex" INTEGER,
ADD COLUMN     "title" TEXT;

-- AlterTable
ALTER TABLE "SpecCard" ADD COLUMN     "isSeed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reason" TEXT;

-- CreateTable
CREATE TABLE "Clarification" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "idea" TEXT NOT NULL,
    "clarifiedIdea" TEXT NOT NULL,
    "keyIssues" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION,
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Clarification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JudgeIssue" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "specIterationId" TEXT NOT NULL,
    "judgeType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "suggestion" TEXT NOT NULL,
    "flaggedBy" TEXT NOT NULL,
    "choices" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolvedChoice" TEXT,
    "customResolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JudgeIssue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Clarification_projectId_key" ON "Clarification"("projectId");

-- CreateIndex
CREATE INDEX "JudgeIssue_projectId_specIterationId_status_idx" ON "JudgeIssue"("projectId", "specIterationId", "status");

-- AddForeignKey
ALTER TABLE "Clarification" ADD CONSTRAINT "Clarification_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ResearchProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JudgeIssue" ADD CONSTRAINT "JudgeIssue_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ResearchProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JudgeIssue" ADD CONSTRAINT "JudgeIssue_specIterationId_fkey" FOREIGN KEY ("specIterationId") REFERENCES "SpecIteration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
