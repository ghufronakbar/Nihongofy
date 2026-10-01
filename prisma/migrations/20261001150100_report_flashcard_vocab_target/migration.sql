-- Kartu flashcard sebagai target laporan, bagian 2: kolom, FK, dan constraint.
-- Nilai enum yang dipakai di sini ditambahkan oleh
-- 20261001150000_report_flashcard_vocab_enum (lihat alasannya di sana).
--
-- Target menunjuk kata di katalog (FlashcardVocab), bukan kartu milik user: isi
-- kartu semua user berasal dari baris yang sama, jadi satu perbaikan fixture lalu
-- `seed:flashcard` memperbaiki kartu semua orang.

ALTER TABLE "Report" ADD COLUMN "vocabId" INTEGER;

-- SET NULL, sama seperti FK target lain: laporan tidak boleh ikut terhapus
-- bersama targetnya, dan juga tidak boleh menahan penghapusannya. Katalog memang
-- tidak pernah menghapus kata (kata yang tidak dipakai lagi diberi `retiredAt`),
-- dan penghapusan yang tidak disengaja sudah ditahan FlashcardCard.vocabId yang
-- Restrict. `targetLabel` memuat level dan key kata, jadi baris yang FK-nya
-- menjadi NULL tetap menunjuk entri fixture yang perlu diperbaiki.
ALTER TABLE "Report"
    ADD CONSTRAINT "Report_vocabId_fkey"
    FOREIGN KEY ("vocabId") REFERENCES "FlashcardVocab"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- FK lookup dan hitungan "+N laporan lain di target ini" di antrean admin.
CREATE INDEX "Report_vocabId_idx" ON "Report"("vocabId");

-- Laporan kartu tidak boleh membawa FK target lain, dan laporan target lain tidak
-- boleh membawa vocabId. Sisi "target harus ada" tetap TIDAK di database, dengan
-- alasan yang sama seperti di 20260926230000_report_inbox: dengan ON DELETE SET
-- NULL, CHECK semacam itu akan menggagalkan penghapusan targetnya. Kewajiban itu
-- ditegakkan `SubmitReportSchema` di src/features/report/schemas.ts.
--
-- Seluruh baris lama punya vocabId NULL, jadi constraint baru langsung terpenuhi.
ALTER TABLE "Report" DROP CONSTRAINT "Report_target_columns_check";
ALTER TABLE "Report"
    ADD CONSTRAINT "Report_target_columns_check" CHECK (
        ("targetType" IN ('QUESTION', 'QUESTION_EXPLANATION') OR "questionId" IS NULL)
        AND ("targetType" = 'ARTICLE' OR "articleId" IS NULL)
        AND ("targetType" = 'COMMENT' OR "commentId" IS NULL)
        AND ("targetType" = 'FLASHCARD_VOCAB' OR "vocabId" IS NULL)
    );

-- Anti-banjir: satu pelapor yang dikenal hanya boleh punya satu laporan OPEN per
-- kartu, sama seperti tiga partial unique index di 20260926230000_report_inbox.
-- Guest tidak punya identitas yang dapat dijadikan kunci; di sana rate limit per
-- IP yang bekerja. Tanpa targetType di kunci karena vocabId hanya melayani satu
-- jenis target (berbeda dari questionId).
CREATE UNIQUE INDEX "Report_open_vocab_per_reporter_key"
    ON "Report"("reporterId", "vocabId")
    WHERE "status" = 'OPEN' AND "reporterId" IS NOT NULL AND "vocabId" IS NOT NULL;

-- Tidak ada tabel baru: kolom ini mewarisi revoke grant Data API dan RLS yang
-- sudah aktif pada tabel "Report".
