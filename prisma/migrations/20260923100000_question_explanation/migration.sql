-- CreateEnum
CREATE TYPE "QuestionExplanationSource" AS ENUM ('AI', 'HUMAN', 'IMPORTED');

-- AlterTable
ALTER TABLE "Question" DROP COLUMN "explanation";

-- CreateTable
CREATE TABLE "QuestionExplanation" (
    "id" SERIAL NOT NULL,
    "questionId" INTEGER NOT NULL,
    "summary" TEXT NOT NULL,
    "detail" TEXT,
    "translation" TEXT,
    "keyPoints" TEXT[],
    "answerKeyDoubt" BOOLEAN NOT NULL DEFAULT false,
    "answerKeyDoubtNote" TEXT,
    "source" "QuestionExplanationSource" NOT NULL DEFAULT 'AI',
    "aiModel" VARCHAR(64),
    "promptVersion" VARCHAR(32),
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionExplanation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionExplanationChoice" (
    "id" SERIAL NOT NULL,
    "explanationId" INTEGER NOT NULL,
    "codeAnswer" INTEGER NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionExplanationChoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QuestionExplanation_questionId_key" ON "QuestionExplanation"("questionId");

-- CreateIndex
CREATE INDEX "QuestionExplanation_answerKeyDoubt_idx" ON "QuestionExplanation"("answerKeyDoubt");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionExplanationChoice_explanationId_codeAnswer_key" ON "QuestionExplanationChoice"("explanationId", "codeAnswer");

-- AddForeignKey
ALTER TABLE "QuestionExplanation" ADD CONSTRAINT "QuestionExplanation_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionExplanationChoice" ADD CONSTRAINT "QuestionExplanationChoice_explanationId_fkey" FOREIGN KEY ("explanationId") REFERENCES "QuestionExplanation"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- EnableRowLevelSecurity
-- Aturan project: tabel aplikasi tidak diberi grant ke role Data API Supabase.
-- RLS aktif tanpa policy karena seluruh akses melalui Prisma server-side.
ALTER TABLE "QuestionExplanation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "QuestionExplanationChoice" ENABLE ROW LEVEL SECURITY;
