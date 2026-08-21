-- CreateEnum
CREATE TYPE "ArtifactStatus" AS ENUM ('FRESH', 'STALE');

-- CreateTable
CREATE TABLE "IdempotencyRecord" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpecArtifact" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "specIterationId" TEXT NOT NULL,
    "node" TEXT NOT NULL,
    "status" "ArtifactStatus" NOT NULL DEFAULT 'FRESH',
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpecArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyRecord_projectId_key_key" ON "IdempotencyRecord"("projectId", "key");

-- CreateIndex
CREATE INDEX "SpecArtifact_projectId_node_status_idx" ON "SpecArtifact"("projectId", "node", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SpecArtifact_specIterationId_node_key" ON "SpecArtifact"("specIterationId", "node");

-- AddForeignKey
ALTER TABLE "IdempotencyRecord" ADD CONSTRAINT "IdempotencyRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ResearchProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecArtifact" ADD CONSTRAINT "SpecArtifact_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ResearchProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecArtifact" ADD CONSTRAINT "SpecArtifact_specIterationId_fkey" FOREIGN KEY ("specIterationId") REFERENCES "SpecIteration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
