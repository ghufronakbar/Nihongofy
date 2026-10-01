import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getDeckCatalog, getMyDecks } from "@/features/flashcard/data";
import { DeckCatalog } from "@/features/flashcard/components/deck-catalog";
import { FLASHCARD_LICENSE } from "@/features/flashcard/taxonomy";
import { privateMetadata } from "@/lib/seo";

export const metadata: Metadata = privateMetadata(
  "Tambah deck",
  "Pilih deck kosakata bawaan per level JLPT, topik, atau kategori.",
);

export default async function AddDeckPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/flashcard/add");

  const [catalog, { subscribedIds }] = await Promise.all([
    getDeckCatalog(),
    getMyDecks(session.userId),
  ]);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10">
      <Link href="/flashcard" className="text-sm font-black underline">
        ← Deck saya
      </Link>

      <h1 className="mt-4 text-3xl font-black">Tambah deck</h1>
      <p className="mt-2 max-w-2xl font-bold text-muted-foreground">
        Satu kata bisa ada di beberapa deck, misalnya 食事 di JLPT N5 dan Makanan &amp; minuman.
        Progresnya tetap satu: kata yang sudah dipelajari di satu deck tidak muncul lagi sebagai
        kartu baru di deck lain.
      </p>

      <div className="mt-8">
        <DeckCatalog decks={catalog} subscribedIds={subscribedIds} />
      </div>
      <p className="mt-8 text-xs font-semibold text-muted-foreground">Konten: {FLASHCARD_LICENSE}</p>
    </main>
  );
}
