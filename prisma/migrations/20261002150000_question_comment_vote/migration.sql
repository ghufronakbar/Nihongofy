-- Upvote "membantu" pada entri diskusi publik (soal, kata flashcard, pola bunpou
-- — satu tabel QuestionComment). Satu suara per user per entri, bisa ditarik,
-- tanpa downvote. Rancangan: docs/module/question-comment.md#upvote.
--
-- Hanya membuat tabel baru; tidak ada data lama yang diubah.

-- CreateTable
CREATE TABLE "QuestionCommentVote" (
    "commentId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- PK (commentId, userId) sekaligus menjadi index groupBy per entri.
    CONSTRAINT "QuestionCommentVote_pkey" PRIMARY KEY ("commentId","userId")
);

-- CreateIndex
-- Anonimisasi akun (deleteMany per user) dan export data akun mencari per user.
CREATE INDEX "QuestionCommentVote_userId_idx" ON "QuestionCommentVote"("userId");

-- AddForeignKey
-- Cascade ke comment hanya jaring pengaman: comment tidak pernah di-hard delete
-- oleh aplikasi, dan takedown (soft delete) sengaja tidak menghapus suara.
ALTER TABLE "QuestionCommentVote" ADD CONSTRAINT "QuestionCommentVote_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "QuestionComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
-- Data milik user; anonymizeAccount menghapusnya eksplisit karena baris User
-- bertahan. Cascade berlaku untuk hard delete di luar alur normal.
ALTER TABLE "QuestionCommentVote" ADD CONSTRAINT "QuestionCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Supabase Data API: akses hanya lewat Prisma server-side.
REVOKE ALL PRIVILEGES ON TABLE "QuestionCommentVote" FROM anon, authenticated, service_role;
ALTER TABLE "QuestionCommentVote" ENABLE ROW LEVEL SECURITY;
