import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { DeckForm } from "@/features/admin/flashcard-deck/components/deck-form";

export const metadata: Metadata = { title: "Deck Bawaan Baru - Admin" };

export default async function AdminFlashcardDeckNewPage() {
  await requireAdmin();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/admin/flashcard-deck"
          className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-foreground/60 hover:text-neo-blue"
        >
          <ArrowLeft className="size-3.5" />
          Kembali ke daftar
        </Link>
        <h1 className="mt-2 text-2xl font-black uppercase text-neo-ink sm:text-3xl">
          Deck Bawaan Baru
        </h1>
        <p className="mt-1 text-sm font-semibold text-foreground/70">
          Note ditambahkan setelah deck dibuat, karena jumlah dan arti field-nya ditentukan note
          type yang dipilih di sini.
        </p>
      </div>
      <DeckForm noteCount={0} />
    </div>
  );
}
