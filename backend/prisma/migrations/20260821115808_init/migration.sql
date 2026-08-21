-- CreateEnum
CREATE TYPE "WorkflowStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ComponentStatus" AS ENUM ('FRESH', 'STALE', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "DecisionType" AS ENUM ('ACCEPT', 'REJECT', 'OVERRIDE');

-- CreateTable
CREATE TABLE "ResearchProject" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "latestSpecId" TEXT,

    CONSTRAINT "ResearchProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpecIteration" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpecIteration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowRun" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "specIterationId" TEXT NOT NULL,
    "currentStep" INTEGER NOT NULL DEFAULT 1,
    "completedSteps" JSONB NOT NULL,
    "artifacts" JSONB NOT NULL,
    "latestSpecVersion" INTEGER NOT NULL,
    "status" "WorkflowStatus" NOT NULL DEFAULT 'RUNNING',
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComponentState" (
    "id" TEXT NOT NULL,
    "workflowRunId" TEXT NOT NULL,
    "step" INTEGER NOT NULL,
    "status" "ComponentStatus" NOT NULL DEFAULT 'FRESH',
    "output" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComponentState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LlmAuditLog" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "workflowRunId" TEXT,
    "task" TEXT NOT NULL,
    "specVersionUsed" INTEGER NOT NULL,
    "inputContext" JSONB NOT NULL,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LlmAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisionLog" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "DecisionType" NOT NULL,
    "target" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfirmationQuestion" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT,
    "answeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConfirmationQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SpecIteration_projectId_version_idx" ON "SpecIteration"("projectId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "SpecIteration_projectId_version_key" ON "SpecIteration"("projectId", "version");

-- CreateIndex
CREATE INDEX "WorkflowRun_projectId_status_idx" ON "WorkflowRun"("projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ComponentState_workflowRunId_step_key" ON "ComponentState"("workflowRunId", "step");

-- CreateIndex
CREATE INDEX "LlmAuditLog_projectId_task_specVersionUsed_idx" ON "LlmAuditLog"("projectId", "task", "specVersionUsed");

-- CreateIndex
CREATE INDEX "ConfirmationQuestion_projectId_answeredAt_idx" ON "ConfirmationQuestion"("projectId", "answeredAt");

-- AddForeignKey
ALTER TABLE "ResearchProject" ADD CONSTRAINT "ResearchProject_latestSpecId_fkey" FOREIGN KEY ("latestSpecId") REFERENCES "SpecIteration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecIteration" ADD CONSTRAINT "SpecIteration_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ResearchProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowRun" ADD CONSTRAINT "WorkflowRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ResearchProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowRun" ADD CONSTRAINT "WorkflowRun_specIterationId_fkey" FOREIGN KEY ("specIterationId") REFERENCES "SpecIteration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComponentState" ADD CONSTRAINT "ComponentState_workflowRunId_fkey" FOREIGN KEY ("workflowRunId") REFERENCES "WorkflowRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LlmAuditLog" ADD CONSTRAINT "LlmAuditLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ResearchProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LlmAuditLog" ADD CONSTRAINT "LlmAuditLog_workflowRunId_fkey" FOREIGN KEY ("workflowRunId") REFERENCES "WorkflowRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionLog" ADD CONSTRAINT "DecisionLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ResearchProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
