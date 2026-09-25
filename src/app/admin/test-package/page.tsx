import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { AdminPlaceholder } from "@/features/admin/components/admin-placeholder";

export const metadata: Metadata = { title: "Paket Tes - Admin" };

export default async function AdminTestPackagePage() {
  await requireAdmin();

  return (
    <AdminPlaceholder
      title="Paket Tes"
      stage="Tahap 2 — Bank Soal"
      description="Browse paket per level, import fixture JSON lewat validator yang sama dengan npm run seed:test-package, editor soal untuk memperbaiki hasil OCR, upload media, dan hapus paket."
    />
  );
}
