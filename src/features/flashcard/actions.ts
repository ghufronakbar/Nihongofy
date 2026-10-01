"use server";

import { revalidatePath } from "next/cache";
import { Prisma, type FlashcardCard } from "@prisma/client";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildPreviewLabels, getCatalogDeck } from "./data";
import { getFlashcardSettings } from "./lib/collection";
import { LEARN_AHEAD_MS } from "./lib/queue";
import { createNewCardState, scheduleReview } from "./lib/scheduler";
import { getFlashcardDayEnd, getFlashcardDayRange } from "./lib/scheduler/day";
import type { SchedulerCardState } from "./lib/scheduler/types";
import {
  FlashcardConfigSchema,
  FlashcardDeckSlugSchema,
  FlashcardDisplaySchema,
  FlashcardRatingSchema,
  FlashcardVocabIdSchema,
} from "./schemas";
import type { PreviewLabels } from "./types";

type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; message: string };

const SIGN_IN_MESSAGE = "Masuk dulu untuk menyimpan progres.";

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

// --- Snapshot kartu ----------------------------------------------------------

// Salinan kartu sebelum review, disimpan di revlog supaya undo memulihkan
// keadaan persis — termasuk learning step yang tidak bisa direkonstruksi dari
// riwayat review.
const CardSnapshotSchema = z.object({
  type: z.enum(["NEW", "LEARNING", "REVIEW", "RELEARNING"]),
  queue: z.enum(["NEW", "LEARNING", "DAY_LEARN", "REVIEW"]),
  due: z.iso.datetime(),
  intervalDays: z.number().int(),
  reps: z.number().int(),
  lapses: z.number().int(),
  learningStep: z.number().int(),
  stability: z.number().nullable(),
  difficulty: z.number().nullable(),
  desiredRetention: z.number().nullable(),
  easeFactor: z.number().nullable(),
  lastReviewedAt: z.iso.datetime().nullable(),
  isSuspended: z.boolean(),
  buriedUntil: z.iso.datetime().nullable(),
  isLeech: z.boolean(),
});

function snapshotOf(card: FlashcardCard): z.infer<typeof CardSnapshotSchema> {
  return {
    type: card.type,
    queue: card.queue,
    due: card.due.toISOString(),
    intervalDays: card.intervalDays,
    reps: card.reps,
    lapses: card.lapses,
    learningStep: card.learningStep,
    stability: card.stability,
    difficulty: card.difficulty,
    desiredRetention: card.desiredRetention,
    easeFactor: card.easeFactor,
    lastReviewedAt: card.lastReviewedAt?.toISOString() ?? null,
    isSuspended: card.isSuspended,
    buriedUntil: card.buriedUntil?.toISOString() ?? null,
    isLeech: card.isLeech,
  };
}

function stateOf(card: FlashcardCard): SchedulerCardState {
  return {
    type: card.type,
    queue: card.queue,
    due: card.due,
    intervalDays: card.intervalDays,
    reps: card.reps,
    lapses: card.lapses,
    learningStep: card.learningStep,
    stability: card.stability,
    difficulty: card.difficulty,
    desiredRetention: card.desiredRetention,
    easeFactor: card.easeFactor,
    lastReviewedAt: card.lastReviewedAt,
  };
}

// --- Menjawab ----------------------------------------------------------------

const AnswerSchema = z.object({
  vocabId: FlashcardVocabIdSchema,
  rating: FlashcardRatingSchema,
  takenMs: z.number().int().min(0).max(3_600_000).default(0),
  /**
   * Token idempotency yang dibuat client sekali per kartu, dan DIPAKAI ULANG
   * saat retry. Unik per user, sehingga submit ganda dari dua tab menjadi
   * no-op alih-alih menggandakan review dan menembus batas harian.
   */
  clientToken: z.string().trim().min(8).max(64),
});

export type AnswerCardInput = z.input<typeof AnswerSchema>;

export type AnswerResult = {
  dueAt: string;
  queue: "LEARNING" | "DAY_LEARN" | "REVIEW" | "NEW";
  becameLeech: boolean;
  /** Hanya untuk kartu yang kembali hari ini: label tombol saat ia tampil lagi. */
  nextPreviewLabels: PreviewLabels | null;
};

export async function answerCardAction(input: AnswerCardInput): Promise<ActionResult<AnswerResult>> {
  const session = await getSession();
  // Guest memakai mode coba: penjadwalan hanya hidup di state client.
  if (!session) return { ok: false, message: SIGN_IN_MESSAGE };

  const parsed = AnswerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Jawaban tidak valid." };

  const { vocabId, rating, takenMs, clientToken } = parsed.data;
  const userId = session.userId;
  const settings = await getFlashcardSettings(userId);
  const now = new Date();
  const { start: dayStart, endExclusive: dayEnd } = getFlashcardDayRange(now, settings.day);

  const [vocab, card, recorded] = await Promise.all([
    prisma.flashcardVocab.findUnique({ where: { id: vocabId }, select: { retiredAt: true } }),
    prisma.flashcardCard.findUnique({ where: { userId_vocabId: { userId, vocabId } } }),
    prisma.flashcardRevlog.findUnique({
      where: { userId_clientToken: { userId, clientToken } },
      select: { vocabId: true },
    }),
  ]);

  // Retry dari jawaban yang sebenarnya sudah tersimpan (mis. respons pertama
  // hilang di jaringan): kembalikan hasil yang tercatat. Harus diperiksa
  // SEBELUM penjaga jatuh tempo di bawah — kartu yang baru dijawab memang
  // belum jatuh tempo lagi, dan menolaknya akan membuat reviewer macet.
  if (recorded) {
    if (recorded.vocabId !== vocabId || !card) return { ok: false, message: "Jawaban tidak valid." };
    const returnsToday = card.queue === "LEARNING" && !card.isSuspended && card.due < dayEnd;
    return {
      ok: true,
      data: {
        dueAt: card.due.toISOString(),
        queue: card.queue,
        becameLeech: false,
        nextPreviewLabels: returnsToday ? buildPreviewLabels(stateOf(card), card.due, settings) : null,
      },
    };
  }

  if (!vocab || vocab.retiredAt) return { ok: false, message: "Kata ini sudah tidak tersedia." };

  // Antrean di client bukan satu-satunya penjaga: kartu yang disembunyikan,
  // belum jatuh tempo, atau melewati batas kartu baru ditolak di sini juga.
  if (card?.isSuspended) return { ok: false, message: "Kartu ini sedang di-suspend." };
  if (card?.buriedUntil && card.buriedUntil > now) {
    return { ok: false, message: "Kartu ini sedang ditunda sampai besok." };
  }

  const isNew = !card || card.type === "NEW";
  if (isNew) {
    const newToday = await prisma.flashcardRevlog.count({
      where: { userId, wasNew: true, reviewedAt: { gte: dayStart, lt: dayEnd } },
    });
    if (newToday >= settings.config.newCardsPerDay) {
      return { ok: false, message: "Batas kartu baru hari ini sudah tercapai." };
    }
  } else {
    const dueLimit =
      card.queue === "LEARNING" ? now.getTime() + LEARN_AHEAD_MS : dayEnd.getTime();
    if (card.due.getTime() > dueLimit) {
      return { ok: false, message: "Kartu ini belum jatuh tempo." };
    }
  }

  const result = scheduleReview({
    card: card && card.type !== "NEW" ? stateOf(card) : createNewCardState(now),
    rating,
    now,
    config: settings.config,
    day: settings.day,
  });
  const leechSuspends = result.becameLeech && settings.config.leechAction === "suspend";
  const cardData = {
    type: result.card.type,
    queue: result.card.queue,
    due: result.card.due,
    intervalDays: result.card.intervalDays,
    reps: result.card.reps,
    lapses: result.card.lapses,
    learningStep: result.card.learningStep,
    stability: result.card.stability,
    difficulty: result.card.difficulty,
    desiredRetention: result.card.desiredRetention,
    easeFactor: result.card.easeFactor,
    lastReviewedAt: result.card.lastReviewedAt,
    buriedUntil: null,
  };

  try {
    // Kartu lebih dulu karena revlog merujuknya. Kalau revlog bentrok di
    // clientToken, seluruh transaksi batal — termasuk perubahan kartu.
    await prisma.$transaction([
      prisma.flashcardCard.upsert({
        where: { userId_vocabId: { userId, vocabId } },
        create: { userId, vocabId, ...cardData, isSuspended: leechSuspends, isLeech: result.becameLeech },
        update: {
          ...cardData,
          isSuspended: leechSuspends,
          ...(result.becameLeech ? { isLeech: true } : {}),
        },
      }),
      prisma.flashcardRevlog.create({
        data: {
          userId,
          vocabId,
          clientToken,
          reviewedAt: now,
          rating,
          kind: result.revlog.kind,
          wasNew: isNew,
          intervalDays: result.revlog.intervalDays,
          lastIntervalDays: result.revlog.lastIntervalDays,
          stability: result.revlog.stability,
          difficulty: result.revlog.difficulty,
          easeFactor: result.revlog.easeFactor,
          takenMs,
          previousState: card ? snapshotOf(card) : Prisma.DbNull,
        },
      }),
    ]);
  } catch (error) {
    // P2002 pada (userId, clientToken) = review ini sudah tercatat oleh
    // permintaan sebelumnya. Itu hasil yang diinginkan, bukan kegagalan.
    if (!isUniqueViolation(error)) throw error;
  }

  const returnsToday =
    result.card.queue === "LEARNING" && !leechSuspends && result.card.due < dayEnd;

  revalidatePath("/flashcard");
  return {
    ok: true,
    data: {
      dueAt: result.card.due.toISOString(),
      queue: result.card.queue,
      becameLeech: result.becameLeech,
      nextPreviewLabels: returnsToday
        ? buildPreviewLabels(result.card, result.card.due, settings)
        : null,
    },
  };
}

// --- Undo --------------------------------------------------------------------

export async function undoReviewAction(input: { clientToken: string }): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: SIGN_IN_MESSAGE };

  const parsed = z.object({ clientToken: z.string().trim().min(8).max(64) }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Review tidak valid." };

  const userId = session.userId;
  // Dicari lewat token yang sama dengan yang dipakai saat menjawab — client
  // tidak pernah melihat id revlog.
  const revlog = await prisma.flashcardRevlog.findUnique({
    where: { userId_clientToken: { userId, clientToken: parsed.data.clientToken } },
    select: { id: true, vocabId: true, previousState: true },
  });
  if (!revlog) return { ok: false, message: "Review tidak ditemukan." };

  // Hanya review terakhir sebuah kartu yang boleh dibatalkan; memulihkan
  // snapshot yang lebih lama akan menghapus review sesudahnya.
  const latest = await prisma.flashcardRevlog.findFirst({
    where: { userId, vocabId: revlog.vocabId },
    orderBy: [{ reviewedAt: "desc" }, { id: "desc" }],
    select: { id: true },
  });
  if (latest?.id !== revlog.id) {
    return { ok: false, message: "Hanya review terakhir kartu ini yang bisa dibatalkan." };
  }

  const key = { userId_vocabId: { userId, vocabId: revlog.vocabId } };

  if (revlog.previousState === null) {
    // Kartu baru dibuat oleh review ini; menghapusnya mengembalikan kata ke
    // status baru. Revlog ikut terhapus lewat cascade.
    await prisma.flashcardCard.delete({ where: key });
  } else {
    const snapshot = CardSnapshotSchema.safeParse(revlog.previousState);
    if (!snapshot.success) return { ok: false, message: "Riwayat review ini tidak bisa dibatalkan." };
    const previous = snapshot.data;

    await prisma.$transaction([
      prisma.flashcardCard.update({
        where: key,
        data: {
          ...previous,
          due: new Date(previous.due),
          lastReviewedAt: previous.lastReviewedAt ? new Date(previous.lastReviewedAt) : null,
          buriedUntil: previous.buriedUntil ? new Date(previous.buriedUntil) : null,
        },
      }),
      prisma.flashcardRevlog.delete({ where: { id: revlog.id } }),
    ]);
  }

  revalidatePath("/flashcard");
  return { ok: true };
}

// --- Tunda, suspend, reset ---------------------------------------------------

const CardActionSchema = z.object({ vocabId: FlashcardVocabIdSchema });

async function ensureVocab(vocabId: number) {
  const vocab = await prisma.flashcardVocab.findUnique({
    where: { id: vocabId },
    select: { retiredAt: true },
  });
  return vocab !== null && vocab.retiredAt === null;
}

/**
 * Tunda: kartu disembunyikan sampai batas hari berikutnya. Jadwalnya tidak
 * disentuh — kartu muncul lagi begitu `buriedUntil` terlewati.
 */
export async function buryCardAction(input: { vocabId: number }): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: SIGN_IN_MESSAGE };

  const parsed = CardActionSchema.safeParse(input);
  if (!parsed.success || !(await ensureVocab(parsed.data.vocabId))) {
    return { ok: false, message: "Kartu tidak valid." };
  }

  const userId = session.userId;
  const settings = await getFlashcardSettings(userId);
  const now = new Date();
  const buriedUntil = getFlashcardDayEnd(now, settings.day);

  await prisma.flashcardCard.upsert({
    where: { userId_vocabId: { userId, vocabId: parsed.data.vocabId } },
    create: { userId, vocabId: parsed.data.vocabId, due: now, buriedUntil },
    update: { buriedUntil },
  });

  // Hanya beranda: me-revalidate layout ikut me-render ulang halaman belajar,
  // yang akan membangun antrean baru dan mereset sesi yang sedang berjalan.
  // Halaman lain yang memanggil aksi ini me-refresh dirinya sendiri.
  revalidatePath("/flashcard");
  return { ok: true };
}

export async function setCardSuspendedAction(input: {
  vocabId: number;
  suspended: boolean;
}): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: SIGN_IN_MESSAGE };

  const parsed = CardActionSchema.extend({ suspended: z.boolean() }).safeParse(input);
  if (!parsed.success || !(await ensureVocab(parsed.data.vocabId))) {
    return { ok: false, message: "Kartu tidak valid." };
  }

  const userId = session.userId;
  const { vocabId, suspended } = parsed.data;
  if (suspended) {
    await prisma.flashcardCard.upsert({
      where: { userId_vocabId: { userId, vocabId } },
      create: { userId, vocabId, due: new Date(), isSuspended: true },
      update: { isSuspended: true },
    });
  } else {
    await prisma.flashcardCard.updateMany({
      where: { userId, vocabId },
      data: { isSuspended: false },
    });
  }

  // Lihat catatan di buryCardAction.
  revalidatePath("/flashcard");
  return { ok: true };
}

/**
 * Reset ke kartu baru (Forget di Anki). Riwayat review dipertahankan supaya
 * statistik tetap jujur; hanya jadwal dan memory state yang dikosongkan.
 */
export async function resetCardAction(input: { vocabId: number }): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: SIGN_IN_MESSAGE };

  const parsed = CardActionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Kartu tidak valid." };

  const fresh = createNewCardState(new Date());
  await prisma.flashcardCard.updateMany({
    where: { userId: session.userId, vocabId: parsed.data.vocabId },
    data: {
      type: fresh.type,
      queue: fresh.queue,
      due: fresh.due,
      intervalDays: 0,
      reps: 0,
      lapses: 0,
      learningStep: 0,
      stability: null,
      difficulty: null,
      desiredRetention: null,
      easeFactor: null,
      lastReviewedAt: null,
      buriedUntil: null,
      isLeech: false,
    },
  });

  revalidatePath("/flashcard", "layout");
  return { ok: true };
}

// --- Deck ---------------------------------------------------------------------

const DeckActionSchema = z.object({ slug: FlashcardDeckSlugSchema });

/**
 * Menambahkan deck bawaan ke daftar belajar. Tidak ada yang disalin: kartu
 * baru muncul langsung dari katalog, dan kata yang sudah dipelajari dari deck
 * lain membawa progresnya.
 */
export async function subscribeDeckAction(input: { slug: string }): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Masuk dulu untuk menambahkan deck." };

  const parsed = DeckActionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Deck tidak valid." };

  // Katalog yang sama dengan yang ditampilkan: deck yang disembunyikan karena
  // katanya kurang dari batas minimum tidak bisa ditambahkan lewat URL langsung.
  const deck = await getCatalogDeck(parsed.data.slug);
  if (!deck) return { ok: false, message: "Deck tidak ditemukan." };

  await prisma.flashcardDeckSubscription.upsert({
    where: { userId_deckId: { userId: session.userId, deckId: deck.id } },
    create: { userId: session.userId, deckId: deck.id },
    update: {},
  });

  revalidatePath("/flashcard", "layout");
  return { ok: true };
}

/** Melepas deck dari daftar belajar. Progres kartunya tetap tersimpan. */
export async function unsubscribeDeckAction(input: { slug: string }): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Masuk dulu." };

  const parsed = DeckActionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Deck tidak valid." };

  await prisma.flashcardDeckSubscription.deleteMany({
    where: { userId: session.userId, deck: { slug: parsed.data.slug } },
  });

  revalidatePath("/flashcard", "layout");
  return { ok: true };
}

// --- Pengaturan ---------------------------------------------------------------

const SaveSettingsSchema = z.object({
  config: FlashcardConfigSchema,
  display: FlashcardDisplaySchema,
});

export async function saveFlashcardSettingsAction(input: {
  config: unknown;
  display: unknown;
}): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Masuk dulu." };

  const parsed = SaveSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Pengaturan tidak valid." };
  }

  const config = parsed.data.config as unknown as Prisma.InputJsonValue;
  const display = parsed.data.display as unknown as Prisma.InputJsonValue;
  await prisma.flashcardCollection.upsert({
    where: { userId: session.userId },
    create: { userId: session.userId, config, display },
    update: { config, display },
  });

  revalidatePath("/flashcard", "layout");
  return { ok: true };
}
