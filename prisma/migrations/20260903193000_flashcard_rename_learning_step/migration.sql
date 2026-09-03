-- ts-fsrs menyimpan `learning_steps` sebagai INDEX step yang sedang berjalan,
-- bukan sisa step seperti kolom `left` di Anki. Nama kolom disamakan dengan
-- semantik yang benar sebelum ada data yang menempel padanya.
ALTER TABLE "FlashcardCard" RENAME COLUMN "remainingSteps" TO "learningStep";
