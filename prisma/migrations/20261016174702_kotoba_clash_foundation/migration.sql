-- CreateEnum
CREATE TYPE "KotobaClashRoomStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "KotobaClashMatchStatus" AS ENUM ('RUNNING', 'FINISHED');

-- CreateTable
CREATE TABLE "KotobaClashRoom" (
    "id" UUID NOT NULL,
    "code" VARCHAR(8) NOT NULL,
    "hostUserId" INTEGER,
    "status" "KotobaClashRoomStatus" NOT NULL DEFAULT 'OPEN',
    "config" JSONB,
    "configRevision" INTEGER NOT NULL DEFAULT 0,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "KotobaClashRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KotobaClashRoomMember" (
    "id" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "userId" INTEGER,
    "guestHash" VARCHAR(64),
    "guestExpiresAt" TIMESTAMPTZ(3),
    "nickname" VARCHAR(24) NOT NULL,
    "nicknameKey" VARCHAR(48),
    "readyRevision" INTEGER,
    "spectating" BOOLEAN NOT NULL DEFAULT false,
    "anonymizedAt" TIMESTAMPTZ(3),
    "joinedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KotobaClashRoomMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KotobaClashMatch" (
    "id" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "startRequestId" UUID NOT NULL,
    "status" "KotobaClashMatchStatus" NOT NULL DEFAULT 'RUNNING',
    "rulesVersion" INTEGER NOT NULL DEFAULT 1,
    "config" JSONB NOT NULL,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KotobaClashMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KotobaClashMatchPlayer" (
    "id" UUID NOT NULL,
    "matchId" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "memberId" UUID NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "wrongCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "bestStreak" INTEGER NOT NULL DEFAULT 0,
    "correctTimeMs" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "KotobaClashMatchPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KotobaClashRound" (
    "id" UUID NOT NULL,
    "matchId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,
    "revealEndsAt" TIMESTAMPTZ(3) NOT NULL,
    "finalizedAt" TIMESTAMPTZ(3),

    CONSTRAINT "KotobaClashRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KotobaClashAnswer" (
    "id" UUID NOT NULL,
    "matchId" UUID NOT NULL,
    "roundId" UUID NOT NULL,
    "playerId" UUID NOT NULL,
    "choice" INTEGER NOT NULL,
    "acceptedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "KotobaClashAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KotobaClashRoom_code_key" ON "KotobaClashRoom"("code");

-- CreateIndex
CREATE INDEX "KotobaClashRoom_hostUserId_idx" ON "KotobaClashRoom"("hostUserId");

-- CreateIndex
CREATE INDEX "KotobaClashRoom_status_expiresAt_idx" ON "KotobaClashRoom"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "KotobaClashRoomMember_userId_idx" ON "KotobaClashRoomMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "KotobaClashRoomMember_id_roomId_key" ON "KotobaClashRoomMember"("id", "roomId");

-- CreateIndex
CREATE UNIQUE INDEX "KotobaClashRoomMember_roomId_userId_key" ON "KotobaClashRoomMember"("roomId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "KotobaClashRoomMember_roomId_guestHash_key" ON "KotobaClashRoomMember"("roomId", "guestHash");

-- CreateIndex
CREATE UNIQUE INDEX "KotobaClashRoomMember_roomId_nicknameKey_key" ON "KotobaClashRoomMember"("roomId", "nicknameKey");

-- CreateIndex
CREATE INDEX "KotobaClashMatch_expiresAt_idx" ON "KotobaClashMatch"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "KotobaClashMatch_id_roomId_key" ON "KotobaClashMatch"("id", "roomId");

-- CreateIndex
CREATE UNIQUE INDEX "KotobaClashMatch_roomId_startRequestId_key" ON "KotobaClashMatch"("roomId", "startRequestId");

-- CreateIndex
CREATE INDEX "KotobaClashMatchPlayer_matchId_roomId_idx" ON "KotobaClashMatchPlayer"("matchId", "roomId");

-- CreateIndex
CREATE INDEX "KotobaClashMatchPlayer_memberId_roomId_idx" ON "KotobaClashMatchPlayer"("memberId", "roomId");

-- CreateIndex
CREATE UNIQUE INDEX "KotobaClashMatchPlayer_id_matchId_key" ON "KotobaClashMatchPlayer"("id", "matchId");

-- CreateIndex
CREATE UNIQUE INDEX "KotobaClashMatchPlayer_matchId_memberId_key" ON "KotobaClashMatchPlayer"("matchId", "memberId");

-- CreateIndex
CREATE UNIQUE INDEX "KotobaClashRound_id_matchId_key" ON "KotobaClashRound"("id", "matchId");

-- CreateIndex
CREATE UNIQUE INDEX "KotobaClashRound_matchId_position_key" ON "KotobaClashRound"("matchId", "position");

-- CreateIndex
CREATE INDEX "KotobaClashAnswer_playerId_matchId_idx" ON "KotobaClashAnswer"("playerId", "matchId");

-- CreateIndex
CREATE INDEX "KotobaClashAnswer_matchId_idx" ON "KotobaClashAnswer"("matchId");

-- CreateIndex
CREATE INDEX "KotobaClashAnswer_roundId_matchId_idx" ON "KotobaClashAnswer"("roundId", "matchId");

-- CreateIndex
CREATE UNIQUE INDEX "KotobaClashAnswer_roundId_playerId_key" ON "KotobaClashAnswer"("roundId", "playerId");

-- AddForeignKey
ALTER TABLE "KotobaClashRoom" ADD CONSTRAINT "KotobaClashRoom_hostUserId_fkey" FOREIGN KEY ("hostUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KotobaClashRoomMember" ADD CONSTRAINT "KotobaClashRoomMember_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "KotobaClashRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KotobaClashRoomMember" ADD CONSTRAINT "KotobaClashRoomMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KotobaClashMatch" ADD CONSTRAINT "KotobaClashMatch_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "KotobaClashRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KotobaClashMatchPlayer" ADD CONSTRAINT "KotobaClashMatchPlayer_matchId_roomId_fkey" FOREIGN KEY ("matchId", "roomId") REFERENCES "KotobaClashMatch"("id", "roomId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KotobaClashMatchPlayer" ADD CONSTRAINT "KotobaClashMatchPlayer_memberId_roomId_fkey" FOREIGN KEY ("memberId", "roomId") REFERENCES "KotobaClashRoomMember"("id", "roomId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KotobaClashRound" ADD CONSTRAINT "KotobaClashRound_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "KotobaClashMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KotobaClashAnswer" ADD CONSTRAINT "KotobaClashAnswer_roundId_matchId_fkey" FOREIGN KEY ("roundId", "matchId") REFERENCES "KotobaClashRound"("id", "matchId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KotobaClashAnswer" ADD CONSTRAINT "KotobaClashAnswer_playerId_matchId_fkey" FOREIGN KEY ("playerId", "matchId") REFERENCES "KotobaClashMatchPlayer"("id", "matchId") ON DELETE CASCADE ON UPDATE CASCADE;

-- Prisma cannot represent partial uniqueness or these CHECK constraints.
CREATE UNIQUE INDEX "KotobaClashMatch_one_running_per_room_key"
ON "KotobaClashMatch" ("roomId") WHERE "status" = 'RUNNING';

ALTER TABLE "KotobaClashRoom" ADD CONSTRAINT "KotobaClashRoom_shape_check" CHECK (
  "code" ~ '^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$'
  AND "configRevision" >= 0 AND "revision" >= 0
  AND ("config" IS NULL OR jsonb_typeof("config") = 'object')
);
ALTER TABLE "KotobaClashRoomMember" ADD CONSTRAINT "KotobaClashRoomMember_identity_check" CHECK (
  ("anonymizedAt" IS NOT NULL AND "userId" IS NULL AND "guestHash" IS NULL
    AND "guestExpiresAt" IS NULL AND "nicknameKey" IS NULL)
  OR ("anonymizedAt" IS NULL AND "nicknameKey" IS NOT NULL AND (
    ("userId" IS NOT NULL AND "guestHash" IS NULL AND "guestExpiresAt" IS NULL)
    OR ("userId" IS NULL AND "guestHash" IS NOT NULL AND "guestHash" ~ '^[a-f0-9]{64}$' AND "guestExpiresAt" IS NOT NULL)
  ))
);
ALTER TABLE "KotobaClashRoomMember" ADD CONSTRAINT "KotobaClashRoomMember_ready_check"
CHECK ("readyRevision" IS NULL OR "readyRevision" >= 0);
ALTER TABLE "KotobaClashMatch" ADD CONSTRAINT "KotobaClashMatch_schedule_check" CHECK (
  "rulesVersion" = 1 AND "startsAt" < "endsAt" AND "endsAt" < "expiresAt"
  AND jsonb_typeof("config") = 'object'
);
ALTER TABLE "KotobaClashRound" ADD CONSTRAINT "KotobaClashRound_shape_check" CHECK (
  "position" BETWEEN 1 AND 20 AND "startsAt" < "endsAt" AND "endsAt" < "revealEndsAt"
  AND ("finalizedAt" IS NULL OR "finalizedAt" >= "endsAt")
  AND jsonb_typeof("snapshot") = 'object'
);
ALTER TABLE "KotobaClashMatchPlayer" ADD CONSTRAINT "KotobaClashMatchPlayer_score_check" CHECK (
  "score" >= 0 AND "correctCount" >= 0 AND "wrongCount" >= 0 AND "skippedCount" >= 0
  AND "correctCount" + "wrongCount" + "skippedCount" <= 20
  AND "bestStreak" BETWEEN 0 AND 20 AND "correctTimeMs" >= 0
);
ALTER TABLE "KotobaClashAnswer" ADD CONSTRAINT "KotobaClashAnswer_choice_check"
CHECK ("choice" BETWEEN 1 AND 4);

REVOKE ALL PRIVILEGES ON TABLE "KotobaClashRoom", "KotobaClashRoomMember", "KotobaClashMatch",
  "KotobaClashMatchPlayer", "KotobaClashRound", "KotobaClashAnswer"
  FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE "KotobaClashRoom" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KotobaClashRoomMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KotobaClashMatch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KotobaClashMatchPlayer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KotobaClashRound" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KotobaClashAnswer" ENABLE ROW LEVEL SECURITY;
