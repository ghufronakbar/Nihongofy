-- Suspend posting diskusi per user: rem darurat moderasi untuk penyalahgunaan
-- berulang tanpa menghapus akun. User yang di-suspend tidak dapat menulis ke
-- diskusi publik (membagikan, membalas, menulis langsung, menyunting entri
-- publik) pada target mana pun; catatan privat tetap boleh. Konten publik yang
-- sudah ada tidak berubah — takedown tetap lewat /admin/moderation.
--
-- Hanya menambah kolom nullable; tidak ada data yang diubah.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "postingSuspendedAt" TIMESTAMP(3),
ADD COLUMN "postingSuspendedReason" VARCHAR(500),
ADD COLUMN "postingSuspendedById" INTEGER;

-- Alasan dan admin hanya bermakna selama suspend berlaku. `postingSuspendedById`
-- boleh NULL saat suspend berlaku (akun admin-nya terhapus → SET NULL), jadi
-- yang dikunci hanya arah sebaliknya. Seluruh baris lama punya ketiganya NULL.
ALTER TABLE "User"
    ADD CONSTRAINT "User_posting_suspension_check"
    CHECK (
        "postingSuspendedAt" IS NOT NULL
        OR ("postingSuspendedReason" IS NULL AND "postingSuspendedById" IS NULL)
    );

-- CreateIndex
CREATE INDEX "User_postingSuspendedById_idx" ON "User"("postingSuspendedById");

-- AddForeignKey
-- SET NULL: jejak siapa yang men-suspend tidak boleh menahan penghapusan akun
-- admin, sama seperti AdminAuditLog.actorId dan QuestionComment.deletedById.
ALTER TABLE "User" ADD CONSTRAINT "User_postingSuspendedById_fkey" FOREIGN KEY ("postingSuspendedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Tidak ada tabel baru: kolom ini mewarisi revoke grant Data API dan RLS yang
-- sudah berlaku pada User.
