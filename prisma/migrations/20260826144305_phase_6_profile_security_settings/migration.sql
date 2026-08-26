-- AlterTable
ALTER TABLE "FlashcardProgress" ADD COLUMN     "learningStep" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "FlashcardReviewLog" ADD COLUMN     "wasNew" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "FlashcardSetting" (
    "userId" INTEGER NOT NULL,
    "newCardsPerDay" INTEGER NOT NULL DEFAULT 20,
    "maxReviewsPerDay" INTEGER NOT NULL DEFAULT 200,
    "learningStepsMinutes" INTEGER[] DEFAULT ARRAY[1, 10]::INTEGER[],
    "graduatingIntervalDays" INTEGER NOT NULL DEFAULT 1,
    "easyIntervalDays" INTEGER NOT NULL DEFAULT 4,
    "startingEaseFactor" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "relearningStepsMinutes" INTEGER[] DEFAULT ARRAY[10]::INTEGER[],
    "lapseIntervalMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "minimumIntervalDays" INTEGER NOT NULL DEFAULT 1,
    "maximumIntervalDays" INTEGER NOT NULL DEFAULT 36500,
    "intervalModifier" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "easyBonus" DOUBLE PRECISION NOT NULL DEFAULT 1.3,
    "hardMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.2,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlashcardSetting_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "FlashcardSetting" ADD CONSTRAINT "FlashcardSetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Prisma scalar lists are required in the application model. Make that
-- invariant explicit in PostgreSQL as well.
ALTER TABLE "FlashcardSetting"
    ALTER COLUMN "learningStepsMinutes" SET NOT NULL,
    ALTER COLUMN "relearningStepsMinutes" SET NOT NULL;

-- Reject scheduler state that could otherwise create an invalid or
-- effectively unbounded review interval.
ALTER TABLE "FlashcardProgress" ADD CONSTRAINT "FlashcardProgress_learningStep_valid" CHECK (
    "learningStep" >= 0
);

ALTER TABLE "FlashcardSetting" ADD CONSTRAINT "FlashcardSetting_limits_valid" CHECK (
    "newCardsPerDay" BETWEEN 0 AND 100 AND
    "maxReviewsPerDay" BETWEEN 0 AND 1000
);

ALTER TABLE "FlashcardSetting" ADD CONSTRAINT "FlashcardSetting_learning_steps_valid" CHECK (
    cardinality("learningStepsMinutes") BETWEEN 1 AND 4 AND
    0 < ALL ("learningStepsMinutes") AND
    43200 >= ALL ("learningStepsMinutes") AND
    cardinality("relearningStepsMinutes") BETWEEN 1 AND 4 AND
    0 < ALL ("relearningStepsMinutes") AND
    43200 >= ALL ("relearningStepsMinutes")
);

ALTER TABLE "FlashcardSetting" ADD CONSTRAINT "FlashcardSetting_intervals_valid" CHECK (
    "graduatingIntervalDays" BETWEEN 1 AND 36500 AND
    "easyIntervalDays" BETWEEN 1 AND 36500 AND
    "minimumIntervalDays" BETWEEN 1 AND 36500 AND
    "maximumIntervalDays" BETWEEN "minimumIntervalDays" AND 36500 AND
    "graduatingIntervalDays" <= "maximumIntervalDays" AND
    "easyIntervalDays" <= "maximumIntervalDays"
);

ALTER TABLE "FlashcardSetting" ADD CONSTRAINT "FlashcardSetting_multipliers_valid" CHECK (
    "startingEaseFactor" BETWEEN 1.3 AND 5 AND
    "lapseIntervalMultiplier" BETWEEN 0 AND 1 AND
    "intervalModifier" BETWEEN 0.5 AND 2 AND
    "easyBonus" BETWEEN 1 AND 3 AND
    "hardMultiplier" BETWEEN 1 AND 2
);

-- Custom credential auth uses numeric User.id and server-side Prisma. Keep
-- this private preference table outside the Supabase Data API surface.
REVOKE ALL PRIVILEGES ON TABLE "FlashcardSetting"
FROM anon, authenticated, service_role;

ALTER TABLE "FlashcardSetting" ENABLE ROW LEVEL SECURITY;
