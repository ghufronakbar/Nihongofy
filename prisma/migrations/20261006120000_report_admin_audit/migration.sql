-- Admin mengaudit soal lewat form laporan dan perlu dapat mengirim lebih dari
-- satu laporan OPEN pada target yang sama (mis. beberapa temuan terpisah di satu
-- soal). Partial index tidak dapat membaca role pelapor, jadi role itu
-- disnapshot ke baris laporan saat dibuat. Snapshot, bukan join: demote admin
-- tidak boleh membuat baris lama tiba-tiba melanggar index.
ALTER TABLE "Report" ADD COLUMN "fromAdmin" BOOLEAN NOT NULL DEFAULT false;

-- Index anti-banjir dibuat ulang dengan pengecualian laporan admin. Bagi pelapor
-- lain aturannya tidak berubah: satu laporan OPEN per target.
DROP INDEX "Report_open_question_per_reporter_key";
DROP INDEX "Report_open_article_per_reporter_key";
DROP INDEX "Report_open_comment_per_reporter_key";
DROP INDEX "Report_open_vocab_per_reporter_key";
DROP INDEX "Report_open_bunpou_point_per_reporter_key";
DROP INDEX "Report_open_bunpou_comparison_per_reporter_key";
DROP INDEX "Report_open_post_per_reporter_key";

CREATE UNIQUE INDEX "Report_open_question_per_reporter_key"
    ON "Report"("reporterId", "targetType", "questionId")
    WHERE "status" = 'OPEN' AND "reporterId" IS NOT NULL AND "questionId" IS NOT NULL AND NOT "fromAdmin";

CREATE UNIQUE INDEX "Report_open_article_per_reporter_key"
    ON "Report"("reporterId", "articleId")
    WHERE "status" = 'OPEN' AND "reporterId" IS NOT NULL AND "articleId" IS NOT NULL AND NOT "fromAdmin";

CREATE UNIQUE INDEX "Report_open_comment_per_reporter_key"
    ON "Report"("reporterId", "commentId")
    WHERE "status" = 'OPEN' AND "reporterId" IS NOT NULL AND "commentId" IS NOT NULL AND NOT "fromAdmin";

CREATE UNIQUE INDEX "Report_open_vocab_per_reporter_key"
    ON "Report"("reporterId", "vocabId")
    WHERE "status" = 'OPEN' AND "reporterId" IS NOT NULL AND "vocabId" IS NOT NULL AND NOT "fromAdmin";

CREATE UNIQUE INDEX "Report_open_bunpou_point_per_reporter_key"
    ON "Report"("reporterId", "bunpouPointId")
    WHERE "status" = 'OPEN' AND "reporterId" IS NOT NULL AND "bunpouPointId" IS NOT NULL AND NOT "fromAdmin";

CREATE UNIQUE INDEX "Report_open_bunpou_comparison_per_reporter_key"
    ON "Report"("reporterId", "bunpouComparisonId")
    WHERE "status" = 'OPEN' AND "reporterId" IS NOT NULL AND "bunpouComparisonId" IS NOT NULL AND NOT "fromAdmin";

CREATE UNIQUE INDEX "Report_open_post_per_reporter_key"
    ON "Report"("reporterId", "postId")
    WHERE "status" = 'OPEN' AND "reporterId" IS NOT NULL AND "postId" IS NOT NULL AND NOT "fromAdmin";

-- Tidak ada tabel baru: kolom ini mewarisi revoke grant Data API dan RLS yang
-- sudah aktif pada tabel "Report".
