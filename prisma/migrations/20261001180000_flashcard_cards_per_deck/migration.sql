-- Kartu flashcard menjadi milik satu deck, dan pengaturan penjadwalan pindah
-- dari koleksi user ke tiap deck (lihat docs/module/flashcard.md).
--
-- Sebelumnya satu kata = satu kartu per user, dibagi semua deck yang memuatnya,
-- dengan satu pengaturan untuk semua deck. Kini kata yang ada di dua deck adalah
-- dua kartu terpisah (PK userId + deckId + vocabId), masing-masing dijadwalkan
-- dengan `FlashcardDeckSubscription.config` deck pemiliknya. Batas harian
-- dihitung per deck lewat `FlashcardRevlog.deckId`; tidak ada batas global.
--
-- Data user flashcard dikosongkan: progres lama tidak punya deck pemilik dan
-- modul ini masih dimatikan lewat FEATURES_FLASHCARD, jadi isinya hanya data uji.
-- Katalog (FlashcardVocab, FlashcardDeck) dan laporan kartu tidak disentuh.
-- Kolom `NOT NULL` baru di bawah juga membutuhkan tabel yang kosong.
TRUNCATE TABLE "FlashcardRevlog", "FlashcardCard", "FlashcardDeckSubscription", "FlashcardCollection";

-- DropForeignKey
ALTER TABLE "FlashcardRevlog" DROP CONSTRAINT "FlashcardRevlog_userId_vocabId_fkey";

-- DropIndex
DROP INDEX "FlashcardCard_userId_queue_due_idx";

-- DropIndex
DROP INDEX "FlashcardRevlog_userId_vocabId_reviewedAt_idx";

-- AlterTable
ALTER TABLE "FlashcardCollection" DROP COLUMN "config";

-- AlterTable
ALTER TABLE "FlashcardDeckSubscription" ADD COLUMN     "config" JSONB NOT NULL,
ADD COLUMN     "unsubscribedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "FlashcardCard" DROP CONSTRAINT "FlashcardCard_pkey",
ADD COLUMN     "deckId" INTEGER NOT NULL,
ADD CONSTRAINT "FlashcardCard_pkey" PRIMARY KEY ("userId", "deckId", "vocabId");

-- AlterTable
ALTER TABLE "FlashcardRevlog" ADD COLUMN     "deckId" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "FlashcardCard_userId_deckId_queue_due_idx" ON "FlashcardCard"("userId", "deckId", "queue", "due");

-- CreateIndex
CREATE INDEX "FlashcardRevlog_userId_deckId_reviewedAt_idx" ON "FlashcardRevlog"("userId", "deckId", "reviewedAt");

-- CreateIndex
CREATE INDEX "FlashcardRevlog_userId_deckId_vocabId_reviewedAt_idx" ON "FlashcardRevlog"("userId", "deckId", "vocabId", "reviewedAt");

-- AddForeignKey
ALTER TABLE "FlashcardCard" ADD CONSTRAINT "FlashcardCard_userId_deckId_fkey" FOREIGN KEY ("userId", "deckId") REFERENCES "FlashcardDeckSubscription"("userId", "deckId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlashcardRevlog" ADD CONSTRAINT "FlashcardRevlog_userId_deckId_vocabId_fkey" FOREIGN KEY ("userId", "deckId", "vocabId") REFERENCES "FlashcardCard"("userId", "deckId", "vocabId") ON DELETE CASCADE ON UPDATE CASCADE;

-- Tidak ada tabel baru: kolom-kolom ini mewarisi revoke grant Data API dan RLS
-- yang sudah berlaku pada tabelnya.
