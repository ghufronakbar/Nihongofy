-- Transkrip audio CHOUKAI disimpan terpisah dari teks soal/konteks agar tidak
-- ikut masuk payload peserta. Hanya hasil yang sudah ditinjau manusia yang
-- diimpor; OCR mentah tetap berada di staging lokal.

CREATE TYPE "QuestionTranscriptSource" AS ENUM ('AI', 'HUMAN', 'IMPORTED');

CREATE TABLE "QuestionAudioTranscript" (
    "id" SERIAL NOT NULL,
    "questionId" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "source" "QuestionTranscriptSource" NOT NULL DEFAULT 'AI',
    "aiModel" VARCHAR(120),
    "promptVersion" VARCHAR(60),
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionAudioTranscript_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "QuestionAudioTranscript_text_check" CHECK (length(btrim("text")) > 0),
    CONSTRAINT "QuestionAudioTranscript_ai_metadata_check" CHECK (
        "source" <> 'AI' OR ("aiModel" IS NOT NULL AND "promptVersion" IS NOT NULL)
    )
);

-- Satu soal hanya memiliki satu transkrip. Unique index ini sekaligus menjadi
-- index foreign key untuk lookup dan ON DELETE CASCADE.
CREATE UNIQUE INDEX "QuestionAudioTranscript_questionId_key"
    ON "QuestionAudioTranscript"("questionId");

ALTER TABLE "QuestionAudioTranscript"
    ADD CONSTRAINT "QuestionAudioTranscript_questionId_fkey"
    FOREIGN KEY ("questionId") REFERENCES "Question"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Supabase Data API: tidak ada akses langsung; seluruh penggunaan melalui
-- Prisma server-side/offline script. Tidak dibuat policy publik.
REVOKE ALL PRIVILEGES ON TABLE "QuestionAudioTranscript" FROM anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON SEQUENCE "QuestionAudioTranscript_id_seq" FROM anon, authenticated, service_role;
ALTER TABLE "QuestionAudioTranscript" ENABLE ROW LEVEL SECURITY;
