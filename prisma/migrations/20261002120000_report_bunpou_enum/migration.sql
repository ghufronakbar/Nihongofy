-- Katalog bunpou sebagai target laporan, bagian 1: nilai enum saja.
--
-- Sengaja dipisah dari 20261002120100_report_bunpou_target dengan alasan yang
-- sama seperti 20261001150000_report_flashcard_vocab_enum: PostgreSQL menolak
-- memakai nilai enum yang ditambahkan di transaksi yang sama (SQLSTATE 55P04),
-- dan CHECK constraint di migration berikutnya menyebut nilai-nilai ini.
--
-- ADD VALUE selalu menambah di akhir; urutan di schema.prisma mengikutinya.

ALTER TYPE "ReportTargetType" ADD VALUE 'BUNPOU_POINT';
ALTER TYPE "ReportTargetType" ADD VALUE 'BUNPOU_COMPARISON';

-- Sambungan (接続) atau tabel pembentukan pola yang keliru. Kategori konten lain
-- untuk pola (arti, contoh, furigana) memakai ulang kategori kartu flashcard;
-- peta kategori per target ada di src/features/report/constants.ts.
ALTER TYPE "ReportCategory" ADD VALUE 'CONNECTION_ERROR';
