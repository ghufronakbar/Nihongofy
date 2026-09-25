-- CreateEnum
CREATE TYPE "CommentVisibility" AS ENUM ('PRIVATE', 'PUBLIC');

-- AlterTable
-- Default PRIVATE: seluruh catatan lama tetap privat setelah migrasi.
ALTER TABLE "QuestionComment"
    ADD COLUMN "parentId" INTEGER,
    ADD COLUMN "visibility" "CommentVisibility" NOT NULL DEFAULT 'PRIVATE',
    ADD COLUMN "sharedAt" TIMESTAMP(3),
    ADD COLUMN "deletedAt" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "QuestionComment"
    ADD CONSTRAINT "QuestionComment_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "QuestionComment"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "QuestionComment_parentId_idx" ON "QuestionComment"("parentId");

-- CreateIndex
CREATE INDEX "QuestionComment_questionId_userId_deletedAt_idx" ON "QuestionComment"("questionId", "userId", "deletedAt");

-- CreateIndex
CREATE INDEX "QuestionComment_questionId_parentId_sharedAt_idx" ON "QuestionComment"("questionId", "parentId", "sharedAt");
