-- CreateEnum
CREATE TYPE "PracticeSessionStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABANDONED');

-- CreateTable
CREATE TABLE "PracticeSession" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "jlptLevel" "JlptLevel" NOT NULL,
    "section" "JlptSection" NOT NULL,
    "mondaiType" "MondaiType" NOT NULL,
    "questionCount" INTEGER NOT NULL,
    "status" "PracticeSessionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PracticeSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticeAnswer" (
    "id" SERIAL NOT NULL,
    "practiceSessionId" INTEGER NOT NULL,
    "questionId" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "selectedAnswer" INTEGER,
    "isCorrect" BOOLEAN,
    "answeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PracticeAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PracticeSession_userId_startedAt_idx" ON "PracticeSession"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "PracticeSession_status_idx" ON "PracticeSession"("status");

-- CreateIndex
CREATE INDEX "PracticeSession_jlptLevel_section_mondaiType_idx" ON "PracticeSession"("jlptLevel", "section", "mondaiType");

-- CreateIndex
CREATE INDEX "PracticeAnswer_questionId_idx" ON "PracticeAnswer"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "PracticeAnswer_practiceSessionId_questionId_key" ON "PracticeAnswer"("practiceSessionId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "PracticeAnswer_practiceSessionId_order_key" ON "PracticeAnswer"("practiceSessionId", "order");

-- AddForeignKey
ALTER TABLE "PracticeSession" ADD CONSTRAINT "PracticeSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeAnswer" ADD CONSTRAINT "PracticeAnswer_practiceSessionId_fkey" FOREIGN KEY ("practiceSessionId") REFERENCES "PracticeSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeAnswer" ADD CONSTRAINT "PracticeAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Keep practice rows internally consistent even when writes bypass Prisma.
ALTER TABLE "PracticeSession" ADD CONSTRAINT "PracticeSession_questionCount_valid" CHECK (
    "questionCount" BETWEEN 1 AND 20
);
ALTER TABLE "PracticeAnswer" ADD CONSTRAINT "PracticeAnswer_order_valid" CHECK (
    "order" > 0
);
ALTER TABLE "PracticeAnswer" ADD CONSTRAINT "PracticeAnswer_selectedAnswer_valid" CHECK (
    "selectedAnswer" IS NULL OR "selectedAnswer" BETWEEN 1 AND 4
);
ALTER TABLE "PracticeAnswer" ADD CONSTRAINT "PracticeAnswer_feedback_state_valid" CHECK (
    (
        "answeredAt" IS NULL AND
        "selectedAnswer" IS NULL AND
        "isCorrect" IS NULL
    ) OR (
        "answeredAt" IS NOT NULL AND
        "selectedAnswer" IS NOT NULL AND
        "isCorrect" IS NOT NULL
    )
);

-- The application uses custom JWT auth and accesses these tables only through
-- server-side Prisma. Keep all Supabase Data API roles out and enable RLS as
-- defense in depth without policies that assume Supabase Auth UUID ownership.
REVOKE ALL PRIVILEGES ON TABLE
    "PracticeSession",
    "PracticeAnswer"
FROM anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON SEQUENCE
    "PracticeSession_id_seq",
    "PracticeAnswer_id_seq"
FROM anon, authenticated, service_role;

ALTER TABLE "PracticeSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PracticeAnswer" ENABLE ROW LEVEL SECURITY;
