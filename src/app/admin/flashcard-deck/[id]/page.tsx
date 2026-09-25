import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, Search } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { getSystemDeck, listSystemNotes } from "@/features/admin/flashcard-deck/queries";
import { DeckForm } from "@/features/admin/flashcard-deck/components/deck-form";
import { NoteCreator, NoteRow } from "@/features/admin/flashcard-deck/components/note-editor";
import { DeleteDeckButton } from "@/features/admin/flashcard-deck/components/delete-deck-button";
import { FLASHCARD_NOTE_TYPES } from "@/features/flashcard/note-types";

export const metadata: Metadata = { title: "Edit Deck Bawaan - Admin" };

export default async function AdminFlashcardDeckEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  await requireAdmin();

  const [{ id }, search] = await Promise.all([params, searchParams]);
  const deckId = Number(id);
  if (!Number.isInteger(deckId) || deckId <= 0) notFound();

  const deck = await getSystemDeck(deckId);
  if (!deck) notFound();

  const query = (search.q ?? "").trim();
  const { notes, matching, truncated, pageSize } = await listSystemNotes(deckId, query);
  const definition = FLASHCARD_NOTE_TYPES[deck.noteType];
  const nextOrder = notes.length > 0 ? Math.max(...notes.map((note) => note.order)) + 1 : 0;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href="/admin/flashcard-deck"
          className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-foreground/60 hover:text-neo-blue"
        >
          <ArrowLeft className="size-3.5" />
          Kembali ke daftar
        </Link>
        <h1 className="mt-2 text-2xl font-black uppercase text-neo-ink sm:text-3xl">
          {deck.name}
        </h1>
        <p className="mt-1 text-sm font-semibold text-foreground/70">
          {deck.slug} · {definition.label} · {deck._count.notes} note ·{" "}
          {deck.isPublished ? "tampil di katalog" : "tersembunyi"}
        </p>
      </div>

      <DeckForm
        deckId={deck.id}
        noteCount={deck._count.notes}
        defaultValues={{
          slug: deck.slug,
          name: deck.name,
          description: deck.description,
          jlptLevel: deck.jlptLevel,
          noteType: deck.noteType,
          license: deck.license,
          order: deck.order,
          isPublished: deck.isPublished,
        }}
      />

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-mono text-xs font-black uppercase tracking-wider text-foreground/60">
            Note ({matching})
          </h2>
          <form action={`/admin/flashcard-deck/${deck.id}`} className="flex items-center gap-2">
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Cari guid atau isi field"
              className="h-9 w-56 border-2 border-neo-ink bg-white px-3 text-sm font-semibold shadow-neo-sm outline-none focus:bg-neo-paper"
            />
            <button
              type="submit"
              aria-label="Cari note"
              className="neo-button bg-white text-xs font-extrabold text-black"
            >
              <Search className="size-4" />
            </button>
          </form>
        </div>

        <NoteCreator deckId={deck.id} noteType={deck.noteType} nextOrder={nextOrder} />

        {notes.length === 0 ? (
          <div className="neo-surface border-[3px] border-neo-ink bg-white p-6 text-sm font-semibold text-foreground/70 shadow-neo">
            {query ? "Tidak ada note yang cocok." : "Deck ini belum punya note."}
          </div>
        ) : (
          <ul className="neo-surface flex flex-col border-[3px] border-neo-ink bg-white shadow-neo">
            {notes.map((note) => (
              <NoteRow key={note.id} note={note} noteType={deck.noteType} />
            ))}
          </ul>
        )}

        {truncated && (
          <p className="text-xs font-semibold text-foreground/60">
            Menampilkan {pageSize} dari {matching} note. Persempit dengan pencarian — pagination
            belum ada.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3 border-t-[3px] border-neo-ink pt-6">
        <h2 className="font-mono text-xs font-black uppercase tracking-wider text-foreground/60">
          Zona Berbahaya
        </h2>
        <DeleteDeckButton id={deck.id} slug={deck.slug} noteCount={deck._count.notes} />
      </section>
    </div>
  );
}
