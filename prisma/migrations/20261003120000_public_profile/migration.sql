-- Profil publik /u/[username] (tahap 1 modul komunitas). Rancangan:
-- docs/module/community.md.
--
-- Hanya menambah kolom pada User; tidak ada data lama yang diubah selain
-- default visibility PUBLIC yang memang keputusan produk.

-- CreateEnum
CREATE TYPE "ProfileVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "bio" VARCHAR(160),
ADD COLUMN     "jlptTarget" "JlptLevel",
ADD COLUMN     "profileVisibility" "ProfileVisibility" NOT NULL DEFAULT 'PUBLIC',
-- Sengaja tanpa DEFAULT di sini: ADD COLUMN ... DEFAULT mengisi seluruh baris
-- lama dengan nilai itu, padahal akun lama justru harus NULL supaya melihat
-- banner "profilmu kini publik". Default untuk baris baru dipasang sesudahnya.
ADD COLUMN     "publicProfileNoticeDismissedAt" TIMESTAMP(3);

ALTER TABLE "User" ALTER COLUMN "publicProfileNoticeDismissedAt" SET DEFAULT CURRENT_TIMESTAMP;
