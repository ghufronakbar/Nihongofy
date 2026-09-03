import { NextResponse } from "next/server";
import type { FlashcardNoteTypeKind } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  buildAnkiTextExport,
  type ExportNote,
} from "@/features/flashcard/lib/import/export-text";

/**
 * Export deck sebagai teks format Anki.
 *
 * Satu blok per note type: struktur kolom ditentukan note type, jadi mencampur
 * beberapa note type dalam satu tabel akan menghasilkan kolom yang tidak konsisten.
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Tidak diizinkan." }, { status: 401 });

  const url = new URL(request.url);
  const deckId = Number(url.searchParams.get("deck"));
  if (!Number.isInteger(deckId) || deckId <= 0) {
    return NextResponse.json({ message: "Deck tidak valid." }, { status: 400 });
  }

  const deck = await prisma.flashcardDeck.findFirst({
    where: { id: deckId, userId: session.userId },
    select: { id: true, name: true },
  });
  if (!deck) return NextResponse.json({ message: "Deck tidak ditemukan." }, { status: 404 });

  // Subdeck ikut, seperti saat mengekspor deck di Anki.
  const cards = await prisma.flashcardCard.findMany({
    where: {
      userId: session.userId,
      deck: { OR: [{ id: deck.id }, { name: { startsWith: `${deck.name}::` } }] },
    },
    distinct: ["noteId"],
    orderBy: { position: "asc" },
    select: {
      deck: { select: { name: true } },
      note: { select: { guid: true, noteType: true, fields: true, tags: true } },
    },
    take: 20_000,
  });

  if (cards.length === 0) {
    return NextResponse.json({ message: "Deck ini belum punya kartu." }, { status: 404 });
  }

  const byNoteType = new Map<FlashcardNoteTypeKind, ExportNote[]>();
  for (const card of cards) {
    const list = byNoteType.get(card.note.noteType) ?? [];
    list.push({
      guid: card.note.guid,
      fields: card.note.fields,
      tags: card.note.tags,
      deckName: card.deck.name,
    });
    byNoteType.set(card.note.noteType, list);
  }

  const sections = [...byNoteType.entries()].map(([noteType, notes]) =>
    buildAnkiTextExport(noteType, notes),
  );

  const fileName = `${deck.name.replace(/[^\w-]+/g, "-").replace(/^-|-$/g, "") || "deck"}.txt`;

  return new NextResponse(sections.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
