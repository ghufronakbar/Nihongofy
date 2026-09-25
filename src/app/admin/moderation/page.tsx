import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { AdminPlaceholder } from "@/features/admin/components/admin-placeholder";

export const metadata: Metadata = { title: "Moderasi - Admin" };

export default async function AdminModerationPage() {
  await requireAdmin();

  return (
    <AdminPlaceholder
      title="Moderasi"
      stage="Tahap 5 — Moderasi Diskusi Publik"
      description="Antrean catatan publik dan balasan lintas soal, takedown oleh admin, riwayat kontribusi per user, dan rate limit posting. Rem darurat yang sudah tersedia sekarang hanya FEATURES_QUESTION_DISCUSSION=false."
    />
  );
}
