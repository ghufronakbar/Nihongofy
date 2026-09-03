-- AlterTable
ALTER TABLE "User" ADD COLUMN     "allowAudioStorage" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "allowConversationStorage" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "avatarBytes" INTEGER,
ADD COLUMN     "avatarFormat" VARCHAR(10),
ADD COLUMN     "avatarPublicId" VARCHAR(255),
ADD COLUMN     "deletionRequestedAt" TIMESTAMP(3),
ADD COLUMN     "deletionScheduledFor" TIMESTAMP(3),
ADD COLUMN     "timeZone" VARCHAR(100) NOT NULL DEFAULT 'Asia/Jakarta';

-- CreateIndex
CREATE UNIQUE INDEX "User_avatarPublicId_key" ON "User"("avatarPublicId");

-- Cron only scans accounts that have entered the deletion grace period.
CREATE INDEX "User_deletionScheduledFor_pending_idx"
ON "User"("deletionScheduledFor")
WHERE "deletionScheduledFor" IS NOT NULL;

ALTER TABLE "User" ADD CONSTRAINT "User_timeZone_not_blank" CHECK (
    char_length(trim("timeZone")) BETWEEN 1 AND 100
);

-- Legacy avatar URLs remain valid without metadata. Every newly managed asset
-- must store a complete metadata set so ownership and cleanup stay enforceable.
ALTER TABLE "User" ADD CONSTRAINT "User_avatar_metadata_valid" CHECK (
    (
        "avatarPublicId" IS NULL AND
        "avatarFormat" IS NULL AND
        "avatarBytes" IS NULL
    ) OR (
        "avatarUrl" IS NOT NULL AND
        "avatarPublicId" IS NOT NULL AND
        "avatarFormat" IN ('jpg', 'png', 'webp') AND
        "avatarBytes" BETWEEN 1 AND 3145728
    )
);

ALTER TABLE "User" ADD CONSTRAINT "User_deletion_schedule_valid" CHECK (
    (
        "deletionRequestedAt" IS NULL AND
        "deletionScheduledFor" IS NULL
    ) OR (
        "deletionRequestedAt" IS NOT NULL AND
        "deletionScheduledFor" IS NOT NULL AND
        "deletionScheduledFor" > "deletionRequestedAt"
    )
);
