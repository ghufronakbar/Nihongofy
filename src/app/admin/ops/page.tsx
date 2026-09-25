import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { AdminPlaceholder } from "@/features/admin/components/admin-placeholder";

export const metadata: Metadata = { title: "Operasional - Admin" };

export default async function AdminOpsPage() {
  await requireAdmin();

  return (
    <AdminPlaceholder
      title="Operasional"
      stage="Tahap 7 — Conversation & Operasional"
      description="Status feature flag read-only, invalidasi cache manual per tag, dan riwayat AdminAuditLog."
    />
  );
}
