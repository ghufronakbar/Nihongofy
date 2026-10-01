import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getDeckCatalog, getSubscribedDecks } from "@/features/flashcard/data";
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

  const [catalog, subscribed] = await Promise.all([
    getDeckCatalog(),
    getSubscribedDecks(session.userId),
  ]);
  const subscribedIds = new Set(subscribed.map((deck) => deck.id));

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10">
      <Link href="/flashcard" className="text-sm font-black underline">
        ← Deck saya
      </Link>

      <h1 className="mt-4 text-3xl font-black">Tambah deck</h1>
      <p className="mt-2 max-w-2xl font-bold text-muted-foreground">
        Setiap deck punya kartu dan pengaturannya sendiri. Kata yang ada di beberapa deck, misalnya
        食事 di JLPT N5 dan Makanan &amp; minuman, dipelajari dan direview terpisah di tiap deck.
      </p>

      <div className="mt-8">
        <DeckCatalog decks={catalog} subscribedIds={subscribedIds} />
      </div>
      <p className="mt-8 text-xs font-semibold text-muted-foreground">Konten: {FLASHCARD_LICENSE}</p>
    </main>
  );
}
