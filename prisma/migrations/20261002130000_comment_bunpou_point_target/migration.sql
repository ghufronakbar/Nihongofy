-- Catatan dan diskusi untuk pola bunpou, target ketiga tabel QuestionComment
-- setelah soal dan kata flashcard (20261002090000_comment_flashcard_vocab_target).
-- Aturan tombstone, balasan, mention, moderasi, laporan, rate limit, dan
-- anonimisasi akun langsung berlaku.
--
-- Target per entri katalog (`BunpouPoint`), yaitu satu makna di satu level.
-- Hanya menambah kolom nullable; tidak ada data yang diubah.

-- AlterTable
ALTER TABLE "QuestionComment" ADD COLUMN "bunpouPointId" INTEGER;

-- Tepat satu target. Seluruh baris lama punya tepat satu dari questionId/vocabId
-- dan bunpouPointId NULL, jadi constraint baru langsung terpenuhi. FK ketiga
-- target tidak pernah SET NULL (Cascade untuk soal, Restrict untuk kata dan pola),
-- sehingga CHECK ini tidak dapat menggagalkan penghapusan.
ALTER TABLE "QuestionComment" DROP CONSTRAINT "QuestionComment_target_check";
ALTER TABLE "QuestionComment"
    ADD CONSTRAINT "QuestionComment_target_check"
    CHECK (num_nonnulls("questionId", "vocabId", "bunpouPointId") = 1);

-- CreateIndex
CREATE INDEX "QuestionComment_bunpouPointId_idx" ON "QuestionComment"("bunpouPointId");

-- CreateIndex
CREATE INDEX "QuestionComment_bunpouPointId_userId_deletedAt_idx" ON "QuestionComment"("bunpouPointId", "userId", "deletedAt");

-- CreateIndex
CREATE INDEX "QuestionComment_bunpouPointId_parentId_sharedAt_idx" ON "QuestionComment"("bunpouPointId", "parentId", "sharedAt");

-- AddForeignKey
-- Restrict: katalog tidak pernah menghapus pola (hanya `retiredAt`), dan
-- penghapusan yang tidak disengaja tidak boleh ikut memusnahkan percakapan.
ALTER TABLE "QuestionComment" ADD CONSTRAINT "QuestionComment_bunpouPointId_fkey" FOREIGN KEY ("bunpouPointId") REFERENCES "BunpouPoint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Tidak ada tabel baru: kolom ini mewarisi revoke grant Data API dan RLS yang
-- sudah berlaku pada QuestionComment.
