-- Kartu flashcard sebagai target laporan, bagian 1: nilai enum saja.
--
-- Sengaja dipisah dari migration berikutnya. PostgreSQL menolak memakai nilai
-- enum yang ditambahkan di transaksi yang sama ("unsafe use of new value",
-- SQLSTATE 55P04), dan `prisma migrate deploy` menjalankan satu file migration
-- sebagai satu transaksi. CHECK constraint yang menyebut 'FLASHCARD_VOCAB' ada di
-- 20261001150100_report_flashcard_vocab_target, yang berjalan setelah file ini
-- di-commit. Jangan menggabungkan keduanya.
--
-- ADD VALUE selalu menambah di akhir; urutan di schema.prisma mengikutinya.

ALTER TYPE "ReportTargetType" ADD VALUE 'FLASHCARD_VOCAB';

-- Kategori konten kartu kosakata: bacaan/furigana, arti (termasuk catatan),
-- contoh kalimat, dan tag. Peta kategori per target tetap di
-- src/features/report/constants.ts dan ditegakkan zod, bukan CHECK constraint.
ALTER TYPE "ReportCategory" ADD VALUE 'READING_ERROR';
ALTER TYPE "ReportCategory" ADD VALUE 'MEANING_ERROR';
ALTER TYPE "ReportCategory" ADD VALUE 'EXAMPLE_ERROR';
ALTER TYPE "ReportCategory" ADD VALUE 'TAG_ERROR';
