import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getUserTimeZone } from "@/lib/user-time-zone";
import {
  FLASHCARD_DEFAULT_PRESET_CONFIG,
  FLASHCARD_DEFAULT_PRESET_NAME,
} from "../schemas";
import { FLASHCARD_DEFAULT_ROLLOVER_HOUR, type FlashcardDayContext } from "./scheduler/day";

/**
 * Koleksi dibuat malas saat pertama kali dibutuhkan, bukan saat registrasi,
 * supaya user yang tidak memakai flashcard tidak menghasilkan baris kosong.
 */
export async function ensureCollection(userId: number) {
  const existing = await prisma.flashcardCollection.findUnique({ where: { userId } });
  if (existing) return existing;

  const timeZone = await getUserTimeZone(userId);

  return prisma.flashcardCollection.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      createdAtDay: new Date(),
      rolloverHour: FLASHCARD_DEFAULT_ROLLOVER_HOUR,
      timeZone,
    },
  });
}

export async function ensureDefaultPreset(userId: number) {
  return prisma.flashcardPreset.upsert({
    where: { userId_name: { userId, name: FLASHCARD_DEFAULT_PRESET_NAME } },
    update: {},
    create: {
      userId,
      name: FLASHCARD_DEFAULT_PRESET_NAME,
      config: FLASHCARD_DEFAULT_PRESET_CONFIG as unknown as Prisma.InputJsonValue,
    },
  });
}

export function dayContextOf(collection: {
  timeZone: string;
  rolloverHour: number;
}): FlashcardDayContext {
  return { timeZone: collection.timeZone, rolloverHour: collection.rolloverHour };
}

/**
 * ID kartu, note, dan revlog memakai epoch milidetik seperti Anki, sehingga bisa
 * dipertahankan lintas import dan dipakai sebagai idempotency key. Counter
 * menjaga keunikan saat banyak baris dibuat dalam milidetik yang sama.
 */
let lastStamp = 0;

export function nextEntityId(at: Date = new Date()): bigint {
  const stamp = Math.max(at.getTime(), lastStamp + 1);
  lastStamp = stamp;
  return BigInt(stamp);
}

/**
 * Anki membuat deck induk secara otomatis: menambahkan "Kana::Hiragana" saat
 * "Kana" belum ada akan membuat keduanya. Tanpa ini, deck anak menjadi yatim dan
 * tampil sebagai root di UI — kehilangan pengelompokannya.
 *
 * Mengembalikan id deck terdalam (deck yang sebenarnya diminta).
 */
export async function ensureDeckPath(
  userId: number,
  name: string,
  presetId: number,
  leaf: { description?: string; sourceKind?: "SYSTEM" | "IMPORTED" | "MANUAL"; sourceRef?: string } = {},
  client: Pick<typeof prisma, "flashcardDeck"> = prisma,
) {
  const segments = name.split("::");
  let deckId = 0;

  for (let depth = 1; depth <= segments.length; depth += 1) {
    const path = segments.slice(0, depth).join("::");
    const isLeaf = depth === segments.length;

    const deck = await client.flashcardDeck.upsert({
      where: { userId_name: { userId, name: path } },
      // Deck induk yang sudah ada tidak diubah — user mungkin sudah me-rename
      // deskripsinya atau mengganti presetnya.
      update: {},
      create: {
        userId,
        name: path,
        description: isLeaf ? (leaf.description ?? "") : "",
        presetId,
        sourceKind: isLeaf ? (leaf.sourceKind ?? "MANUAL") : "MANUAL",
        sourceRef: isLeaf ? (leaf.sourceRef ?? null) : null,
      },
      select: { id: true },
    });

    deckId = deck.id;
  }

  return deckId;
}
