-- CreateEnum
CREATE TYPE "ConversationMode" AS ENUM ('TEXT', 'VOICE');

-- CreateEnum
CREATE TYPE "ConversationSessionStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "ConversationTurnRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "ConversationInputSource" AS ENUM ('TYPED', 'SPEECH');

-- CreateTable
CREATE TABLE "ConversationSession" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "mode" "ConversationMode" NOT NULL,
    "personaKey" VARCHAR(64) NOT NULL,
    "topicKeys" TEXT[],
    "jlptLevel" "JlptLevel" NOT NULL,
    "status" "ConversationSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "promptVersion" VARCHAR(32) NOT NULL,
    "chatModel" VARCHAR(64) NOT NULL,
    "sttModel" VARCHAR(64),
    "ttsModel" VARCHAR(64),
    "transcriptRetained" BOOLEAN NOT NULL DEFAULT false,
    "audioRetained" BOOLEAN NOT NULL DEFAULT false,
    "retentionExpiresAt" TIMESTAMP(3),
    "showTranslation" BOOLEAN NOT NULL DEFAULT true,
    "showRomaji" BOOLEAN NOT NULL DEFAULT true,
    "showFurigana" BOOLEAN NOT NULL DEFAULT true,
    "turnCount" INTEGER NOT NULL DEFAULT 0,
    "totalInputTokens" INTEGER NOT NULL DEFAULT 0,
    "totalOutputTokens" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationTurn" (
    "id" SERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "role" "ConversationTurnRole" NOT NULL,
    "contentJa" TEXT NOT NULL,
    "contentTranslation" TEXT,
    "contentRomaji" TEXT,
    "inputSource" "ConversationInputSource",
    "audioUrl" TEXT,
    "audioPublicId" VARCHAR(255),
    "audioDurationMs" INTEGER,
    "sttConfidence" DOUBLE PRECISION,
    "moderationFlagged" BOOLEAN NOT NULL DEFAULT false,
    "latencyMs" INTEGER,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationTurn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationTurnFeedback" (
    "id" SERIAL NOT NULL,
    "turnId" INTEGER NOT NULL,
    "rubricVersion" VARCHAR(32) NOT NULL,
    "corrections" JSONB NOT NULL,
    "summary" TEXT NOT NULL,
    "pronunciationScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationTurnFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationQuota" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "quotaDate" DATE NOT NULL,
    "turnCount" INTEGER NOT NULL DEFAULT 0,
    "audioSeconds" INTEGER NOT NULL DEFAULT 0,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationQuota_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConversationSession_userId_startedAt_idx" ON "ConversationSession"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "ConversationSession_status_idx" ON "ConversationSession"("status");

-- CreateIndex
CREATE INDEX "ConversationSession_retentionExpiresAt_idx" ON "ConversationSession"("retentionExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationTurn_audioPublicId_key" ON "ConversationTurn"("audioPublicId");

-- CreateIndex
CREATE INDEX "ConversationTurn_sessionId_idx" ON "ConversationTurn"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationTurn_sessionId_order_key" ON "ConversationTurn"("sessionId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationTurnFeedback_turnId_key" ON "ConversationTurnFeedback"("turnId");

-- CreateIndex
CREATE INDEX "ConversationQuota_quotaDate_idx" ON "ConversationQuota"("quotaDate");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationQuota_userId_quotaDate_key" ON "ConversationQuota"("userId", "quotaDate");

-- AddForeignKey
ALTER TABLE "ConversationSession" ADD CONSTRAINT "ConversationSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationTurn" ADD CONSTRAINT "ConversationTurn_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ConversationSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationTurnFeedback" ADD CONSTRAINT "ConversationTurnFeedback_turnId_fkey" FOREIGN KEY ("turnId") REFERENCES "ConversationTurn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationQuota" ADD CONSTRAINT "ConversationQuota_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- EnableRowLevelSecurity
-- Aturan project: tabel aplikasi tidak diberi grant ke role Data API Supabase.
-- RLS aktif tanpa policy karena seluruh akses melalui Prisma server-side.
ALTER TABLE "ConversationSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ConversationTurn" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ConversationTurnFeedback" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ConversationQuota" ENABLE ROW LEVEL SECURITY;
