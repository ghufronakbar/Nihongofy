import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { AdminPlaceholder } from "@/features/admin/components/admin-placeholder";

export const metadata: Metadata = { title: "User - Admin" };

export default async function AdminUserPage() {
  await requireAdmin();

  return (
    <AdminPlaceholder
      title="User"
      stage="Tahap 6 — User & Akun"
      description="Daftar user dengan search dan filter, promote / demote role, revoke session lewat helper auth, reset bucket AuthRateLimit, serta lihat dan batalkan permintaan penghapusan akun."
    />
  );
}
