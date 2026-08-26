-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "displayName" TEXT,
ADD COLUMN     "email" TEXT,
ALTER COLUMN "username" DROP NOT NULL;

-- Preserve the existing account and its related attempts/comments.
UPDATE "User"
SET "displayName" = "username"
WHERE "displayName" IS NULL;

ALTER TABLE "User" ALTER COLUMN "displayName" SET NOT NULL;

-- CreateTable
CREATE TABLE "AuthRateLimit" (
    "keyHash" TEXT NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 1,
    "windowStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "blockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthRateLimit_pkey" PRIMARY KEY ("keyHash")
);

-- CreateIndex
CREATE INDEX "AuthRateLimit_updatedAt_idx" ON "AuthRateLimit"("updatedAt");

-- CreateIndex
CREATE INDEX "Attempt_userId_idx" ON "Attempt"("userId");

-- CreateIndex
CREATE INDEX "Attempt_testPackageId_idx" ON "Attempt"("testPackageId");

-- CreateIndex
CREATE INDEX "AttemptAnswer_questionId_idx" ON "AttemptAnswer"("questionId");

-- CreateIndex
CREATE INDEX "Question_questionContextId_idx" ON "Question"("questionContextId");

-- CreateIndex
CREATE INDEX "QuestionComment_questionId_idx" ON "QuestionComment"("questionId");

-- CreateIndex
CREATE INDEX "QuestionComment_userId_idx" ON "QuestionComment"("userId");

-- CreateIndex
CREATE INDEX "QuestionContext_testPackageId_idx" ON "QuestionContext"("testPackageId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- The application uses server-side Prisma with a custom JWT, not Supabase Auth.
-- Public Data API roles therefore receive no direct access to application data.
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated, service_role;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated, service_role;

-- Prevent future Prisma-created objects from inheriting Supabase's broad defaults.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
REVOKE ALL PRIVILEGES ON TABLES FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
REVOKE ALL PRIVILEGES ON SEQUENCES FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated, service_role;

-- RLS is defense in depth for every table in the exposed public schema.
-- No policies are added because browser clients must not query these tables.
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuthRateLimit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TestPackage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TestPackageItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "QuestionContext" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Question" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "QuestionChoice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "QuestionComment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Attempt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AttemptAnswer" ENABLE ROW LEVEL SECURITY;
