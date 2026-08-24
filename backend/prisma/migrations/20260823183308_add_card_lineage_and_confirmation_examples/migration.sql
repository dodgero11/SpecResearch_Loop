/*
  Warnings:

  - The required column `lineageId` was added to the `SpecCard` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- AlterTable
ALTER TABLE "ConfirmationQuestion" ADD COLUMN     "example" TEXT;

-- AlterTable
ALTER TABLE "SpecCard" ADD COLUMN     "lineageId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "SpecCard_projectId_lineageId_idx" ON "SpecCard"("projectId", "lineageId");
