import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { AdminPlaceholder } from "@/features/admin/components/admin-placeholder";

export const metadata: Metadata = { title: "Artikel - Admin" };

export default async function AdminArticlePage() {
  await requireAdmin();

  return (
    <AdminPlaceholder
      title="Artikel"
      stage="Tahap 4 — Konten Lain"
      description="CRUD artikel dengan editor body JSON, kelola tag, toggle featured, dan transisi status DRAFT / PUBLISHED / ARCHIVED yang enumnya sudah ada tetapi belum pernah dipakai dari UI."
    />
  );
}
