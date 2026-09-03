-- OAuth-only accounts do not have a credential hash until the user creates one.
ALTER TABLE "User" ALTER COLUMN "password" DROP NOT NULL;

-- Email is immutable from this release onward. Invalidate links created by the
-- retired email-change flow while retaining the enum value for migration safety.
DELETE FROM "AuthToken" WHERE "purpose" = 'EMAIL_CHANGE';

CREATE TYPE "OAuthProvider" AS ENUM ('GOOGLE');

CREATE TABLE "OAuthAccount" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "provider" "OAuthProvider" NOT NULL,
    "providerAccountId" VARCHAR(255) NOT NULL,
    "providerEmail" VARCHAR(254) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OAuthAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OAuthAccount_provider_providerAccountId_key"
ON "OAuthAccount"("provider", "providerAccountId");

-- This unique index also covers the userId foreign-key prefix for cascade and lookup.
CREATE UNIQUE INDEX "OAuthAccount_userId_provider_key"
ON "OAuthAccount"("userId", "provider");

ALTER TABLE "OAuthAccount"
ADD CONSTRAINT "OAuthAccount_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OAuthAccount" ADD CONSTRAINT "OAuthAccount_provider_identity_not_blank" CHECK (
    char_length(trim("providerAccountId")) BETWEEN 1 AND 255 AND
    char_length(trim("providerEmail")) BETWEEN 3 AND 254
);

-- OAuth identities are reachable only through server-side Prisma.
REVOKE ALL PRIVILEGES ON TABLE "OAuthAccount"
FROM anon, authenticated, service_role;

ALTER TABLE "OAuthAccount" ENABLE ROW LEVEL SECURITY;
