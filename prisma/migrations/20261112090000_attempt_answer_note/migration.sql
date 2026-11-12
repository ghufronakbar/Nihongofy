-- Catatan yang ditulis selama sesi mock exam berjalan. Draft per soal yang ikut
-- tersimpan otomatis; saat sesi disubmit dipindahkan menjadi QuestionComment
-- privat lalu dikosongkan. Nullable tanpa default: tidak menulis ulang tabel.
ALTER TABLE "AttemptAnswer" ADD COLUMN "note" TEXT;
