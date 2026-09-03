import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Upload } from "lucide-react";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  SystemDeckCatalog,
  type CatalogDeck,
} from "@/features/flashcard/components/system-deck-catalog";
import { FLASHCARD_NOTE_TYPES } from "@/features/flashcard/note-types";

export const metadata: Metadata = { title: "Tambah deck" };

export default async function AddDeckPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/flashcard/add");

  const [catalog, owned] = await Promise.all([
    prisma.flashcardSystemDeck.findMany({
      where: { isPublished: true },
      orderBy: [{ order: "asc" }, { name: "asc" }],
      select: {
        slug: true,
        name: true,
        description: true,
        jlptLevel: true,
        noteType: true,
        license: true,
        _count: { select: { notes: true } },
      },
    }),
    prisma.flashcardDeck.findMany({
      where: { userId: session.userId, sourceKind: "SYSTEM" },
      select: { sourceRef: true },
    }),
  ]);

  const ownedSlugs = new Set(owned.map((deck) => deck.sourceRef));
  const decks: CatalogDeck[] = catalog.map((deck) => ({
    slug: deck.slug,
    name: deck.name,
    description: deck.description,
    jlptLevel: deck.jlptLevel,
    noteTypeLabel: FLASHCARD_NOTE_TYPES[deck.noteType].label,
    license: deck.license,
    noteCount: deck._count.notes,
    alreadyAdded: ownedSlugs.has(deck.slug),
  }));

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <Link href="/flashcard" className="text-sm font-black underline">
        ← Semua deck
      </Link>

      <h1 className="mt-4 text-3xl font-black">Tambah deck</h1>
      <p className="mt-2 font-bold text-muted-foreground">
        Pilih deck bawaan untuk disalin ke koleksimu. Setelah ditambahkan, deck sepenuhnya
        milikmu — boleh diubah namanya, diganti preset-nya, atau dihapus kartunya.
      </p>

      <div className="mt-7">
        <SystemDeckCatalog decks={decks} />
      </div>

      <div className="neo-surface mt-8 p-5">
        <h2 className="font-black">Impor dari file</h2>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">
          Punya deck sendiri dalam bentuk CSV atau TXT format Anki? Impor langsung ke koleksimu.
        </p>
        <Link href="/flashcard/import" className="neo-button mt-4 bg-white">
          <Upload className="size-4" aria-hidden /> Impor file
        </Link>
      </div>
    </main>
  );
}
