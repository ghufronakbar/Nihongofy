-- Idempotency key review dipindah dari primary key ke kolom terpisah.
--
-- Primary key revlog bersifat global. Kalau client yang menentukannya, satu user
-- bisa mengklaim id di masa depan dan membuat review user lain ditolak diam-diam
-- sebagai "sudah tercatat". Dengan @@unique([userId, clientToken]) tabrakan hanya
-- mungkin terjadi di dalam satu akun, dan di situ memang itu perilaku yang benar.
ALTER TABLE "FlashcardRevlog" ADD COLUMN "clientToken" VARCHAR(64);
CREATE UNIQUE INDEX "FlashcardRevlog_userId_clientToken_key" ON "FlashcardRevlog"("userId", "clientToken");
