-- ============================================================
-- USERNAME PUBLIK (HANDLE)
-- ============================================================
-- Kolom ini dulunya identifier login opsional untuk akun legacy. Sekarang
-- menjadi nama publik yang wajib: login memakai email saja.

-- 1. Backfill dari displayName.
UPDATE "User"
SET "username" = NULLIF(
  regexp_replace(
    regexp_replace(lower("displayName"), '[^a-z0-9._]+', '_', 'g'),
    '(^[._]+)|([._]+$)', '', 'g'
  ),
  ''
)
WHERE "username" IS NULL;

-- 2. Fallback untuk hasil yang tidak memenuhi aturan handle (terlalu pendek,
--    terlalu panjang, titik berurutan, atau memakai prefix akun anonim).
UPDATE "User"
SET "username" = 'nihongo_' || "id"
WHERE "username" IS NULL
   OR length("username") < 3
   OR length("username") > 30
   OR "username" !~ '^[a-z0-9_][a-z0-9._]*[a-z0-9_]$'
   OR "username" LIKE '%..%'
   OR "username" LIKE 'deleted!_%' ESCAPE '!'
   OR "username" IN (
     'admin','administrator','analytics','api','article','conversation','dashboard',
     'deleted','discussion','exam','exercises','help','history','kana','login','logout',
     'me','moderator','nihongofy','null','official','profile','progress','register',
     'result','root','settings','speaking','staff','support','system','u','undefined',
     'user'
   );

-- 3. Selesaikan tabrakan hasil backfill.
UPDATE "User" AS u
SET "username" = left(u."username", 24) || '_' || u."id"
WHERE EXISTS (
  SELECT 1 FROM "User" AS o
  WHERE o."username" = u."username" AND o."id" < u."id"
);

-- 4. Kunci bentuk akhirnya.
ALTER TABLE "User" ALTER COLUMN "username" TYPE VARCHAR(30);
ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;

-- ============================================================
-- ANONIMISASI AKUN
-- ============================================================
-- Penghapusan akun menganonimkan baris User, tidak menghapusnya, supaya thread
-- diskusi yang sudah dibalas orang lain tetap utuh.
ALTER TABLE "User" ADD COLUMN "anonymizedAt" TIMESTAMP(3);

-- Cascade pada userId berarti satu penghapusan akun ikut memusnahkan balasan
-- pengguna lain pada thread miliknya. Restrict menutup jalur itu.
ALTER TABLE "QuestionComment" DROP CONSTRAINT "QuestionComment_userId_fkey";
ALTER TABLE "QuestionComment"
    ADD CONSTRAINT "QuestionComment_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- MENTION SEBAGAI RELASI
-- ============================================================
ALTER TABLE "QuestionComment" ADD COLUMN "repliedToId" INTEGER;

ALTER TABLE "QuestionComment"
    ADD CONSTRAINT "QuestionComment_repliedToId_fkey"
    FOREIGN KEY ("repliedToId") REFERENCES "QuestionComment"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "QuestionComment_repliedToId_idx" ON "QuestionComment"("repliedToId");
