-- CreateEnum
CREATE TYPE "ArticleStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "Article" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "body" JSONB NOT NULL,
    "bodyText" TEXT NOT NULL,
    "coverImage" TEXT NOT NULL,
    "coverAlt" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "authorRole" TEXT,
    "category" TEXT NOT NULL,
    "categorySlug" TEXT NOT NULL,
    "status" "ArticleStatus" NOT NULL DEFAULT 'DRAFT',
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "readTime" INTEGER NOT NULL,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "favoriteCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArticleTag" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArticleTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArticleTagLink" (
    "id" SERIAL NOT NULL,
    "articleId" INTEGER NOT NULL,
    "tagId" INTEGER NOT NULL,

    CONSTRAINT "ArticleTagLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArticleInteraction" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "articleId" INTEGER NOT NULL,
    "saved" BOOLEAN NOT NULL DEFAULT false,
    "favorited" BOOLEAN NOT NULL DEFAULT false,
    "lastViewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArticleInteraction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Article_slug_key" ON "Article"("slug");

-- CreateIndex
CREATE INDEX "Article_status_publishedAt_id_idx" ON "Article"("status", "publishedAt", "id");

-- CreateIndex
CREATE INDEX "Article_status_isFeatured_publishedAt_idx" ON "Article"("status", "isFeatured", "publishedAt");

-- CreateIndex
CREATE INDEX "Article_status_categorySlug_publishedAt_idx" ON "Article"("status", "categorySlug", "publishedAt");

-- Keep the two public sort modes fast without indexing draft content.
CREATE INDEX "Article_published_viewCount_id_idx" ON "Article"("viewCount" DESC, "id" DESC)
WHERE "status" = 'PUBLISHED';

CREATE INDEX "Article_published_favoriteCount_id_idx" ON "Article"("favoriteCount" DESC, "id" DESC)
WHERE "status" = 'PUBLISHED';

-- CreateIndex
CREATE UNIQUE INDEX "ArticleTag_slug_key" ON "ArticleTag"("slug");

-- CreateIndex
CREATE INDEX "ArticleTagLink_tagId_idx" ON "ArticleTagLink"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "ArticleTagLink_articleId_tagId_key" ON "ArticleTagLink"("articleId", "tagId");

-- CreateIndex
CREATE INDEX "ArticleInteraction_articleId_idx" ON "ArticleInteraction"("articleId");

-- CreateIndex
CREATE INDEX "ArticleInteraction_userId_saved_updatedAt_idx" ON "ArticleInteraction"("userId", "saved", "updatedAt");

-- CreateIndex
CREATE INDEX "ArticleInteraction_userId_favorited_updatedAt_idx" ON "ArticleInteraction"("userId", "favorited", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ArticleInteraction_userId_articleId_key" ON "ArticleInteraction"("userId", "articleId");

-- AddForeignKey
ALTER TABLE "ArticleTagLink" ADD CONSTRAINT "ArticleTagLink_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleTagLink" ADD CONSTRAINT "ArticleTagLink_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "ArticleTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleInteraction" ADD CONSTRAINT "ArticleInteraction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleInteraction" ADD CONSTRAINT "ArticleInteraction_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Protect content invariants even when a write bypasses Prisma.
ALTER TABLE "Article" ADD CONSTRAINT "Article_slug_valid" CHECK (
    "slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
);
ALTER TABLE "Article" ADD CONSTRAINT "Article_categorySlug_valid" CHECK (
    "categorySlug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
);
ALTER TABLE "Article" ADD CONSTRAINT "Article_readTime_valid" CHECK (
    "readTime" BETWEEN 1 AND 60
);
ALTER TABLE "Article" ADD CONSTRAINT "Article_counters_valid" CHECK (
    "viewCount" >= 0 AND "favoriteCount" >= 0
);
ALTER TABLE "Article" ADD CONSTRAINT "Article_publish_state_valid" CHECK (
    "status" <> 'PUBLISHED' OR "publishedAt" IS NOT NULL
);

-- Custom credential auth uses numeric User.id and server-side Prisma. Do not
-- expose these tables through Supabase Data API roles or auth.uid() policies.
REVOKE ALL PRIVILEGES ON TABLE
    "Article",
    "ArticleTag",
    "ArticleTagLink",
    "ArticleInteraction"
FROM anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON SEQUENCE
    "Article_id_seq",
    "ArticleTag_id_seq",
    "ArticleTagLink_id_seq",
    "ArticleInteraction_id_seq"
FROM anon, authenticated, service_role;

ALTER TABLE "Article" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ArticleTag" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ArticleTagLink" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ArticleInteraction" ENABLE ROW LEVEL SECURITY;
