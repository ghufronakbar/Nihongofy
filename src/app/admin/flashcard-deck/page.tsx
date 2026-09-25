import Link from "next/link";
import type { Metadata } from "next";
import { AlertTriangle, Plus } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { FEATURES } from "@/constants";
import { listSystemDecks } from "@/features/admin/flashcard-deck/queries";
import { DeckRowActions } from "@/features/admin/flashcard-deck/components/deck-row-actions";

export const metadata: Metadata = { title: "Deck Bawaan - Admin" };

export default async function AdminFlashcardDeckListPage() {
  await requireAdmin();

  const decks = await listSystemDecks();
  const totalNotes = decks.reduce((sum, deck) => sum + deck._count.notes, 0);
  const published = decks.filter((deck) => deck.isPublished).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black uppercase text-neo-ink sm:text-3xl">Deck Bawaan</h1>
          <p className="mt-1 text-sm font-semibold text-foreground/70">
            {decks.length} deck · {published} tampil di katalog · {totalNotes} note
          </p>
        </div>
        <Link
          href="/admin/flashcard-deck/new"
          className="neo-button bg-neo-blue text-sm font-extrabold text-white"
        >
          <Plus className="size-4" />
          Deck Baru
        </Link>
      </div>

      {!FEATURES.flashcard && (
        <p className="border-[3px] border-neo-ink bg-neo-yellow px-4 py-2.5 text-sm font-bold text-black shadow-neo-sm">
          Modul flashcard sedang nonaktif untuk publik (FEATURES_FLASHCARD=false).
        </p>
      )}

      <div className="neo-surface flex flex-col gap-2 border-[3px] border-neo-ink bg-neo-paper p-5 shadow-neo">
        <p className="flex items-center gap-2 font-mono text-[10px] font-black uppercase tracking-wider text-foreground/60">
          <AlertTriangle className="size-3.5" />
          Seed memperlakukan file sebagai sumber kebenaran
        </p>
        <p className="text-xs font-semibold text-foreground/80">
          <code className="font-mono">npm run seed:flashcard-deck</code> menghapus note yang tidak
          ada di <code className="font-mono">src/flashcard-deck-data/&lt;slug&gt;.json</code>. Jadi
          penyuntingan di layar ini akan hilang pada seed berikutnya kecuali filenya ikut
          diperbarui — pakai tombol <strong>Fixture</strong> untuk mengunduh isi deck dalam bentuk
          file itu, lalu timpakan ke repository.
        </p>
        <p className="text-xs font-semibold text-foreground/60">
          Mengubah katalog tidak menyentuh koleksi user yang sudah menambahkan deck: isinya
          disalin saat ditambahkan, jadi kartu mereka berdiri sendiri.
        </p>
      </div>

      {decks.length === 0 ? (
        <div className="neo-surface border-[3px] border-neo-ink bg-white p-6 text-sm font-semibold text-foreground/70 shadow-neo">
          Belum ada deck bawaan.
        </div>
      ) : (
        <div className="neo-surface min-w-0 overflow-x-auto border-[3px] border-neo-ink bg-white shadow-neo">
          <table className="w-full min-w-3xl border-collapse text-sm">
            <thead>
              <tr className="border-b-[3px] border-neo-ink bg-neo-paper text-left">
                <th className="px-4 py-3 font-mono text-[10px] font-black uppercase">Urutan</th>
                <th className="px-4 py-3 font-mono text-[10px] font-black uppercase">Deck</th>
                <th className="px-4 py-3 font-mono text-[10px] font-black uppercase">Note type</th>
                <th className="px-4 py-3 font-mono text-[10px] font-black uppercase">Lisensi</th>
                <th className="px-4 py-3 font-mono text-[10px] font-black uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {decks.map((deck) => (
                <tr key={deck.id} className="border-b-2 border-neo-ink/15 align-top last:border-b-0">
                  <td className="px-4 py-3 font-mono text-xs font-black">{deck.order}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/flashcard-deck/${deck.id}`}
                      className="font-black text-neo-ink underline-offset-4 hover:underline"
                    >
                      {deck.name}
                    </Link>
                    <p className="font-mono text-[11px] text-foreground/60">
                      {deck.slug} · {deck._count.notes} note
                      {deck.jlptLevel ? ` · ${deck.jlptLevel}` : ""}
                    </p>
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] font-bold">{deck.noteType}</td>
                  <td className="max-w-xs px-4 py-3 text-[11px] font-semibold text-foreground/70">
                    {deck.license}
                  </td>
                  <td className="px-4 py-3">
                    <DeckRowActions
                      id={deck.id}
                      slug={deck.slug}
                      isPublished={deck.isPublished}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
