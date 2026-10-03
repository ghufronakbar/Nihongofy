-- Follow antar-user (tahap 2 modul komunitas). Rancangan:
-- docs/module/community.md#tahap-2--follow.
--
-- Hanya membuat object baru; tidak ada data lama yang diubah.

-- CreateEnum
CREATE TYPE "FollowStatus" AS ENUM ('PENDING', 'ACCEPTED');

-- CreateTable
CREATE TABLE "Follow" (
    "followerId" INTEGER NOT NULL,
    "followingId" INTEGER NOT NULL,
    "status" "FollowStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    -- PK sekaligus penjaga satu baris per pasangan: follow ganda dari dua tab
    -- menjadi no-op (ON CONFLICT DO NOTHING di action).
    CONSTRAINT "Follow_pkey" PRIMARY KEY ("followerId","followingId"),
    -- Tidak bisa mengikuti diri sendiri. Prisma tidak dapat mengekspresikannya,
    -- jadi hanya ada di sini; action juga menolaknya lebih dulu.
    CONSTRAINT "Follow_not_self_check" CHECK ("followerId" <> "followingId")
);

-- CreateIndex
-- Daftar follower satu akun dan antrean permintaan masuk, terbaru dulu.
CREATE INDEX "Follow_followingId_status_createdAt_idx" ON "Follow"("followingId", "status", "createdAt");

-- CreateIndex
-- Daftar akun yang diikuti, dan nanti tab "Mengikuti" di feed.
CREATE INDEX "Follow_followerId_status_createdAt_idx" ON "Follow"("followerId", "status", "createdAt");

-- AddForeignKey
-- Cascade hanya jaring pengaman untuk hard delete: alur normal menganonimkan
-- User, dan anonymizeAccount menghapus baris follow di kedua arah.
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Supabase Data API: akses hanya lewat Prisma server-side.
REVOKE ALL PRIVILEGES ON TABLE "Follow" FROM anon, authenticated, service_role;
ALTER TABLE "Follow" ENABLE ROW LEVEL SECURITY;
