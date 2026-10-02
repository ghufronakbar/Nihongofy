-- Catatan dan diskusi untuk kata flashcard memakai tabel QuestionComment yang
-- sama dengan catatan soal (lihat docs/module/question-comment.md): aturan
-- tombstone, balasan, mention, moderasi admin, laporan, dan anonimisasi akun
-- langsung berlaku untuk keduanya.
--
-- Hanya menambah kolom nullable dan melonggarkan `questionId`; tidak ada data
-- yang diubah. Baris lama semuanya punya `questionId`, jadi CHECK di bawah
-- langsung terpenuhi.

-- AlterTable
ALTER TABLE "QuestionComment" ADD COLUMN     "vocabId" INTEGER,
ALTER COLUMN "questionId" DROP NOT NULL;

-- Tepat satu target. Prisma tidak dapat mengekspresikannya, jadi constraint ini
-- hanya ada di sini. FK kedua target tidak pernah SET NULL (Cascade untuk soal,
-- Restrict untuk kata), sehingga CHECK ini tidak dapat menggagalkan penghapusan.
ALTER TABLE "QuestionComment"
    ADD CONSTRAINT "QuestionComment_target_check" CHECK (num_nonnulls("questionId", "vocabId") = 1);

-- CreateIndex
CREATE INDEX "QuestionComment_vocabId_idx" ON "QuestionComment"("vocabId");

-- CreateIndex
CREATE INDEX "QuestionComment_vocabId_userId_deletedAt_idx" ON "QuestionComment"("vocabId", "userId", "deletedAt");

-- CreateIndex
CREATE INDEX "QuestionComment_vocabId_parentId_sharedAt_idx" ON "QuestionComment"("vocabId", "parentId", "sharedAt");

-- AddForeignKey
ALTER TABLE "QuestionComment" ADD CONSTRAINT "QuestionComment_vocabId_fkey" FOREIGN KEY ("vocabId") REFERENCES "FlashcardVocab"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Tidak ada tabel baru: kolom ini mewarisi revoke grant Data API dan RLS yang
-- sudah berlaku pada QuestionComment.
