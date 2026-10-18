-- CreateTable
CREATE TABLE "KanaWord" (
    "id" SERIAL NOT NULL,
    "kana" VARCHAR(7) NOT NULL,
    "length" SMALLINT NOT NULL,
    "allowGuess" BOOLEAN NOT NULL DEFAULT true,
    "allowAnswer" BOOLEAN NOT NULL DEFAULT false,
    "category" VARCHAR(80),
    "retiredAt" TIMESTAMPTZ(3),

    CONSTRAINT "KanaWord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KanaWordSource" (
    "wordId" INTEGER NOT NULL,
    "sourceKey" VARCHAR(160) NOT NULL,
    "vocabId" INTEGER,

    CONSTRAINT "KanaWordSource_pkey" PRIMARY KEY ("wordId","sourceKey")
);

-- CreateTable
CREATE TABLE "KanaRaceDictionary" (
    "id" VARCHAR(64) NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KanaRaceDictionary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KanaRaceRoom" (
    "id" UUID NOT NULL,
    "code" VARCHAR(8) NOT NULL,
    "hostId" INTEGER,
    "config" JSONB NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "currentMatchId" UUID,
    "idleExpiresAt" TIMESTAMPTZ(3) NOT NULL,
    "closedAt" TIMESTAMPTZ(3),
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KanaRaceRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KanaRaceMember" (
    "id" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "userId" INTEGER,
    "guestHash" VARCHAR(64),
    "guestExpiresAt" TIMESTAMPTZ(3),
    "nickname" VARCHAR(24) NOT NULL,
    "nicknameKey" VARCHAR(96),
    "readyRevision" INTEGER,
    "anonymizedAt" TIMESTAMPTZ(3),
    "joinedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KanaRaceMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KanaRaceMatch" (
    "id" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "dictionaryId" VARCHAR(64) NOT NULL,
    "state" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMPTZ(3),
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "KanaRaceMatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KanaWord_kana_key" ON "KanaWord"("kana");

-- CreateIndex
CREATE INDEX "KanaWord_allowAnswer_length_idx" ON "KanaWord"("allowAnswer", "length");

-- CreateIndex
CREATE INDEX "KanaWordSource_vocabId_idx" ON "KanaWordSource"("vocabId");

-- CreateIndex
CREATE UNIQUE INDEX "KanaRaceRoom_code_key" ON "KanaRaceRoom"("code");

-- CreateIndex
CREATE INDEX "KanaRaceRoom_hostId_closedAt_idx" ON "KanaRaceRoom"("hostId", "closedAt");

-- CreateIndex
CREATE INDEX "KanaRaceRoom_expiresAt_idx" ON "KanaRaceRoom"("expiresAt");

-- CreateIndex
CREATE INDEX "KanaRaceRoom_currentMatchId_idx" ON "KanaRaceRoom"("currentMatchId");

-- CreateIndex
CREATE INDEX "KanaRaceRoom_idleExpiresAt_idx" ON "KanaRaceRoom"("idleExpiresAt");

-- CreateIndex
CREATE INDEX "KanaRaceMember_userId_idx" ON "KanaRaceMember"("userId");

-- CreateIndex
CREATE INDEX "KanaRaceMember_guestExpiresAt_idx" ON "KanaRaceMember"("guestExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "KanaRaceMember_roomId_userId_key" ON "KanaRaceMember"("roomId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "KanaRaceMember_roomId_guestHash_key" ON "KanaRaceMember"("roomId", "guestHash");

-- CreateIndex
CREATE UNIQUE INDEX "KanaRaceMember_roomId_nicknameKey_key" ON "KanaRaceMember"("roomId", "nicknameKey");

-- CreateIndex
CREATE INDEX "KanaRaceMatch_roomId_createdAt_idx" ON "KanaRaceMatch"("roomId", "createdAt");

-- CreateIndex
CREATE INDEX "KanaRaceMatch_dictionaryId_idx" ON "KanaRaceMatch"("dictionaryId");

-- CreateIndex
CREATE INDEX "KanaRaceMatch_expiresAt_idx" ON "KanaRaceMatch"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "KanaRaceMatch_id_roomId_key" ON "KanaRaceMatch"("id", "roomId");

-- AddForeignKey
ALTER TABLE "KanaWordSource" ADD CONSTRAINT "KanaWordSource_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "KanaWord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KanaWordSource" ADD CONSTRAINT "KanaWordSource_vocabId_fkey" FOREIGN KEY ("vocabId") REFERENCES "FlashcardVocab"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KanaRaceRoom" ADD CONSTRAINT "KanaRaceRoom_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KanaRaceRoom" ADD CONSTRAINT "KanaRaceRoom_currentMatchId_id_fkey" FOREIGN KEY ("currentMatchId", "id") REFERENCES "KanaRaceMatch"("id", "roomId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "KanaRaceMember" ADD CONSTRAINT "KanaRaceMember_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "KanaRaceRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KanaRaceMember" ADD CONSTRAINT "KanaRaceMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KanaRaceMatch" ADD CONSTRAINT "KanaRaceMatch_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "KanaRaceRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KanaRaceMatch" ADD CONSTRAINT "KanaRaceMatch_dictionaryId_fkey" FOREIGN KEY ("dictionaryId") REFERENCES "KanaRaceDictionary"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Prisma does not model CHECK constraints or partial indexes.
CREATE UNIQUE INDEX "KanaRaceMatch_one_unfinished_per_room_key"
ON "KanaRaceMatch" ("roomId") WHERE "finishedAt" IS NULL;

ALTER TABLE "KanaWord" ADD CONSTRAINT "KanaWord_shape_check" CHECK (
  "length" BETWEEN 3 AND 7 AND char_length("kana") = "length"
  AND "kana" ~ '^[ぁ-ゖー]+$'
  AND (NOT "allowAnswer" OR ("allowGuess" AND "category" IS NOT NULL AND "retiredAt" IS NULL))
);
ALTER TABLE "KanaRaceDictionary" ADD CONSTRAINT "KanaRaceDictionary_shape_check" CHECK (
  "id" ~ '^[a-f0-9]{64}$' AND jsonb_typeof("payload") = 'object'
  AND ("payload" ->> 'version') IS NOT DISTINCT FROM '1'
  AND COALESCE(jsonb_typeof("payload" -> 'guesses') = 'array', false)
  AND COALESCE(jsonb_typeof("payload" -> 'answers') = 'array', false)
);
ALTER TABLE "KanaRaceRoom" ADD CONSTRAINT "KanaRaceRoom_shape_check" CHECK (
  "code" ~ '^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$'
  AND "revision" > 0 AND jsonb_typeof("config") = 'object'
  AND "createdAt" < "expiresAt"
);
ALTER TABLE "KanaRaceMember" ADD CONSTRAINT "KanaRaceMember_identity_check" CHECK (
  ("anonymizedAt" IS NOT NULL AND "userId" IS NULL AND "guestHash" IS NULL
    AND "guestExpiresAt" IS NULL AND "nicknameKey" IS NULL)
  OR ("anonymizedAt" IS NULL AND "nicknameKey" IS NOT NULL AND (
    ("userId" IS NOT NULL AND "guestHash" IS NULL AND "guestExpiresAt" IS NULL)
    OR ("userId" IS NULL AND "guestHash" ~ '^[a-f0-9]{64}$' AND "guestHash" IS NOT NULL AND "guestExpiresAt" IS NOT NULL)
  ))
);
ALTER TABLE "KanaRaceMember" ADD CONSTRAINT "KanaRaceMember_ready_check"
CHECK ("readyRevision" IS NULL OR "readyRevision" > 0);
ALTER TABLE "KanaRaceMatch" ADD CONSTRAINT "KanaRaceMatch_shape_check" CHECK (
  jsonb_typeof("state") = 'object' AND ("state" ->> 'version') IS NOT DISTINCT FROM '1'
  AND COALESCE(jsonb_typeof("state" -> 'roster') = 'array', false)
  AND jsonb_array_length("state" -> 'roster') BETWEEN 2 AND 20
  AND COALESCE(jsonb_typeof("state" -> 'rounds') = 'array', false)
  AND jsonb_array_length("state" -> 'rounds') IN (3, 5, 10)
  AND "createdAt" < "expiresAt"
);

REVOKE ALL PRIVILEGES ON TABLE "KanaWord", "KanaWordSource", "KanaRaceDictionary",
  "KanaRaceRoom", "KanaRaceMember", "KanaRaceMatch" FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON SEQUENCE "KanaWord_id_seq" FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE "KanaWord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KanaWordSource" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KanaRaceDictionary" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KanaRaceRoom" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KanaRaceMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KanaRaceMatch" ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION "preventKanaDictionaryMutation"() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'Kana Race dictionary releases are immutable';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL PRIVILEGES ON FUNCTION "preventKanaDictionaryMutation"() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER "KanaRaceDictionary_immutable" BEFORE UPDATE ON "KanaRaceDictionary"
FOR EACH ROW EXECUTE FUNCTION "preventKanaDictionaryMutation"();
