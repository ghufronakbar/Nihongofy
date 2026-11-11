-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "coverCredit" TEXT,
ADD COLUMN     "coverCreditUrl" TEXT,
ADD COLUMN     "discussionEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "draft" JSONB,
ADD COLUMN     "excerptJa" TEXT,
ADD COLUMN     "glossary" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "hasJapanese" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "readingLevel" "JlptLevel",
ADD COLUMN     "titleJa" TEXT;

-- AlterTable
ALTER TABLE "QuestionComment" ADD COLUMN     "articleId" INTEGER,
ADD COLUMN     "isPinned" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Article_status_readingLevel_publishedAt_idx" ON "Article"("status", "readingLevel", "publishedAt");

-- CreateIndex
CREATE INDEX "QuestionComment_articleId_parentId_sharedAt_idx" ON "QuestionComment"("articleId", "parentId", "sharedAt");

-- AddForeignKey
ALTER TABLE "QuestionComment" ADD CONSTRAINT "QuestionComment_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Keep the shared discussion target exclusive, including articles.
ALTER TABLE "QuestionComment" DROP CONSTRAINT "QuestionComment_target_check";
ALTER TABLE "QuestionComment" ADD CONSTRAINT "QuestionComment_target_check"
CHECK (num_nonnulls("questionId", "vocabId", "bunpouPointId", "postId", "articleId") = 1);
ALTER TABLE "QuestionComment" ADD CONSTRAINT "QuestionComment_article_pin_check"
CHECK (NOT "isPinned" OR ("articleId" IS NOT NULL AND "parentId" IS NULL));
ALTER TABLE "QuestionComment" ADD CONSTRAINT "QuestionComment_article_shared_check"
CHECK ("articleId" IS NULL OR "sharedAt" IS NOT NULL);
ALTER TABLE "Article" ADD CONSTRAINT "Article_japanese_metadata_check"
CHECK (NOT "hasJapanese" OR (NULLIF(btrim("titleJa"), '') IS NOT NULL AND NULLIF(btrim("excerptJa"), '') IS NOT NULL AND "readingLevel" IS NOT NULL));
-- Reconcile legacy aggregate likes before enforcing the counter invariant.
UPDATE "Article" a SET "favoriteCount" = (SELECT count(*)::integer FROM "ArticleInteraction" i WHERE i."articleId" = a.id AND i.favorited);
ALTER TABLE "Article" ADD CONSTRAINT "Article_counters_check" CHECK ("favoriteCount" >= 0 AND "viewCount" >= 0);
-- Both existing tables retain RLS and the server-only, no-Data-API privilege model.
