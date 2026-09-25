import "server-only";

import { prisma } from "@/lib/prisma";

// Tidak di-cache: layar ini dibuka untuk memeriksa katalog setelah seed atau
// penyuntingan, jadi harus selalu mencerminkan isi database sekarang.

export async function listSystemDecks() {
  return prisma.flashcardSystemDeck.findMany({
    orderBy: [{ order: "asc" }, { slug: "asc" }],
    select: {
      id: true,
      slug: true,
      name: true,
      jlptLevel: true,
      noteType: true,
      license: true,
      order: true,
      isPublished: true,
      updatedAt: true,
      _count: { select: { notes: true } },
    },
  });
}

export async function getSystemDeck(id: number) {
  return prisma.flashcardSystemDeck.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      jlptLevel: true,
      noteType: true,
      license: true,
      order: true,
      isPublished: true,
      _count: { select: { notes: true } },
    },
  });
}

const NOTE_PAGE_SIZE = 100;

export async function listSystemNotes(deckId: number, query: string) {
  const where = {
    deckId,
    ...(query
      ? { OR: [{ guid: { contains: query, mode: "insensitive" as const } }, { fields: { has: query } }] }
      : {}),
  };

  const [notes, matching] = await Promise.all([
    prisma.flashcardSystemNote.findMany({
      where,
      orderBy: [{ order: "asc" }, { guid: "asc" }],
      take: NOTE_PAGE_SIZE,
      select: { id: true, guid: true, fields: true, tags: true, order: true },
    }),
    prisma.flashcardSystemNote.count({ where }),
  ]);

  return { notes, matching, truncated: matching > notes.length, pageSize: NOTE_PAGE_SIZE };
}

export async function getSystemNote(id: number) {
  return prisma.flashcardSystemNote.findUnique({
    where: { id },
    select: {
      id: true,
      guid: true,
      fields: true,
      tags: true,
      order: true,
      deck: { select: { id: true, slug: true, name: true, noteType: true } },
    },
  });
}

/**
 * Membentuk ulang isi deck sebagai file fixture `src/flashcard-deck-data/<slug>.json`.
 *
 * Ini bukan kemewahan. Seed memperlakukan file sebagai sumber kebenaran dan
 * MENGHAPUS note yang tidak ada di dalamnya, jadi penyuntingan lewat UI akan
 * hilang pada `npm run seed:flashcard-deck` berikutnya kecuali filenya ikut
 * diperbarui. Export ini yang menutup lingkarannya.
 */
export async function buildDeckFixture(id: number) {
  const deck = await prisma.flashcardSystemDeck.findUnique({
    where: { id },
    select: {
      slug: true,
      name: true,
      description: true,
      jlptLevel: true,
      noteType: true,
      license: true,
      order: true,
      isPublished: true,
      notes: {
        orderBy: [{ order: "asc" }, { guid: "asc" }],
        select: { guid: true, fields: true, tags: true, order: true },
      },
    },
  });

  if (!deck) return null;

  // Bentuknya mengikuti docs/seed-flashcard.md persis, termasuk urutan kunci,
  // supaya hasilnya dapat langsung ditimpakan ke file fixture.
  const fixture = {
    slug: deck.slug,
    name: deck.name,
    description: deck.description,
    ...(deck.jlptLevel ? { jlptLevel: deck.jlptLevel } : {}),
    noteType: deck.noteType,
    license: deck.license,
    order: deck.order,
    isPublished: deck.isPublished,
    notes: deck.notes.map((note) => ({
      guid: note.guid,
      fields: note.fields,
      tags: note.tags,
      order: note.order,
    })),
  };

  return { slug: deck.slug, json: `${JSON.stringify(fixture, null, 2)}\n` };
}
