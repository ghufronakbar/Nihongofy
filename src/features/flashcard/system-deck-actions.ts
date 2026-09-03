"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureCollection, ensureDeckPath, ensureDefaultPreset } from "./lib/collection";
import { countCardsForNote } from "./note-types";

/**
 * Menambahkan deck bawaan = MENYALIN isinya ke koleksi user.
 *
 * Alternatifnya (copy-on-write: note tetap milik katalog, hanya progres yang per
 * user) lebih hemat storage tapi melanggar semantik Anki — user tidak akan bisa
 * mengedit, menghapus, atau memposisikan ulang kartunya — dan memaksa dua jalur
 * kode berbeda di setiap fitur editing. Karena itu disalin penuh.
 */

const AddSchema = z.object({
  slug: z.string().trim().min(3).max(120),
});

type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; message: string };

/** Prefix guid supaya deck bawaan yang sama tidak masuk dua kali ke satu koleksi. */
function systemNoteGuid(slug: string, noteGuid: string) {
  return `sys:${slug}:${noteGuid}`;
}

/**
 * Nama deck harus unik per user. Kalau sudah terpakai, imbuhkan angka —
 * seperti Anki saat mengimpor deck dengan nama yang sudah ada.
 */
async function resolveDeckName(userId: number, preferred: string) {
  const taken = new Set(
    (
      await prisma.flashcardDeck.findMany({
        where: { userId, OR: [{ name: preferred }, { name: { startsWith: `${preferred} ` } }] },
        select: { name: true },
      })
    ).map((deck) => deck.name),
  );

  if (!taken.has(preferred)) return preferred;
  for (let suffix = 2; suffix < 100; suffix += 1) {
    const candidate = `${preferred} ${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${preferred} ${Date.now()}`;
}

export async function addSystemDeckAction(input: {
  slug: string;
}): Promise<ActionResult<{ deckId: number; noteCount: number; cardCount: number }>> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Masuk dulu untuk menambahkan deck." };

  const parsed = AddSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Deck tidak valid." };

  const source = await prisma.flashcardSystemDeck.findFirst({
    where: { slug: parsed.data.slug, isPublished: true },
    select: {
      slug: true,
      name: true,
      description: true,
      noteType: true,
      notes: {
        orderBy: { order: "asc" },
        select: { guid: true, fields: true, tags: true, order: true },
      },
    },
  });
  if (!source) return { ok: false, message: "Deck bawaan tidak ditemukan." };

  await ensureCollection(session.userId);
  const preset = await ensureDefaultPreset(session.userId);

  // Note yang sudah pernah disalin dilewati, sehingga menambahkan deck yang
  // diperbarui hanya membawa note barunya dan tidak mereset progres yang ada.
  const existingGuids = new Set(
    (
      await prisma.flashcardNote.findMany({
        where: {
          userId: session.userId,
          guid: { in: source.notes.map((note) => systemNoteGuid(source.slug, note.guid)) },
        },
        select: { guid: true },
      })
    ).map((note) => note.guid),
  );

  const fresh = source.notes.filter(
    (note) => !existingGuids.has(systemNoteGuid(source.slug, note.guid)),
  );
  if (fresh.length === 0) {
    return { ok: false, message: "Semua kartu deck ini sudah ada di koleksimu." };
  }

  const deckName = await resolveDeckName(session.userId, source.name);
  const now = new Date();

  // ID mengikuti konvensi Anki (epoch ms). Dibuat berurutan di memori supaya
  // ratusan baris bisa dibuat lewat createMany, bukan satu insert per baris.
  let stamp = now.getTime();
  const nextId = () => BigInt(stamp++);

  const noteRows: {
    id: bigint;
    userId: number;
    noteType: typeof source.noteType;
    guid: string;
    fields: string[];
    tags: string[];
    checksum: number;
  }[] = [];
  const cardRows: {
    id: bigint;
    userId: number;
    noteId: bigint;
    ord: number;
    due: Date;
    position: number;
  }[] = [];

  for (const [index, note] of fresh.entries()) {
    const noteId = nextId();
    noteRows.push({
      id: noteId,
      userId: session.userId,
      noteType: source.noteType,
      guid: systemNoteGuid(source.slug, note.guid),
      fields: note.fields,
      tags: note.tags,
      checksum: fieldChecksum(note.fields[0] ?? ""),
    });

    const cardCount = countCardsForNote(source.noteType, note.fields);
    for (let ord = 0; ord < cardCount; ord += 1) {
      cardRows.push({
        id: nextId(),
        userId: session.userId,
        noteId,
        ord,
        due: now,
        position: index,
      });
    }
  }

  const deck = await prisma.$transaction(async (tx) => {
    // Membuat seluruh jalur, bukan hanya daunnya: "Kana::Hiragana" ikut membuat
    // deck "Kana" kalau belum ada, seperti Anki.
    const deckId = await ensureDeckPath(
      session.userId,
      deckName,
      preset.id,
      {
        description: source.description,
        sourceKind: "SYSTEM",
        sourceRef: source.slug,
      },
      tx,
    );

    await tx.flashcardNote.createMany({ data: noteRows });
    await tx.flashcardCard.createMany({
      data: cardRows.map((card) => ({ ...card, deckId })),
    });

    return { id: deckId };
  });

  revalidatePath("/flashcard");
  return {
    ok: true,
    data: { deckId: deck.id, noteCount: noteRows.length, cardCount: cardRows.length },
  };
}

/** Checksum field pertama, padanan `csum` di Anki — dipakai deteksi duplikat. */
function fieldChecksum(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (Math.imul(31, hash) + value.charCodeAt(index)) | 0;
  }
  return hash;
}
