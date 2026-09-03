import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, Plus, Search } from "lucide-react";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDeckOverview } from "@/features/flashcard/data";
import { DeckTreeView } from "@/features/flashcard/components/deck-tree-view";

export const metadata: Metadata = {
  title: "Flashcard",
  description:
    "Belajar kosakata dan kanji Jepang dengan flashcard spaced repetition FSRS di Tanoshii Japanese.",
};

export default async function FlashcardPage() {
  const session = await getSession();

  // Guest belum punya koleksi. Halaman tetap terbuka supaya mereka bisa melihat
  // katalog dan mencoba deck bawaan tanpa akun.
  if (!session) {
    const catalog = await prisma.flashcardSystemDeck.findMany({
      where: { isPublished: true },
      orderBy: [{ order: "asc" }, { name: "asc" }],
      select: {
        slug: true,
        name: true,
        description: true,
        _count: { select: { notes: true } },
      },
    });

    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-black">Flashcard</h1>
        <p className="mt-3 font-bold text-muted-foreground">
          Coba deck bawaan tanpa akun, atau masuk untuk membuat koleksimu sendiri dengan
          penjadwalan FSRS seperti Anki.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/login" className="neo-button bg-neo-yellow">
            Masuk
          </Link>
          <Link href="/register" className="neo-button bg-white">
            Daftar
          </Link>
        </div>

        <h2 className="mt-10 text-xl font-black">Coba dulu</h2>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">
          Mode coba tidak menyimpan progres apa pun.
        </p>
        <ul className="mt-4 space-y-3">
          {catalog.map((deck) => (
            <li key={deck.slug}>
              <Link
                href={`/flashcard/try/${deck.slug}`}
                className="neo-surface neo-interactive flex items-center gap-3 p-4"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-black">{deck.name}</span>
                  <span className="block truncate text-sm font-semibold text-muted-foreground">
                    {deck.description}
                  </span>
                </span>
                <span className="shrink-0 font-black tabular-nums">
                  {deck._count.notes}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    );
  }

  const overview = await getDeckOverview(session.userId);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-black">Flashcard</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/flashcard/browse" className="neo-button bg-white text-xs">
            <Search className="size-4" aria-hidden /> Cari kartu
          </Link>
          <Link href="/flashcard/stats" className="neo-button bg-white text-xs">
            <BarChart3 className="size-4" aria-hidden /> Statistik
          </Link>
          <Link href="/flashcard/add" className="neo-button bg-neo-yellow">
            <Plus className="size-4" aria-hidden /> Tambah deck
          </Link>
        </div>
      </div>

      <div className="mt-7">
        <DeckTreeView tree={overview.tree} />
      </div>
    </main>
  );
}
