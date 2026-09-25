-- Jejak aksi admin. Role statis dua level berarti siapa pun yang dapat
-- memperbaiki typo soal juga dapat menghapus akun user; tanpa tabel ini tidak
-- ada cara menelusuri apa yang terjadi dan siapa pelakunya.
CREATE TABLE "AdminAuditLog" (
    "id" SERIAL NOT NULL,
    "actorId" INTEGER,
    -- Snapshot nama aktor supaya baris tetap terbaca setelah akunnya dihapus.
    "actorName" VARCHAR(120) NOT NULL,
    "action" VARCHAR(64) NOT NULL,
    "targetType" VARCHAR(40) NOT NULL,
    "targetId" VARCHAR(64),
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- SET NULL, bukan CASCADE: menghapus akun admin tidak boleh ikut menghapus
-- jejak aksi yang pernah ia lakukan.
ALTER TABLE "AdminAuditLog"
    ADD CONSTRAINT "AdminAuditLog_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");
CREATE INDEX "AdminAuditLog_actorId_idx" ON "AdminAuditLog"("actorId");
CREATE INDEX "AdminAuditLog_targetType_targetId_idx" ON "AdminAuditLog"("targetType", "targetId");

-- Hanya diakses server-side lewat Prisma, seperti seluruh tabel aplikasi.
REVOKE ALL PRIVILEGES ON TABLE "AdminAuditLog" FROM anon, authenticated, service_role;
ALTER TABLE "AdminAuditLog" ENABLE ROW LEVEL SECURITY;
