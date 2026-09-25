-- Role statis dua level untuk dashboard admin. Tidak ada tabel permission
-- granular dan tidak ada tabel role terpisah: kebutuhan saat ini hanya
-- membedakan operator dari pembelajar.
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- Default USER membuat seluruh akun existing tetap non-admin setelah migrasi.
-- NOT NULL aman tanpa backfill terpisah karena default-nya constant.
ALTER TABLE "User"
    ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'USER';

-- Daftar admin dibaca jauh lebih sering daripada diubah, dan barisnya sedikit.
CREATE INDEX "User_role_idx" ON "User"("role");
