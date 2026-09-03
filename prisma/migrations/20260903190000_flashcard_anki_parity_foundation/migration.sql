-- Modul vocabulary lama (SM-2 custom, konten global ternormalisasi) diganti
-- total oleh modul flashcard paritas Anki. Tabel lama di-DROP, bukan dimigrasi:
-- isinya hanya konten fixture (32 kartu, 6 deck) tanpa satu pun review user,
-- jadi tidak ada progres belajar yang hilang.
--
-- FlashcardDeck ikut di-DROP meski namanya sama, karena bentuknya berubah total
-- (deck global published -> deck milik user dengan nama hierarkis + preset).

-- DropTable
DROP TABLE IF EXISTS "FlashcardTagLink";
DROP TABLE IF EXISTS "FlashcardTag";
DROP TABLE IF EXISTS "FlashcardReviewLog";
DROP TABLE IF EXISTS "FlashcardProgress";
DROP TABLE IF EXISTS "FlashcardSetting";
DROP TABLE IF EXISTS "FlashcardDeckItem";
DROP TABLE IF EXISTS "Flashcard";
DROP TABLE IF EXISTS "FlashcardDeck";

-- DropEnum
DROP TYPE IF EXISTS "FlashcardDeckKind";
DROP TYPE IF EXISTS "FlashcardLearningState";

-- CreateEnum
CREATE TYPE "FlashcardNoteTypeKind" AS ENUM ('BASIC', 'BASIC_REVERSED', 'VOCAB_JP', 'KANJI', 'CLOZE');
CREATE TYPE "FlashcardDeckSource" AS ENUM ('SYSTEM', 'IMPORTED', 'MANUAL');
CREATE TYPE "FlashcardCardType" AS ENUM ('NEW', 'LEARNING', 'REVIEW', 'RELEARNING');
CREATE TYPE "FlashcardCardQueue" AS ENUM ('NEW', 'LEARNING', 'REVIEW', 'DAY_LEARN', 'SUSPENDED', 'BURIED_USER', 'BURIED_SIBLING');
CREATE TYPE "FlashcardRevlogKind" AS ENUM ('LEARN', 'REVIEW', 'RELEARN', 'MANUAL', 'RESCHEDULED');
CREATE TYPE "FlashcardImportStatus" AS ENUM ('PENDING', 'PARSING', 'IMPORTING', 'DONE', 'FAILED');

-- CreateTable
CREATE TABLE "FlashcardCollection" (
    "userId" INTEGER NOT NULL,
    "createdAtDay" TIMESTAMP(3) NOT NULL,
    "rolloverHour" INTEGER NOT NULL DEFAULT 4,
    "timeZone" VARCHAR(100) NOT NULL DEFAULT 'Asia/Jakarta',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlashcardCollection_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "FlashcardPreset" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlashcardPreset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlashcardDeck" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "name" VARCHAR(500) NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "collapsed" BOOLEAN NOT NULL DEFAULT false,
    "presetId" INTEGER NOT NULL,
    "sourceKind" "FlashcardDeckSource" NOT NULL DEFAULT 'MANUAL',
    "sourceRef" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlashcardDeck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlashcardNote" (
    "id" BIGINT NOT NULL,
    "userId" INTEGER NOT NULL,
    "noteType" "FlashcardNoteTypeKind" NOT NULL,
    "guid" VARCHAR(64) NOT NULL,
    "fields" TEXT[],
    "tags" TEXT[],
    "checksum" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlashcardNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlashcardCard" (
    "id" BIGINT NOT NULL,
    "userId" INTEGER NOT NULL,
    "noteId" BIGINT NOT NULL,
    "deckId" INTEGER NOT NULL,
    "ord" INTEGER NOT NULL,
    "type" "FlashcardCardType" NOT NULL DEFAULT 'NEW',
    "queue" "FlashcardCardQueue" NOT NULL DEFAULT 'NEW',
    "due" TIMESTAMP(3) NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "intervalDays" INTEGER NOT NULL DEFAULT 0,
    "reps" INTEGER NOT NULL DEFAULT 0,
    "lapses" INTEGER NOT NULL DEFAULT 0,
    "remainingSteps" INTEGER NOT NULL DEFAULT 0,
    "flags" INTEGER NOT NULL DEFAULT 0,
    "stability" DOUBLE PRECISION,
    "difficulty" DOUBLE PRECISION,
    "desiredRetention" DOUBLE PRECISION,
    "easeFactor" DOUBLE PRECISION,
    "lastReviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlashcardCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlashcardRevlog" (
    "id" BIGINT NOT NULL,
    "userId" INTEGER NOT NULL,
    "cardId" BIGINT NOT NULL,
    "deckId" INTEGER NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rating" "FlashcardRating" NOT NULL,
    "kind" "FlashcardRevlogKind" NOT NULL,
    "intervalDays" INTEGER NOT NULL,
    "lastIntervalDays" INTEGER NOT NULL,
    "stability" DOUBLE PRECISION,
    "difficulty" DOUBLE PRECISION,
    "easeFactor" DOUBLE PRECISION,
    "takenMs" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FlashcardRevlog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlashcardImportJob" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "status" "FlashcardImportStatus" NOT NULL DEFAULT 'PENDING',
    "fileName" VARCHAR(255) NOT NULL,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "doneRows" INTEGER NOT NULL DEFAULT 0,
    "stats" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlashcardImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FlashcardPreset_userId_name_key" ON "FlashcardPreset"("userId", "name");
CREATE INDEX "FlashcardDeck_userId_idx" ON "FlashcardDeck"("userId");
CREATE INDEX "FlashcardDeck_presetId_idx" ON "FlashcardDeck"("presetId");
CREATE UNIQUE INDEX "FlashcardDeck_userId_name_key" ON "FlashcardDeck"("userId", "name");
CREATE INDEX "FlashcardNote_userId_noteType_checksum_idx" ON "FlashcardNote"("userId", "noteType", "checksum");
CREATE UNIQUE INDEX "FlashcardNote_userId_guid_key" ON "FlashcardNote"("userId", "guid");
CREATE INDEX "FlashcardCard_userId_deckId_queue_due_idx" ON "FlashcardCard"("userId", "deckId", "queue", "due");
CREATE INDEX "FlashcardCard_userId_queue_due_idx" ON "FlashcardCard"("userId", "queue", "due");
CREATE INDEX "FlashcardCard_deckId_idx" ON "FlashcardCard"("deckId");
CREATE UNIQUE INDEX "FlashcardCard_noteId_ord_key" ON "FlashcardCard"("noteId", "ord");
CREATE INDEX "FlashcardRevlog_userId_reviewedAt_idx" ON "FlashcardRevlog"("userId", "reviewedAt");
CREATE INDEX "FlashcardRevlog_cardId_reviewedAt_idx" ON "FlashcardRevlog"("cardId", "reviewedAt");
CREATE INDEX "FlashcardRevlog_userId_deckId_reviewedAt_idx" ON "FlashcardRevlog"("userId", "deckId", "reviewedAt");
CREATE INDEX "FlashcardImportJob_userId_status_idx" ON "FlashcardImportJob"("userId", "status");

-- AddForeignKey
ALTER TABLE "FlashcardCollection" ADD CONSTRAINT "FlashcardCollection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FlashcardPreset" ADD CONSTRAINT "FlashcardPreset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FlashcardDeck" ADD CONSTRAINT "FlashcardDeck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FlashcardDeck" ADD CONSTRAINT "FlashcardDeck_presetId_fkey" FOREIGN KEY ("presetId") REFERENCES "FlashcardPreset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FlashcardNote" ADD CONSTRAINT "FlashcardNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FlashcardCard" ADD CONSTRAINT "FlashcardCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FlashcardCard" ADD CONSTRAINT "FlashcardCard_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "FlashcardNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FlashcardCard" ADD CONSTRAINT "FlashcardCard_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "FlashcardDeck"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FlashcardRevlog" ADD CONSTRAINT "FlashcardRevlog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FlashcardRevlog" ADD CONSTRAINT "FlashcardRevlog_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "FlashcardCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FlashcardImportJob" ADD CONSTRAINT "FlashcardImportJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
