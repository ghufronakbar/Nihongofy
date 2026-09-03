import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fieldToPlainText } from "./lib/render/sanitize";
import { getNoteType, getSortFieldIndex } from "./note-types";

/**
 * Query card browser.
 *
 * Pencarian teks memakai `hasSome` pada kolom array `fields` tidak mungkin
 * (Postgres tidak punya LIKE untuk elemen array lewat Prisma), jadi filter teks
 * dikerjakan lewat raw SQL pada `array_to_string`. Filter lain tetap lewat
 * Prisma agar tetap terketik.
 */

export const BROWSE_PAGE_SIZE = 50;

export type BrowseFilters = {
  deckId: number | null;
  state: "all" | "new" | "learning" | "review" | "suspended" | "buried";
  tag: string | null;
  query: string;
  page: number;
};

export type BrowseCard = {
  cardId: string;
  noteId: string;
  deckName: string;
  templateName: string;
  sortField: string;
  answerPreview: string;
  state: string;
  queue: string;
  due: Date;
  intervalDays: number;
  reps: number;
  lapses: number;
  position: number;
  tags: string[];
};

const STATE_FILTERS: Record<BrowseFilters["state"], Prisma.FlashcardCardWhereInput> = {
  all: {},
  new: { queue: "NEW" },
  learning: { queue: { in: ["LEARNING", "DAY_LEARN"] } },
  review: { queue: "REVIEW" },
  suspended: { queue: "SUSPENDED" },
  buried: { queue: { in: ["BURIED_USER", "BURIED_SIBLING"] } },
};

export async function getBrowseCards(userId: number, filters: BrowseFilters) {
  const where: Prisma.FlashcardCardWhereInput = {
    userId,
    ...STATE_FILTERS[filters.state],
    ...(filters.deckId ? { deckId: filters.deckId } : {}),
    ...(filters.tag ? { note: { tags: { has: filters.tag } } } : {}),
  };

  // Pencarian teks dijalankan sebagai penyempitan id lebih dulu supaya sisa
  // filter tetap memakai jalur Prisma yang terketik.
  if (filters.query.trim()) {
    const pattern = `%${filters.query.trim().toLowerCase()}%`;
    const matches = await prisma.$queryRaw<{ id: bigint }[]>`
      SELECT id FROM "FlashcardNote"
      WHERE "userId" = ${userId}
        AND lower(array_to_string(fields, ' ')) LIKE ${pattern}
      LIMIT 5000
    `;
    if (matches.length === 0) {
      return { cards: [] as BrowseCard[], total: 0 };
    }
    where.noteId = { in: matches.map((row) => row.id) };
  }

  const [rows, total] = await Promise.all([
    prisma.flashcardCard.findMany({
      where,
      orderBy: [{ deckId: "asc" }, { position: "asc" }, { id: "asc" }],
      skip: (filters.page - 1) * BROWSE_PAGE_SIZE,
      take: BROWSE_PAGE_SIZE,
      select: {
        id: true,
        noteId: true,
        ord: true,
        type: true,
        queue: true,
        due: true,
        intervalDays: true,
        reps: true,
        lapses: true,
        position: true,
        deck: { select: { name: true } },
        note: { select: { noteType: true, fields: true, tags: true } },
      },
    }),
    prisma.flashcardCard.count({ where }),
  ]);

  const cards: BrowseCard[] = rows.map((row) => {
    const definition = getNoteType(row.note.noteType);
    const sortIndex = getSortFieldIndex(row.note.noteType);
    const template = definition.cardTemplates[row.ord];

    // Untuk cloze, `cardTemplates` kosong; nama kartunya dibentuk dari ord.
    const templateName = template?.name ?? `Cloze ${row.ord + 1}`;
    const answerKey = template?.back[0];
    const answerIndex = answerKey
      ? definition.fields.findIndex((field) => field.key === answerKey)
      : -1;

    return {
      cardId: row.id.toString(),
      noteId: row.noteId.toString(),
      deckName: row.deck.name,
      templateName,
      sortField: fieldToPlainText(row.note.fields[sortIndex] ?? ""),
      answerPreview:
        answerIndex >= 0 ? fieldToPlainText(row.note.fields[answerIndex] ?? "") : "",
      state: row.type,
      queue: row.queue,
      due: row.due,
      intervalDays: row.intervalDays,
      reps: row.reps,
      lapses: row.lapses,
      position: row.position,
      tags: row.note.tags,
    };
  });

  return { cards, total };
}

export async function getBrowseFacets(userId: number) {
  const [decks, notes] = await Promise.all([
    prisma.flashcardDeck.findMany({
      where: { userId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.flashcardNote.findMany({ where: { userId }, select: { tags: true } }),
  ]);

  const tags = [...new Set(notes.flatMap((note) => note.tags))].sort();
  return { decks, tags };
}
