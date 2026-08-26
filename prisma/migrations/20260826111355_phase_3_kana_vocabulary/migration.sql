-- CreateEnum
CREATE TYPE "FlashcardDeckKind" AS ENUM ('VOCABULARY');

-- CreateEnum
CREATE TYPE "FlashcardLearningState" AS ENUM ('LEARNING', 'REVIEW');

-- CreateEnum
CREATE TYPE "FlashcardRating" AS ENUM ('AGAIN', 'HARD', 'GOOD', 'EASY');

-- CreateTable
CREATE TABLE "KanaProgress" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "kanaKey" TEXT NOT NULL,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "againCount" INTEGER NOT NULL DEFAULT 0,
    "lastViewedAt" TIMESTAMP(3),
    "lastGradedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KanaProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlashcardDeck" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "kind" "FlashcardDeckKind" NOT NULL DEFAULT 'VOCABULARY',
    "jlptLevel" "JlptLevel" NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlashcardDeck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Flashcard" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "reading" TEXT NOT NULL,
    "romaji" TEXT NOT NULL,
    "meaning" TEXT NOT NULL,
    "jlptLevel" "JlptLevel" NOT NULL,
    "audioText" TEXT,
    "audioUrl" TEXT,
    "usageExamples" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Flashcard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlashcardDeckItem" (
    "id" SERIAL NOT NULL,
    "deckId" INTEGER NOT NULL,
    "flashcardId" INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FlashcardDeckItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlashcardTag" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlashcardTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlashcardTagLink" (
    "id" SERIAL NOT NULL,
    "flashcardId" INTEGER NOT NULL,
    "tagId" INTEGER NOT NULL,

    CONSTRAINT "FlashcardTagLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlashcardProgress" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "flashcardId" INTEGER NOT NULL,
    "state" "FlashcardLearningState" NOT NULL DEFAULT 'LEARNING',
    "dueAt" TIMESTAMP(3) NOT NULL,
    "intervalDays" INTEGER NOT NULL DEFAULT 0,
    "easeFactor" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "repetitions" INTEGER NOT NULL DEFAULT 0,
    "lapses" INTEGER NOT NULL DEFAULT 0,
    "lastReviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlashcardProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlashcardReviewLog" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "flashcardId" INTEGER NOT NULL,
    "rating" "FlashcardRating" NOT NULL,
    "previousInterval" INTEGER NOT NULL,
    "scheduledInterval" INTEGER NOT NULL,
    "previousEaseFactor" DOUBLE PRECISION NOT NULL,
    "nextEaseFactor" DOUBLE PRECISION NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlashcardReviewLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KanaProgress_userId_updatedAt_idx" ON "KanaProgress"("userId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "KanaProgress_userId_kanaKey_key" ON "KanaProgress"("userId", "kanaKey");

-- CreateIndex
CREATE UNIQUE INDEX "FlashcardDeck_slug_key" ON "FlashcardDeck"("slug");

-- CreateIndex
CREATE INDEX "FlashcardDeck_isPublished_order_idx" ON "FlashcardDeck"("isPublished", "order");

-- CreateIndex
CREATE UNIQUE INDEX "Flashcard_key_key" ON "Flashcard"("key");

-- CreateIndex
CREATE INDEX "Flashcard_jlptLevel_idx" ON "Flashcard"("jlptLevel");

-- CreateIndex
CREATE INDEX "FlashcardDeckItem_flashcardId_idx" ON "FlashcardDeckItem"("flashcardId");

-- CreateIndex
CREATE UNIQUE INDEX "FlashcardDeckItem_deckId_flashcardId_key" ON "FlashcardDeckItem"("deckId", "flashcardId");

-- CreateIndex
CREATE UNIQUE INDEX "FlashcardDeckItem_deckId_order_key" ON "FlashcardDeckItem"("deckId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "FlashcardTag_slug_key" ON "FlashcardTag"("slug");

-- CreateIndex
CREATE INDEX "FlashcardTagLink_tagId_idx" ON "FlashcardTagLink"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "FlashcardTagLink_flashcardId_tagId_key" ON "FlashcardTagLink"("flashcardId", "tagId");

-- CreateIndex
CREATE INDEX "FlashcardProgress_userId_dueAt_idx" ON "FlashcardProgress"("userId", "dueAt");

-- CreateIndex
CREATE INDEX "FlashcardProgress_flashcardId_idx" ON "FlashcardProgress"("flashcardId");

-- CreateIndex
CREATE UNIQUE INDEX "FlashcardProgress_userId_flashcardId_key" ON "FlashcardProgress"("userId", "flashcardId");

-- CreateIndex
CREATE INDEX "FlashcardReviewLog_userId_reviewedAt_idx" ON "FlashcardReviewLog"("userId", "reviewedAt");

-- CreateIndex
CREATE INDEX "FlashcardReviewLog_flashcardId_idx" ON "FlashcardReviewLog"("flashcardId");

-- AddForeignKey
ALTER TABLE "KanaProgress" ADD CONSTRAINT "KanaProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlashcardDeckItem" ADD CONSTRAINT "FlashcardDeckItem_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "FlashcardDeck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlashcardDeckItem" ADD CONSTRAINT "FlashcardDeckItem_flashcardId_fkey" FOREIGN KEY ("flashcardId") REFERENCES "Flashcard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlashcardTagLink" ADD CONSTRAINT "FlashcardTagLink_flashcardId_fkey" FOREIGN KEY ("flashcardId") REFERENCES "Flashcard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlashcardTagLink" ADD CONSTRAINT "FlashcardTagLink_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "FlashcardTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlashcardProgress" ADD CONSTRAINT "FlashcardProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlashcardProgress" ADD CONSTRAINT "FlashcardProgress_flashcardId_fkey" FOREIGN KEY ("flashcardId") REFERENCES "Flashcard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlashcardReviewLog" ADD CONSTRAINT "FlashcardReviewLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlashcardReviewLog" ADD CONSTRAINT "FlashcardReviewLog_flashcardId_fkey" FOREIGN KEY ("flashcardId") REFERENCES "Flashcard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Guard scheduler counters and intervals against invalid writes outside Prisma.
ALTER TABLE "KanaProgress" ADD CONSTRAINT "KanaProgress_counts_nonnegative" CHECK (
    "viewCount" >= 0 AND "correctCount" >= 0 AND "againCount" >= 0
);
ALTER TABLE "FlashcardProgress" ADD CONSTRAINT "FlashcardProgress_scheduler_values_valid" CHECK (
    "intervalDays" >= 0 AND "easeFactor" >= 1.3 AND "repetitions" >= 0 AND "lapses" >= 0
);
ALTER TABLE "FlashcardReviewLog" ADD CONSTRAINT "FlashcardReviewLog_scheduler_values_valid" CHECK (
    "previousInterval" >= 0 AND "scheduledInterval" >= 0 AND
    "previousEaseFactor" >= 1.3 AND "nextEaseFactor" >= 1.3
);

-- These tables are server-only through Prisma. Keep Supabase Data API roles out
-- and use RLS as defense in depth, matching the Phase 2 access model.
REVOKE ALL PRIVILEGES ON TABLE
    "KanaProgress",
    "FlashcardDeck",
    "Flashcard",
    "FlashcardDeckItem",
    "FlashcardTag",
    "FlashcardTagLink",
    "FlashcardProgress",
    "FlashcardReviewLog"
FROM anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON SEQUENCE
    "KanaProgress_id_seq",
    "FlashcardDeck_id_seq",
    "Flashcard_id_seq",
    "FlashcardDeckItem_id_seq",
    "FlashcardTag_id_seq",
    "FlashcardTagLink_id_seq",
    "FlashcardProgress_id_seq",
    "FlashcardReviewLog_id_seq"
FROM anon, authenticated, service_role;

ALTER TABLE "KanaProgress" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FlashcardDeck" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Flashcard" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FlashcardDeckItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FlashcardTag" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FlashcardTagLink" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FlashcardProgress" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FlashcardReviewLog" ENABLE ROW LEVEL SECURITY;
