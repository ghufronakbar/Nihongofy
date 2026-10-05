-- Phase B1 Bunpou: links from real JLPT questions to catalog points, imported
-- from src/bunpou-data/question-links by npm run seed:bunpou. Links hint at the
-- answer, so they follow the QuestionExplanation leak rule (never sent in exam
-- mode or before a practice question is answered).

CREATE TYPE "BunpouLinkRole" AS ENUM ('TESTED', 'DISTRACTOR');

CREATE TYPE "BunpouLinkConfidence" AS ENUM ('HIGH', 'LOW');

CREATE TABLE "QuestionBunpouLink" (
    "questionId" INTEGER NOT NULL,
    "pointId" INTEGER NOT NULL,
    "role" "BunpouLinkRole" NOT NULL,
    "confidence" "BunpouLinkConfidence" NOT NULL,
    "order" INTEGER NOT NULL,
    "aiModel" VARCHAR(120) NOT NULL,
    "promptVersion" VARCHAR(60) NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionBunpouLink_pkey" PRIMARY KEY ("questionId", "pointId")
);

CREATE INDEX "QuestionBunpouLink_pointId_role_idx" ON "QuestionBunpouLink"("pointId", "role");

ALTER TABLE "QuestionBunpouLink"
    ADD CONSTRAINT "QuestionBunpouLink_questionId_fkey"
    FOREIGN KEY ("questionId") REFERENCES "Question"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "QuestionBunpouLink"
    ADD CONSTRAINT "QuestionBunpouLink_pointId_fkey"
    FOREIGN KEY ("pointId") REFERENCES "BunpouPoint"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
