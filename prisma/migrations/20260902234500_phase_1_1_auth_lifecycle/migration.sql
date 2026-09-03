-- CreateEnum
CREATE TYPE "AuthTokenPurpose" AS ENUM ('EMAIL_VERIFICATION', 'EMAIL_CHANGE', 'PASSWORD_RESET');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3);

-- Existing accounts predate verification and must not be locked out by this rollout.
UPDATE "User"
SET "emailVerifiedAt" = CURRENT_TIMESTAMP
WHERE "email" IS NOT NULL;

-- CreateTable
CREATE TABLE "AuthToken" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "purpose" "AuthTokenPurpose" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "targetEmail" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuthToken_tokenHash_key" ON "AuthToken"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthToken_expiresAt_idx" ON "AuthToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuthToken_userId_purpose_key" ON "AuthToken"("userId", "purpose");

-- AddForeignKey
ALTER TABLE "AuthToken" ADD CONSTRAINT "AuthToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AuthToken" ADD CONSTRAINT "AuthToken_tokenHash_length" CHECK (
    char_length("tokenHash") = 64
);

ALTER TABLE "AuthToken" ADD CONSTRAINT "AuthToken_targetEmail_purpose" CHECK (
    ("purpose" = 'EMAIL_CHANGE' AND "targetEmail" IS NOT NULL) OR
    ("purpose" <> 'EMAIL_CHANGE' AND "targetEmail" IS NULL)
);

-- Custom credential auth accesses this table only through server-side Prisma.
REVOKE ALL PRIVILEGES ON TABLE "AuthToken"
FROM anon, authenticated, service_role;

ALTER TABLE "AuthToken" ENABLE ROW LEVEL SECURITY;
