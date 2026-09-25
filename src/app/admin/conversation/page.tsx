import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { AdminPlaceholder } from "@/features/admin/components/admin-placeholder";

export const metadata: Metadata = { title: "Conversation - Admin" };

export default async function AdminConversationPage() {
  await requireAdmin();

  return (
    <AdminPlaceholder
      title="Conversation"
      stage="Tahap 7 — Conversation & Operasional"
      description="Pemakaian ConversationQuota per user per hari, turn bertanda moderationFlagged, dan session yang retensinya sudah lewat. Transcript hanya ditampilkan bila user mengizinkan penyimpanannya."
    />
  );
}
