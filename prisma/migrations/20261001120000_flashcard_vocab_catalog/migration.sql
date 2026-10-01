-- Flashcard dirombak menjadi katalog kosakata bawaan (lihat docs/module/flashcard.md).
--
-- Konten buatan user (deck sendiri, note, impor, preset) dihapus. Kartu user
-- kini MERUJUK kata di katalog (FlashcardVocab), tidak lagi menyalinnya, dan
-- deck bawaan dibentuk dari tag taxonomy. Bentuk hampir semua tabel berubah,
-- jadi tabel lama dihapus lalu dibuat ulang alih-alih di-ALTER: `ADD COLUMN ...
-- NOT NULL` akan gagal pada FlashcardCollection yang sudah berisi baris.
--
-- Data yang hilang: 1 baris FlashcardCollection + 1 FlashcardPreset (setting
-- akun uji) dan katalog lama 4 deck / 335 note. Tidak ada kartu atau riwayat
-- review user — modul ini masih dimatikan lewat FEATURES_FLASHCARD.

-- DropTable (anak lebih dulu)
DROP TABLE IF EXISTS "FlashcardRevlog";
DROP TABLE IF EXISTS "FlashcardCard";
DROP TABLE IF EXISTS "FlashcardNote";
DROP TABLE IF EXISTS "FlashcardDeck";
DROP TABLE IF EXISTS "FlashcardPreset";
DROP TABLE IF EXISTS "FlashcardImportJob";
DROP TABLE IF EXISTS "FlashcardSystemNote";
DROP TABLE IF EXISTS "FlashcardSystemDeck";
DROP TABLE IF EXISTS "FlashcardCollection";

-- DropEnum
DROP TYPE IF EXISTS "FlashcardNoteTypeKind";
DROP TYPE IF EXISTS "FlashcardDeckSource";
DROP TYPE IF EXISTS "FlashcardImportStatus";
DROP TYPE IF EXISTS "FlashcardCardType";
DROP TYPE IF EXISTS "FlashcardCardQueue";
DROP TYPE IF EXISTS "FlashcardRating";
DROP TYPE IF EXISTS "FlashcardRevlogKind";

-- CreateEnum
CREATE TYPE "FlashcardDeckKind" AS ENUM ('LEVEL', 'TOPIC', 'CATEGORY');

-- CreateEnum
CREATE TYPE "FlashcardCardType" AS ENUM ('NEW', 'LEARNING', 'REVIEW', 'RELEARNING');

-- CreateEnum
CREATE TYPE "FlashcardCardQueue" AS ENUM ('NEW', 'LEARNING', 'DAY_LEARN', 'REVIEW');

-- CreateEnum
CREATE TYPE "FlashcardRating" AS ENUM ('AGAIN', 'HARD', 'GOOD', 'EASY');

-- CreateEnum
CREATE TYPE "FlashcardRevlogKind" AS ENUM ('LEARN', 'REVIEW', 'RELEARN', 'MANUAL', 'RESCHEDULED');

-- CreateTable
CREATE TABLE "FlashcardCollection" (
    "userId" INTEGER NOT NULL,
    "rolloverHour" INTEGER NOT NULL DEFAULT 4,
    "config" JSONB NOT NULL,
    "display" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlashcardCollection_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "FlashcardVocab" (
    "id" SERIAL NOT NULL,
    "key" VARCHAR(160) NOT NULL,
    "level" "JlptLevel" NOT NULL,
    "order" INTEGER NOT NULL,
    "word" VARCHAR(200) NOT NULL,
    "wordPlain" VARCHAR(200) NOT NULL,
    "reading" VARCHAR(200) NOT NULL,
    "meaningsId" TEXT[],
    "meaningsEn" TEXT[],
    "examples" JSONB NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "tags" TEXT[],
    "aiModel" VARCHAR(120) NOT NULL,
    "promptVersion" VARCHAR(60) NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "retiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlashcardVocab_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlashcardDeck" (
    "id" SERIAL NOT NULL,
    "slug" VARCHAR(60) NOT NULL,
    "kind" "FlashcardDeckKind" NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "nameJa" VARCHAR(120) NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "order" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlashcardDeck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlashcardDeckSubscription" (
    "userId" INTEGER NOT NULL,
    "deckId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FlashcardDeckSubscription_pkey" PRIMARY KEY ("userId","deckId")
);

-- CreateTable
CREATE TABLE "FlashcardCard" (
    "userId" INTEGER NOT NULL,
    "vocabId" INTEGER NOT NULL,
    "type" "FlashcardCardType" NOT NULL DEFAULT 'NEW',
    "queue" "FlashcardCardQueue" NOT NULL DEFAULT 'NEW',
    "due" TIMESTAMP(3) NOT NULL,
    "intervalDays" INTEGER NOT NULL DEFAULT 0,
    "reps" INTEGER NOT NULL DEFAULT 0,
    "lapses" INTEGER NOT NULL DEFAULT 0,
    "learningStep" INTEGER NOT NULL DEFAULT 0,
    "stability" DOUBLE PRECISION,
    "difficulty" DOUBLE PRECISION,
    "desiredRetention" DOUBLE PRECISION,
    "easeFactor" DOUBLE PRECISION,
    "lastReviewedAt" TIMESTAMP(3),
    "isSuspended" BOOLEAN NOT NULL DEFAULT false,
    "buriedUntil" TIMESTAMP(3),
    "isLeech" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlashcardCard_pkey" PRIMARY KEY ("userId","vocabId")
);

-- CreateTable
CREATE TABLE "FlashcardRevlog" (
    "id" BIGSERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "vocabId" INTEGER NOT NULL,
    "clientToken" VARCHAR(64),
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rating" "FlashcardRating" NOT NULL,
    "kind" "FlashcardRevlogKind" NOT NULL,
    "wasNew" BOOLEAN NOT NULL DEFAULT false,
    "intervalDays" INTEGER NOT NULL,
    "lastIntervalDays" INTEGER NOT NULL,
    "stability" DOUBLE PRECISION,
    "difficulty" DOUBLE PRECISION,
    "easeFactor" DOUBLE PRECISION,
    "takenMs" INTEGER NOT NULL DEFAULT 0,
    "previousState" JSONB,

    CONSTRAINT "FlashcardRevlog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FlashcardVocab_key_key" ON "FlashcardVocab"("key");

-- CreateIndex
CREATE INDEX "FlashcardVocab_level_order_idx" ON "FlashcardVocab"("level", "order");

-- CreateIndex
CREATE INDEX "FlashcardVocab_tags_idx" ON "FlashcardVocab" USING GIN ("tags");

-- CreateIndex
CREATE UNIQUE INDEX "FlashcardDeck_slug_key" ON "FlashcardDeck"("slug");

-- CreateIndex
CREATE INDEX "FlashcardDeck_isPublished_order_idx" ON "FlashcardDeck"("isPublished", "order");

-- CreateIndex
CREATE INDEX "FlashcardDeckSubscription_deckId_idx" ON "FlashcardDeckSubscription"("deckId");

-- CreateIndex
CREATE INDEX "FlashcardCard_userId_queue_due_idx" ON "FlashcardCard"("userId", "queue", "due");

-- CreateIndex
CREATE INDEX "FlashcardCard_vocabId_idx" ON "FlashcardCard"("vocabId");

-- CreateIndex
CREATE INDEX "FlashcardRevlog_userId_reviewedAt_idx" ON "FlashcardRevlog"("userId", "reviewedAt");

-- CreateIndex
CREATE INDEX "FlashcardRevlog_userId_vocabId_reviewedAt_idx" ON "FlashcardRevlog"("userId", "vocabId", "reviewedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FlashcardRevlog_userId_clientToken_key" ON "FlashcardRevlog"("userId", "clientToken");

-- AddForeignKey
ALTER TABLE "FlashcardCollection" ADD CONSTRAINT "FlashcardCollection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlashcardDeckSubscription" ADD CONSTRAINT "FlashcardDeckSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlashcardDeckSubscription" ADD CONSTRAINT "FlashcardDeckSubscription_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "FlashcardDeck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlashcardCard" ADD CONSTRAINT "FlashcardCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlashcardCard" ADD CONSTRAINT "FlashcardCard_vocabId_fkey" FOREIGN KEY ("vocabId") REFERENCES "FlashcardVocab"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlashcardRevlog" ADD CONSTRAINT "FlashcardRevlog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlashcardRevlog" ADD CONSTRAINT "FlashcardRevlog_userId_vocabId_fkey" FOREIGN KEY ("userId", "vocabId") REFERENCES "FlashcardCard"("userId", "vocabId") ON DELETE CASCADE ON UPDATE CASCADE;

-- Aturan project: tabel aplikasi tidak diberi grant ke role Data API Supabase.
-- RLS aktif tanpa policy karena seluruh akses melalui Prisma server-side.
REVOKE ALL PRIVILEGES ON TABLE "FlashcardCollection" FROM anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE "FlashcardVocab" FROM anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE "FlashcardDeck" FROM anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE "FlashcardDeckSubscription" FROM anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE "FlashcardCard" FROM anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE "FlashcardRevlog" FROM anon, authenticated, service_role;
ALTER TABLE "FlashcardCollection" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FlashcardVocab" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FlashcardDeck" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FlashcardDeckSubscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FlashcardCard" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FlashcardRevlog" ENABLE ROW LEVEL SECURITY;
