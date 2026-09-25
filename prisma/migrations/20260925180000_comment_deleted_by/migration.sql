-- Atribusi penghapusan komentar. Dibutuhkan begitu admin dapat melakukan
-- takedown: tanpa ini `deletedAt` tidak memberi tahu siapa yang menghapus,
-- sehingga pemulihan tidak dapat membedakan takedown admin dari hapusan
-- pemilik — dan hanya yang pertama yang boleh dipulihkan.
ALTER TABLE "QuestionComment" ADD COLUMN "deletedById" INTEGER;

-- SET NULL, bukan CASCADE: menghapus akun admin tidak boleh ikut menghapus
-- komentar milik user lain yang pernah ia takedown.
ALTER TABLE "QuestionComment"
    ADD CONSTRAINT "QuestionComment_deletedById_fkey"
    FOREIGN KEY ("deletedById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "QuestionComment_deletedById_idx" ON "QuestionComment"("deletedById");

-- Antrean moderasi membaca seluruh entri publik lintas soal, terbaru dulu.
CREATE INDEX "QuestionComment_sharedAt_idx" ON "QuestionComment"("sharedAt");

-- Baris lama yang sudah terhapus berasal dari sebelum admin ada, jadi
-- seluruhnya adalah hapusan pemilik. Diisi eksplisit agar tidak tertukar
-- dengan takedown admin yang deletedById-nya memang terisi.
UPDATE "QuestionComment" SET "deletedById" = "userId" WHERE "deletedAt" IS NOT NULL;
