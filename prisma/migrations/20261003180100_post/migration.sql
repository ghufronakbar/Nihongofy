-- Postingan komunitas (tahap 3 modul komunitas): tabel Post dan PostLike,
-- komentar postingan sebagai target keempat QuestionComment, dan postingan
-- sebagai target laporan. Rancangan: docs/module/community.md#tahap-3--postingan.
--
-- Nilai enum 'POST' ditambahkan oleh 20261003180000_report_post_enum.
-- Kolom lama hanya bertambah kolom nullable; tidak ada data yang diubah.

-- CreateTable
CREATE TABLE "Post" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "images" TEXT[],
    "editedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "deletedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostLike" (
    "postId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- PK sekaligus penjaga satu like per user per postingan dan index groupBy.
    CONSTRAINT "PostLike_pkey" PRIMARY KEY ("postId","userId")
);

-- CreateIndex
-- Tab Postingan di profil dan tab "Mengikuti". Feed global memakai PK.
CREATE INDEX "Post_userId_id_idx" ON "Post"("userId", "id");

-- CreateIndex
CREATE INDEX "Post_deletedById_idx" ON "Post"("deletedById");

-- CreateIndex
-- Anonimisasi akun dan export data akun mencari per user.
CREATE INDEX "PostLike_userId_idx" ON "PostLike"("userId");

-- AddForeignKey
-- Restrict: penulis dianonimkan, bukan dihapus; komentar orang lain menempel
-- pada postingan ini.
ALTER TABLE "Post" ADD CONSTRAINT "Post_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
-- SetNull: jejak takedown tidak boleh menahan penghapusan akun admin.
ALTER TABLE "Post" ADD CONSTRAINT "Post_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
-- Cascade hanya jaring pengaman: postingan tidak pernah di-hard delete, dan
-- takedown (soft delete) tidak menghapus like.
ALTER TABLE "PostLike" ADD CONSTRAINT "PostLike_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostLike" ADD CONSTRAINT "PostLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Supabase Data API: akses hanya lewat Prisma server-side.
REVOKE ALL PRIVILEGES ON TABLE "Post" FROM anon, authenticated, service_role;
ALTER TABLE "Post" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "PostLike" FROM anon, authenticated, service_role;
ALTER TABLE "PostLike" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON SEQUENCE "Post_id_seq" FROM anon, authenticated, service_role;

-- ------------------------------------------------------------
-- QuestionComment: target keempat
-- ------------------------------------------------------------

-- AlterTable
ALTER TABLE "QuestionComment" ADD COLUMN "postId" INTEGER;

-- Tepat satu target. Seluruh baris lama punya tepat satu dari tiga kolom lama
-- dan postId NULL, jadi constraint baru langsung terpenuhi. FK postId Restrict
-- (tidak pernah SET NULL), jadi CHECK ini tidak dapat menggagalkan penghapusan.
ALTER TABLE "QuestionComment" DROP CONSTRAINT "QuestionComment_target_check";
ALTER TABLE "QuestionComment"
    ADD CONSTRAINT "QuestionComment_target_check"
    CHECK (num_nonnulls("questionId", "vocabId", "bunpouPointId", "postId") = 1);

-- CreateIndex
CREATE INDEX "QuestionComment_postId_idx" ON "QuestionComment"("postId");

-- CreateIndex
CREATE INDEX "QuestionComment_postId_parentId_sharedAt_idx" ON "QuestionComment"("postId", "parentId", "sharedAt");

-- AddForeignKey
ALTER TABLE "QuestionComment" ADD CONSTRAINT "QuestionComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ------------------------------------------------------------
-- Report: postingan sebagai target laporan
-- ------------------------------------------------------------

ALTER TABLE "Report" ADD COLUMN "postId" INTEGER;

-- SET NULL, sama seperti FK target lain: laporan tidak boleh ikut terhapus
-- bersama targetnya, dan juga tidak boleh menahan penghapusannya.
ALTER TABLE "Report"
    ADD CONSTRAINT "Report_postId_fkey"
    FOREIGN KEY ("postId") REFERENCES "Post"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- FK lookup dan hitungan "+N laporan lain di target ini" di antrean admin.
CREATE INDEX "Report_postId_idx" ON "Report"("postId");

-- Tiap jenis target hanya membawa FK miliknya sendiri. Seluruh baris lama punya
-- postId NULL, jadi constraint baru langsung terpenuhi.
ALTER TABLE "Report" DROP CONSTRAINT "Report_target_columns_check";
ALTER TABLE "Report"
    ADD CONSTRAINT "Report_target_columns_check" CHECK (
        ("targetType" IN ('QUESTION', 'QUESTION_EXPLANATION') OR "questionId" IS NULL)
        AND ("targetType" = 'ARTICLE' OR "articleId" IS NULL)
        AND ("targetType" = 'COMMENT' OR "commentId" IS NULL)
        AND ("targetType" = 'FLASHCARD_VOCAB' OR "vocabId" IS NULL)
        AND ("targetType" = 'BUNPOU_POINT' OR "bunpouPointId" IS NULL)
        AND ("targetType" = 'BUNPOU_COMPARISON' OR "bunpouComparisonId" IS NULL)
        AND ("targetType" = 'POST' OR "postId" IS NULL)
    );

-- Anti-banjir: satu pelapor yang dikenal hanya boleh punya satu laporan OPEN per
-- postingan, sama seperti partial unique index target lain.
CREATE UNIQUE INDEX "Report_open_post_per_reporter_key"
    ON "Report"("reporterId", "postId")
    WHERE "status" = 'OPEN' AND "reporterId" IS NOT NULL AND "postId" IS NOT NULL;
