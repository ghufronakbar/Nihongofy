-- Penanda sesi yang sedang dikerjakan pada mock exam. Sebelumnya sesi dianggap
-- sudah disubmit bila punya baris AttemptAnswer; dengan simpan otomatis per
-- jawaban, baris itu sudah ada sebelum submit sehingga butuh penanda eksplisit.
ALTER TABLE "Attempt" ADD COLUMN "currentSession" INTEGER NOT NULL DEFAULT 1;

-- Backfill attempt full mock yang masih berjalan dengan aturan lama
-- (resolveResumeSession): sesi paling awal yang belum punya jawaban sama
-- sekali, atau sesi terakhir bila semuanya sudah terisi.
UPDATE "Attempt" AS a
SET "currentSession" = COALESCE(
  (
    SELECT MIN(item."session")
    FROM "TestPackageItem" AS item
    WHERE item."testPackageId" = a."testPackageId"
      AND NOT EXISTS (
        SELECT 1
        FROM "AttemptAnswer" AS answer
        JOIN "Question" AS question ON question."id" = answer."questionId"
        JOIN "TestPackageItem" AS answered ON answered."id" = question."testPackageItemId"
        WHERE answer."attemptId" = a."id"
          AND answered."session" = item."session"
      )
  ),
  (
    SELECT MAX(item."session")
    FROM "TestPackageItem" AS item
    WHERE item."testPackageId" = a."testPackageId"
  ),
  1
)
WHERE a."status" = 'IN_PROGRESS'
  AND a."sectionScope" IS NULL;
