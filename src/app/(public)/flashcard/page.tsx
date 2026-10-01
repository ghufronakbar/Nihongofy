import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, ChevronRight, Plus, Settings2 } from "lucide-react";
import { getSession } from "@/lib/auth";
import { getDeckCatalog, getMyDecks } from "@/features/flashcard/data";
import { DeckCatalog } from "@/features/flashcard/components/deck-catalog";
import { FLASHCARD_LICENSE } from "@/features/flashcard/taxonomy";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Flashcard Kosakata Jepang JLPT",
  description:
    "Belajar kosakata Jepang JLPT N5 sampai N1 dengan flashcard spaced repetition FSRS seperti Anki di Nihongofy.",
  path: "/flashcard",
  ogDescription:
    "Deck kosakata JLPT per level, topik, dan kategori dengan penjadwalan FSRS. Bisa dicoba tanpa akun.",
});

export default async function FlashcardPage() {
  const session = await getSession();

  // Guest tetap melihat katalog dan bisa mencoba deck tanpa akun.
  if (!session) {
    const catalog = await getDeckCatalog();
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-10">
        <h1 className="text-3xl font-black">Flashcard Kosakata</h1>
        <p className="mt-3 max-w-2xl font-bold text-muted-foreground">
          Kosakata JLPT N5 sampai N1 lengkap dengan arti, contoh kalimat, dan catatan. Coba deck
          tanpa akun, atau masuk supaya jadwal belajarmu disimpan dengan penjadwalan FSRS seperti
          Anki.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/login?next=/flashcard" className="neo-button bg-neo-yellow">
            Masuk
          </Link>
          <Link href="/register" className="neo-button bg-white">
            Daftar
          </Link>
        </div>

        <div className="mt-10">
          <DeckCatalog decks={catalog} subscribedIds={null} />
        </div>
        <p className="mt-8 text-xs font-semibold text-muted-foreground">Konten: {FLASHCARD_LICENSE}</p>
      </main>
    );
  }

  const { decks, allowance, settings } = await getMyDecks(session.userId);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-black">Flashcard</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/flashcard/stats" className="neo-button bg-white text-xs">
            <BarChart3 className="size-4" aria-hidden /> Statistik
          </Link>
          <Link href="/flashcard/settings" className="neo-button bg-white text-xs">
            <Settings2 className="size-4" aria-hidden /> Pengaturan
          </Link>
          <Link href="/flashcard/add" className="neo-button bg-neo-yellow">
            <Plus className="size-4" aria-hidden /> Tambah deck
          </Link>
        </div>
      </div>

      <p className="mt-3 text-sm font-bold text-muted-foreground">
        Hari ini: {allowance.newStudiedToday} dari {settings.config.newCardsPerDay} kartu baru,{" "}
        {allowance.reviewsToday} review. Batas harian berlaku untuk semua deck sekaligus.
      </p>

      {decks.length === 0 ? (
        <div className="neo-surface mt-7 p-8 text-center">
          <h2 className="text-xl font-black">Belum ada deck</h2>
          <p className="mt-2 font-bold text-muted-foreground">
            Pilih deck bawaan per level JLPT, topik, atau kategori untuk mulai belajar.
          </p>
          <Link href="/flashcard/add" className="neo-button mt-5 bg-neo-yellow">
            Tambah deck
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-7 flex items-center justify-end gap-3 text-xs font-black tracking-wide uppercase">
            <span className="text-neo-blue">Baru</span>
            <span className="text-neo-coral">Belajar</span>
            <span className="text-neo-green">Ulang</span>
          </div>
          <ul className="mt-3 space-y-3">
            {decks.map((deck) => {
              const total = deck.due.newCount + deck.due.learningCount + deck.due.reviewCount;
              return (
                <li key={deck.slug}>
                  <Link
                    href={`/flashcard/deck/${deck.slug}`}
                    className="neo-surface neo-interactive flex items-center gap-3 p-4"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-black">{deck.name}</span>
                      <span className="block truncate text-sm font-semibold text-muted-foreground">
                        {deck.wordCount} kata
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2 font-black tabular-nums">
                      <span className="text-neo-blue" title="Kartu baru">
                        {deck.due.newCount}
                      </span>
                      <span className="text-neo-coral" title="Sedang dipelajari">
                        {deck.due.learningCount}
                      </span>
                      <span className="text-neo-green" title="Perlu diulang">
                        {deck.due.reviewCount}
                      </span>
                    </span>
                    <ChevronRight
                      className={`size-5 shrink-0 ${total > 0 ? "" : "opacity-30"}`}
                      aria-hidden
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </main>
  );
}
