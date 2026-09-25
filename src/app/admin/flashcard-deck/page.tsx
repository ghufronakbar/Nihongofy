import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { AdminPlaceholder } from "@/features/admin/components/admin-placeholder";

export const metadata: Metadata = { title: "Deck Bawaan - Admin" };

export default async function AdminFlashcardDeckPage() {
  await requireAdmin();

  return (
    <AdminPlaceholder
      title="Deck Bawaan"
      stage="Tahap 4 — Konten Lain"
      description="CRUD deck sistem beserta note-nya, toggle isPublished, atur urutan, dan pastikan field license terisi karena sumber CC BY-SA mengikat atribusi."
    />
  );
}
