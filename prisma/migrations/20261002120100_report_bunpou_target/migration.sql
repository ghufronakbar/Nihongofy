-- Katalog bunpou sebagai target laporan, bagian 2: kolom, FK, dan constraint.
-- Nilai enum yang dipakai di sini ditambahkan oleh
-- 20261002120000_report_bunpou_enum (lihat alasannya di sana).
--
-- Target menunjuk baris katalog (BunpouPoint/BunpouComparison). Isinya tidak
-- diedit dari admin; perbaikannya lewat fixture src/bunpou-data/ lalu
-- `seed:bunpou`.

ALTER TABLE "Report" ADD COLUMN "bunpouPointId" INTEGER;
ALTER TABLE "Report" ADD COLUMN "bunpouComparisonId" INTEGER;

-- SET NULL, sama seperti FK target lain: laporan tidak boleh ikut terhapus
-- bersama targetnya, dan juga tidak boleh menahan penghapusannya. Katalog tidak
-- pernah menghapus baris (yang tidak dipakai diberi `retiredAt`), dan
-- `targetLabel` memuat key, jadi baris yang FK-nya menjadi NULL tetap menunjuk
-- entri fixture yang perlu diperbaiki.
ALTER TABLE "Report"
    ADD CONSTRAINT "Report_bunpouPointId_fkey"
    FOREIGN KEY ("bunpouPointId") REFERENCES "BunpouPoint"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Report"
    ADD CONSTRAINT "Report_bunpouComparisonId_fkey"
    FOREIGN KEY ("bunpouComparisonId") REFERENCES "BunpouComparison"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- FK lookup dan hitungan "+N laporan lain di target ini" di antrean admin.
CREATE INDEX "Report_bunpouPointId_idx" ON "Report"("bunpouPointId");
CREATE INDEX "Report_bunpouComparisonId_idx" ON "Report"("bunpouComparisonId");

-- Tiap jenis target hanya membawa FK miliknya sendiri. Sisi "target harus ada"
-- tetap ditegakkan SubmitReportSchema, bukan di sini (lihat
-- 20260926230000_report_inbox). Seluruh baris lama punya kedua kolom NULL, jadi
-- constraint baru langsung terpenuhi.
ALTER TABLE "Report" DROP CONSTRAINT "Report_target_columns_check";
ALTER TABLE "Report"
    ADD CONSTRAINT "Report_target_columns_check" CHECK (
        ("targetType" IN ('QUESTION', 'QUESTION_EXPLANATION') OR "questionId" IS NULL)
        AND ("targetType" = 'ARTICLE' OR "articleId" IS NULL)
        AND ("targetType" = 'COMMENT' OR "commentId" IS NULL)
        AND ("targetType" = 'FLASHCARD_VOCAB' OR "vocabId" IS NULL)
        AND ("targetType" = 'BUNPOU_POINT' OR "bunpouPointId" IS NULL)
        AND ("targetType" = 'BUNPOU_COMPARISON' OR "bunpouComparisonId" IS NULL)
    );

-- Anti-banjir: satu pelapor yang dikenal hanya boleh punya satu laporan OPEN per
-- pola dan per perbandingan, sama seperti partial unique index target lain.
CREATE UNIQUE INDEX "Report_open_bunpou_point_per_reporter_key"
    ON "Report"("reporterId", "bunpouPointId")
    WHERE "status" = 'OPEN' AND "reporterId" IS NOT NULL AND "bunpouPointId" IS NOT NULL;
CREATE UNIQUE INDEX "Report_open_bunpou_comparison_per_reporter_key"
    ON "Report"("reporterId", "bunpouComparisonId")
    WHERE "status" = 'OPEN' AND "reporterId" IS NOT NULL AND "bunpouComparisonId" IS NOT NULL;

-- Tidak ada tabel baru: kolom ini mewarisi revoke grant Data API dan RLS yang
-- sudah aktif pada tabel "Report".
