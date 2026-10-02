"use server";

import { revalidatePath } from "next/cache";
import { Prisma, type FlashcardCard } from "@prisma/client";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildPreviewLabels, getCatalogDeck } from "./data";
import { getFlashcardSettings, type DeckSchedulingContext } from "./lib/collection";
import { LEARN_AHEAD_MS } from "./lib/queue";
import { createNewCardState, scheduleReview } from "./lib/scheduler";
import { getFlashcardDayEnd, getFlashcardDayRange } from "./lib/scheduler/day";
import type { SchedulerCardState } from "./lib/scheduler/types";
import {
  FLASHCARD_DEFAULT_CONFIG,
  FlashcardConfigSchema,
  FlashcardDeckSlugSchema,
  FlashcardDisplaySchema,
  FlashcardRatingSchema,
  FlashcardVocabIdSchema,
  parseFlashcardConfig,
  type FlashcardConfig,
} from "./schemas";
import type { PreviewLabels } from "./types";

type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; message: string };

const SIGN_IN_MESSAGE = "Masuk dulu untuk menyimpan progres.";

// Aksi yang dipanggil reviewer (jawab, undo, tunda, suspend) sengaja TIDAK
// memanggil revalidatePath. Server Action yang me-revalidate apa pun membuat
// router me-render ulang halaman yang sedang dibuka: halaman belajar membangun
// antrean baru, reviewer di-mount ulang, dan sesi (hitungan, ringkasan, undo)
// hilang. Semua halaman flashcard dinamis dan router tidak menyimpannya
// (staleTimes.dynamic = 0), jadi halaman lain tetap segar saat dibuka; daftar
// kata deck me-refresh dirinya sendiri setelah aksinya.

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

const NOT_SUBSCRIBED_MESSAGE = "Tambahkan deck ini dulu untuk menyimpan progres.";
const NOT_IN_DECK_MESSAGE = "Kata ini sudah tidak tersedia di deck ini.";

/**
 * Deck dan kata yang boleh menerima kartu: deck sedang ditambahkan user dan
 * kata (yang belum pensiun) memang termasuk deck itu. Kartu milik langganan
 * deck, jadi tanpa penjaga ini kartu bisa dibuat di deck yang tidak pernah
 * ditambahkan, atau untuk kata yang tidak ada di antreannya.
 */
async function resolveDeckCard(
  userId: number,
  deckSlug: string,
  vocabId: number,
): Promise<{ ok: true; deckId: number; config: FlashcardConfig } | { ok: false; message: string }> {
  const deck = await getCatalogDeck(deckSlug);
  if (!deck) return { ok: false, message: "Deck tidak ditemukan." };

  const [subscription, vocab] = await Promise.all([
    prisma.flashcardDeckSubscription.findUnique({
      where: { userId_deckId: { userId, deckId: deck.id } },
      select: { config: true, unsubscribedAt: true },
    }),
    prisma.flashcardVocab.findUnique({
      where: { id: vocabId },
      select: { retiredAt: true, tags: true },
    }),
  ]);
  if (!subscription || subscription.unsubscribedAt) return { ok: false, message: NOT_SUBSCRIBED_MESSAGE };
  if (!vocab || vocab.retiredAt || !vocab.tags.includes(deck.slug)) {
    return { ok: false, message: NOT_IN_DECK_MESSAGE };
  }
  return { ok: true, deckId: deck.id, config: parseFlashcardConfig(subscription.config) };
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
  deckSlug: FlashcardDeckSlugSchema,
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

  const { deckSlug, vocabId, rating, takenMs, clientToken } = parsed.data;
  const userId = session.userId;
  const deck = await getCatalogDeck(deckSlug);
  if (!deck) return { ok: false, message: "Deck tidak ditemukan." };
  const deckId = deck.id;

  const settings = await getFlashcardSettings(userId);
  const now = new Date();
  const { start: dayStart, endExclusive: dayEnd } = getFlashcardDayRange(now, settings.day);
  const cardKey = { userId_deckId_vocabId: { userId, deckId, vocabId } };

  const [subscription, vocab, card, recorded] = await Promise.all([
    prisma.flashcardDeckSubscription.findUnique({
      where: { userId_deckId: { userId, deckId } },
      select: { config: true, unsubscribedAt: true },
    }),
    prisma.flashcardVocab.findUnique({ where: { id: vocabId }, select: { retiredAt: true, tags: true } }),
    prisma.flashcardCard.findUnique({ where: cardKey }),
    prisma.flashcardRevlog.findUnique({
      where: { userId_clientToken: { userId, clientToken } },
      select: { deckId: true, vocabId: true },
    }),
  ]);
  if (!subscription) return { ok: false, message: NOT_SUBSCRIBED_MESSAGE };

  // Kartu dijadwalkan dengan pengaturan deck pemiliknya.
  const scheduling: DeckSchedulingContext = {
    config: parseFlashcardConfig(subscription.config),
    day: settings.day,
  };

  // Retry dari jawaban yang sebenarnya sudah tersimpan (mis. respons pertama
  // hilang di jaringan): kembalikan hasil yang tercatat. Harus diperiksa
  // SEBELUM penjaga jatuh tempo di bawah — kartu yang baru dijawab memang
  // belum jatuh tempo lagi, dan menolaknya akan membuat reviewer macet.
  if (recorded) {
    if (recorded.vocabId !== vocabId || recorded.deckId !== deckId || !card) {
      return { ok: false, message: "Jawaban tidak valid." };
    }
    const returnsToday = card.queue === "LEARNING" && !card.isSuspended && card.due < dayEnd;
    return {
      ok: true,
      data: {
        dueAt: card.due.toISOString(),
        queue: card.queue,
        becameLeech: false,
        nextPreviewLabels: returnsToday ? buildPreviewLabels(stateOf(card), card.due, scheduling) : null,
      },
    };
  }

  if (subscription.unsubscribedAt) return { ok: false, message: NOT_SUBSCRIBED_MESSAGE };
  if (!vocab || vocab.retiredAt || !vocab.tags.includes(deck.slug)) {
    return { ok: false, message: NOT_IN_DECK_MESSAGE };
  }

  // Antrean di client bukan satu-satunya penjaga: kartu yang disembunyikan,
  // belum jatuh tempo, atau melewati batas kartu baru ditolak di sini juga.
  if (card?.isSuspended) return { ok: false, message: "Kartu ini sedang di-suspend." };
  if (card?.buriedUntil && card.buriedUntil > now) {
    return { ok: false, message: "Kartu ini sedang ditunda sampai besok." };
  }

  const isNew = !card || card.type === "NEW";
  if (isNew) {
    // Batas kartu baru dihitung per deck, dengan batas milik deck ini.
    const newToday = await prisma.flashcardRevlog.count({
      where: { userId, deckId, wasNew: true, reviewedAt: { gte: dayStart, lt: dayEnd } },
    });
    if (newToday >= scheduling.config.newCardsPerDay) {
      return { ok: false, message: "Batas kartu baru deck ini untuk hari ini sudah tercapai." };
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
    config: scheduling.config,
    day: scheduling.day,
  });
  const leechSuspends = result.becameLeech && scheduling.config.leechAction === "suspend";
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
        where: cardKey,
        create: {
          userId,
          deckId,
          vocabId,
          ...cardData,
          isSuspended: leechSuspends,
          isLeech: result.becameLeech,
        },
        update: {
          ...cardData,
          isSuspended: leechSuspends,
          ...(result.becameLeech ? { isLeech: true } : {}),
        },
      }),
      prisma.flashcardRevlog.create({
        data: {
          userId,
          deckId,
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

  return {
    ok: true,
    data: {
      dueAt: result.card.due.toISOString(),
      queue: result.card.queue,
      becameLeech: result.becameLeech,
      nextPreviewLabels: returnsToday
        ? buildPreviewLabels(result.card, result.card.due, scheduling)
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
    select: { id: true, deckId: true, vocabId: true, previousState: true },
  });
  if (!revlog) return { ok: false, message: "Review tidak ditemukan." };
  const { deckId, vocabId } = revlog;

  // Hanya review terakhir sebuah kartu yang boleh dibatalkan; memulihkan
  // snapshot yang lebih lama akan menghapus review sesudahnya.
  const latest = await prisma.flashcardRevlog.findFirst({
    where: { userId, deckId, vocabId },
    orderBy: [{ reviewedAt: "desc" }, { id: "desc" }],
    select: { id: true },
  });
  if (latest?.id !== revlog.id) {
    return { ok: false, message: "Hanya review terakhir kartu ini yang bisa dibatalkan." };
  }

  const key = { userId_deckId_vocabId: { userId, deckId, vocabId } };

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

  return { ok: true };
}

// --- Tunda, suspend, reset ---------------------------------------------------

// Semua aksi kartu menyebut deck-nya: kata yang sama di deck lain adalah kartu
// lain yang tidak boleh ikut tersentuh.
const CardActionSchema = z.object({
  deckSlug: FlashcardDeckSlugSchema,
  vocabId: FlashcardVocabIdSchema,
});

/**
 * Tunda: kartu disembunyikan sampai batas hari berikutnya. Jadwalnya tidak
 * disentuh — kartu muncul lagi begitu `buriedUntil` terlewati.
 */
export async function buryCardAction(input: {
  deckSlug: string;
  vocabId: number;
}): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: SIGN_IN_MESSAGE };

  const parsed = CardActionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Kartu tidak valid." };

  const userId = session.userId;
  const { deckSlug, vocabId } = parsed.data;
  const target = await resolveDeckCard(userId, deckSlug, vocabId);
  if (!target.ok) return target;

  const settings = await getFlashcardSettings(userId);
  const now = new Date();
  const buriedUntil = getFlashcardDayEnd(now, settings.day);
  const { deckId } = target;

  await prisma.flashcardCard.upsert({
    where: { userId_deckId_vocabId: { userId, deckId, vocabId } },
    create: { userId, deckId, vocabId, due: now, buriedUntil },
    update: { buriedUntil },
  });

  // Tanpa revalidatePath: lihat catatan di atas SIGN_IN_MESSAGE.
  return { ok: true };
}

export async function setCardSuspendedAction(input: {
  deckSlug: string;
  vocabId: number;
  suspended: boolean;
}): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: SIGN_IN_MESSAGE };

  const parsed = CardActionSchema.extend({ suspended: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Kartu tidak valid." };

  const userId = session.userId;
  const { deckSlug, vocabId, suspended } = parsed.data;
  const target = await resolveDeckCard(userId, deckSlug, vocabId);
  if (!target.ok) return target;
  const { deckId } = target;

  if (suspended) {
    await prisma.flashcardCard.upsert({
      where: { userId_deckId_vocabId: { userId, deckId, vocabId } },
      create: { userId, deckId, vocabId, due: new Date(), isSuspended: true },
      update: { isSuspended: true },
    });
  } else {
    await prisma.flashcardCard.updateMany({
      where: { userId, deckId, vocabId },
      data: { isSuspended: false },
    });
  }

  // Tanpa revalidatePath: lihat catatan di atas SIGN_IN_MESSAGE.
  return { ok: true };
}

/**
 * Reset ke kartu baru (Forget di Anki). Riwayat review dipertahankan supaya
 * statistik tetap jujur; hanya jadwal dan memory state yang dikosongkan.
 */
export async function resetCardAction(input: {
  deckSlug: string;
  vocabId: number;
}): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: SIGN_IN_MESSAGE };

  const parsed = CardActionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Kartu tidak valid." };

  // Hanya memperbarui kartu yang sudah ada, jadi cukup deck-nya yang dikenali.
  const deck = await getCatalogDeck(parsed.data.deckSlug);
  if (!deck) return { ok: false, message: "Deck tidak ditemukan." };

  const fresh = createNewCardState(new Date());
  await prisma.flashcardCard.updateMany({
    where: { userId: session.userId, deckId: deck.id, vocabId: parsed.data.vocabId },
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
 * Menambahkan deck bawaan ke daftar belajar dengan pengaturan bawaan. Tidak ada
 * kartu yang disalin: kartu baru muncul langsung dari katalog. Deck yang pernah
 * dilepas kembali dengan kartu dan pengaturannya yang lama.
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
    create: {
      userId: session.userId,
      deckId: deck.id,
      config: FLASHCARD_DEFAULT_CONFIG as unknown as Prisma.InputJsonValue,
    },
    update: { unsubscribedAt: null },
  });

  revalidatePath("/flashcard", "layout");
  return { ok: true };
}

/**
 * Melepas deck dari daftar belajar. Baris langganan tidak dihapus — kartu
 * merujuknya — sehingga kartu dan pengaturannya tetap tersimpan.
 */
export async function unsubscribeDeckAction(input: { slug: string }): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Masuk dulu." };

  const parsed = DeckActionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Deck tidak valid." };

  await prisma.flashcardDeckSubscription.updateMany({
    where: { userId: session.userId, deck: { slug: parsed.data.slug }, unsubscribedAt: null },
    data: { unsubscribedAt: new Date() },
  });

  revalidatePath("/flashcard", "layout");
  return { ok: true };
}

// --- Pengaturan ---------------------------------------------------------------

/** Pengaturan yang berlaku untuk semua deck: hanya tampilan kartu. */
export async function saveFlashcardDisplayAction(input: { display: unknown }): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Masuk dulu." };

  const parsed = z.object({ display: FlashcardDisplaySchema }).safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Pengaturan tidak valid." };
  }

  const display = parsed.data.display as unknown as Prisma.InputJsonValue;
  await prisma.flashcardCollection.upsert({
    where: { userId: session.userId },
    create: { userId: session.userId, display },
    update: { display },
  });

  revalidatePath("/flashcard", "layout");
  return { ok: true };
}

const SaveDeckSettingsSchema = z.object({
  slug: FlashcardDeckSlugSchema,
  config: FlashcardConfigSchema,
});

/** Pengaturan penjadwalan satu deck. Hanya untuk deck yang sedang ditambahkan. */
export async function saveDeckSettingsAction(input: {
  slug: string;
  config: unknown;
}): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Masuk dulu." };

  const parsed = SaveDeckSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Pengaturan tidak valid." };
  }

  const deck = await getCatalogDeck(parsed.data.slug);
  if (!deck) return { ok: false, message: "Deck tidak ditemukan." };

  const { count } = await prisma.flashcardDeckSubscription.updateMany({
    where: { userId: session.userId, deckId: deck.id, unsubscribedAt: null },
    data: { config: parsed.data.config as unknown as Prisma.InputJsonValue },
  });
  if (count === 0) return { ok: false, message: NOT_SUBSCRIBED_MESSAGE };

  revalidatePath("/flashcard", "layout");
  return { ok: true };
}
