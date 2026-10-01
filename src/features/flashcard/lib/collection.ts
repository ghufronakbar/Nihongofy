import "server-only";
import { cache } from "react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getUserTimeZone } from "@/lib/user-time-zone";
import {
  FLASHCARD_DEFAULT_CONFIG,
  FLASHCARD_DEFAULT_DISPLAY,
  parseFlashcardConfig,
  parseFlashcardDisplay,
  type FlashcardConfig,
  type FlashcardDisplay,
} from "../schemas";
import { FLASHCARD_DEFAULT_ROLLOVER_HOUR, type FlashcardDayContext } from "./scheduler/day";

const COLLECTION_SELECT = { rolloverHour: true, config: true, display: true } as const;

export type FlashcardSettings = {
  config: FlashcardConfig;
  display: FlashcardDisplay;
  day: FlashcardDayContext;
};

/**
 * Pengaturan flashcard user beserta konteks batas harinya.
 *
 * Baris koleksi dibuat malas saat pertama dibutuhkan, bukan saat registrasi,
 * supaya user yang tidak memakai flashcard tidak menghasilkan baris kosong.
 * Zona waktu selalu dibaca dari `User.timeZone` (lewat cache profil), bukan
 * disalin: menyalinnya membuat batas hari salah begitu user pindah zona waktu.
 */
export const getFlashcardSettings = cache(async (userId: number): Promise<FlashcardSettings> => {
  const [existing, timeZone] = await Promise.all([
    prisma.flashcardCollection.findUnique({ where: { userId }, select: COLLECTION_SELECT }),
    getUserTimeZone(userId),
  ]);

  // Upsert, bukan create: dua request pertama yang bersamaan tidak boleh
  // saling menggagalkan karena primary key yang sama.
  const collection =
    existing ??
    (await prisma.flashcardCollection.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
        rolloverHour: FLASHCARD_DEFAULT_ROLLOVER_HOUR,
        config: FLASHCARD_DEFAULT_CONFIG as unknown as Prisma.InputJsonValue,
        display: FLASHCARD_DEFAULT_DISPLAY as unknown as Prisma.InputJsonValue,
      },
      select: COLLECTION_SELECT,
    }));

  return {
    config: parseFlashcardConfig(collection.config),
    display: parseFlashcardDisplay(collection.display),
    day: { timeZone, rolloverHour: collection.rolloverHour },
  };
});
