import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { AdminPlaceholder } from "@/features/admin/components/admin-placeholder";

export const metadata: Metadata = { title: "Pembahasan - Admin" };

export default async function AdminExplanationPage() {
  await requireAdmin();

  return (
    <AdminPlaceholder
      title="Pembahasan"
      stage="Tahap 3 — Pembahasan Soal"
      description="Antrean soal tanpa pembahasan, pembahasan AI yang belum direview, dan kunci jawaban bertanda answerKeyDoubt. Termasuk trigger generate dan approval yang mengisi reviewedAt."
    />
  );
}
