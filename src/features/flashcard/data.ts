import "server-only";
import { cache } from "react";
import { Prisma, type FlashcardCardQueue, type FlashcardCardType } from "@prisma/client";
import { z } from "zod";
import { FEATURES } from "@/constants";
import { prisma } from "@/lib/prisma";
import {
  getOwnVocabNotes,
  getVocabDiscussionCounts,
  type OwnNote,
} from "@/features/question-comment/queries";
import { getFlashcardSettings, type DeckSchedulingContext } from "./lib/collection";
import {
  buildQueue,
  insertionPosition,
  LEARN_AHEAD_MS,
  type QueueCandidate,
  type QueueEntry,
} from "./lib/queue";
import { formatIntervalLabel } from "./lib/preview-interval";
import { createNewCardState, previewSchedule, type SchedulerCardState } from "./lib/scheduler";
import { getFlashcardDayRange, type FlashcardDayContext } from "./lib/scheduler/day";
import { FLASHCARD_RATINGS } from "./lib/scheduler/types";
import {
  buildForecast,
  buildMaturity,
  computeTrueRetention,
  type DailyBucket,
  type MaturityCounts,
  type RetentionSummary,
} from "./lib/stats";
import {
  FLASHCARD_DEFAULT_CONFIG,
  parseFlashcardConfig,
  type FlashcardConfig,
} from "./schemas";
import { describeTags, FLASHCARD_DECK_MIN_NOTES } from "./taxonomy";
import type {
  CardDiscussionData,
  DeckDueCounts,
  DeckKind,
  DeckSummary,
  DeckWord,
  DeckWordStatus,
  PendingLearningCard,
  PreviewLabels,
  ReviewerCard,
  ReviewerCardKind,
  StudyCounts,
  TomorrowWindow,
  VocabCardContent,
} from "./types";

/**
 * Query flashcard. Deck hanyalah tag: kata termasuk deck bila
 * `FlashcardVocab.tags` memuat slug deck itu. Kartu milik satu deck
 * (`userId + deckId + vocabId`), jadi kata yang ada di dua deck punya dua kartu
 * dengan progres masing-masing. Hampir semua hitungan ditulis sebagai SQL
 * mentah — relasi "deck memuat kata" tidak bisa diekspresikan Prisma tanpa
 * memuat seluruh katalog ke memori.
 */

/** Sesi belajar dikirim ke client per potongan supaya payload tetap kecil. */
const STUDY_BATCH_SIZE = 200;
const WORDS_PAGE_SIZE = 50;
const TRY_CARD_LIMIT = 20;

/** Timestamp untuk kolom `timestamp(3)` yang disimpan Prisma dalam UTC. */
function utc(date: Date) {
  return Prisma.sql`(${date.toISOString()}::timestamptz AT TIME ZONE 'UTC')`;
}

/** Kartu yang tidak sedang di-suspend maupun ditunda. */
function available(now: Date) {
  return Prisma.sql`(NOT c."isSuspended" AND (c."buriedUntil" IS NULL OR c."buriedUntil" <= ${utc(now)}))`;
}

const ExamplesSchema = z
  .array(z.object({ jp: z.string(), id: z.string(), en: z.string() }))
  .catch([]);

type VocabContentRow = {
  level: string;
  word: string;
  wordPlain: string;
  reading: string;
  meaningsId: string[];
  meaningsEn: string[];
  examples: unknown;
  notes: string;
  tags: string[];
};

/** Kolom yang dibutuhkan `toCardContent`; dipakai juga antrean laporan admin. */
export const VOCAB_CONTENT_SELECT = {
  id: true,
  level: true,
  word: true,
  wordPlain: true,
  reading: true,
  meaningsId: true,
  meaningsEn: true,
  examples: true,
  notes: true,
  tags: true,
} as const;

export function toCardContent(row: VocabContentRow): VocabCardContent {
  return {
    level: row.level,
    word: row.word,
    wordPlain: row.wordPlain,
    reading: row.reading,
    meaningsId: row.meaningsId,
    meaningsEn: row.meaningsEn,
    examples: ExamplesSchema.parse(row.examples),
    notes: row.notes,
    tags: describeTags(row.tags),
  };
}

/**
 * Label interval untuk keempat tombol. Dihitung server supaya client tidak
 * perlu memuat ts-fsrs. Fuzz membuat angka ini bisa meleset beberapa persen
 * dari hasil akhir — perilaku yang sama dengan Anki.
 */
export function buildPreviewLabels(
  state: SchedulerCardState,
  now: Date,
  settings: DeckSchedulingContext,
): PreviewLabels {
  const preview = previewSchedule({ card: state, now, config: settings.config, day: settings.day });
  return Object.fromEntries(
    FLASHCARD_RATINGS.map((rating) => [rating, formatIntervalLabel(now, preview[rating].card.due)]),
  ) as PreviewLabels;
}

// ---------------------------------------------------------------------------
// Katalog
// ---------------------------------------------------------------------------

type DeckRow = {
  id: number;
  slug: string;
  kind: DeckKind;
  name: string;
  nameJa: string;
  description: string;
  wordCount: number;
};

/**
 * Deck bawaan yang tampil. Deck dengan kata kurang dari batas minimum taxonomy
 * disembunyikan — biasanya karena kata-katanya belum selesai digenerate.
 */
export const getDeckCatalog = cache(async (): Promise<DeckSummary[]> => {
  const rows = await prisma.$queryRaw<DeckRow[]>`
    SELECT d.id, d.slug, d.kind::text AS kind, d.name, d."nameJa", d.description,
      (
        SELECT count(*)::int FROM "FlashcardVocab" v
        WHERE v.tags @> ARRAY[d.slug]::text[] AND v."retiredAt" IS NULL
      ) AS "wordCount"
    FROM "FlashcardDeck" d
    WHERE d."isPublished"
    ORDER BY d."order" ASC
  `;
  return rows.filter((row) => row.wordCount >= FLASHCARD_DECK_MIN_NOTES);
});

export async function getCatalogDeck(slug: string): Promise<DeckSummary | null> {
  const catalog = await getDeckCatalog();
  return catalog.find((deck) => deck.slug === slug) ?? null;
}

// ---------------------------------------------------------------------------
// Hitungan harian
// ---------------------------------------------------------------------------

export type DailyAllowance = {
  newStudiedToday: number;
  reviewsToday: number;
  newLeft: number;
  reviewLeft: number;
};

type TodayRow = { deckId: number; newStudiedToday: number; reviewsToday: number };

/**
 * Kartu baru dan review yang sudah dijawab hari ini, per deck. Batas harian
 * berlaku per deck — tidak ada batas gabungan — jadi revlog dihitung lewat
 * `deckId`-nya, bukan lewat tag kata.
 */
async function countTodayByDeck(
  userId: number,
  deckIds: number[],
  day: FlashcardDayContext,
  now: Date,
): Promise<Map<number, TodayRow>> {
  if (deckIds.length === 0) return new Map();

  const { start, endExclusive } = getFlashcardDayRange(now, day);
  const rows = await prisma.$queryRaw<TodayRow[]>`
    SELECT r."deckId",
      count(*) FILTER (WHERE r."wasNew")::int AS "newStudiedToday",
      count(*) FILTER (WHERE r.kind = 'REVIEW')::int AS "reviewsToday"
    FROM "FlashcardRevlog" r
    WHERE r."userId" = ${userId} AND r."deckId" = ANY(${deckIds}::int[])
      AND r."reviewedAt" >= ${utc(start)} AND r."reviewedAt" < ${utc(endExclusive)}
    GROUP BY r."deckId"
  `;
  return new Map(rows.map((row) => [row.deckId, row]));
}

/** Sisa jatah hari ini sebuah deck menurut pengaturan deck itu. */
function toAllowance(today: TodayRow | undefined, config: FlashcardConfig): DailyAllowance {
  const newStudiedToday = today?.newStudiedToday ?? 0;
  const reviewsToday = today?.reviewsToday ?? 0;
  return {
    newStudiedToday,
    reviewsToday,
    newLeft: Math.max(0, config.newCardsPerDay - newStudiedToday),
    reviewLeft: Math.max(0, config.maxReviewsPerDay - reviewsToday),
  };
}

type ProgressRow = {
  deckId: number;
  newCount: number;
  learningNow: number;
  learningLater: number;
  reviewCount: number;
};

/** Hitungan antrean tiap deck. Kartu deck lain untuk kata yang sama tidak ikut. */
async function countDeckProgress(userId: number, deckIds: number[], now: Date, dayEnd: Date) {
  if (deckIds.length === 0) return new Map<number, ProgressRow>();

  const cutoff = new Date(now.getTime() + LEARN_AHEAD_MS);
  const rows = await prisma.$queryRaw<ProgressRow[]>`
    SELECT d.id AS "deckId",
      count(*) FILTER (
        WHERE c."vocabId" IS NULL OR (c.queue = 'NEW' AND ${available(now)})
      )::int AS "newCount",
      count(*) FILTER (
        WHERE ${available(now)} AND (
          (c.queue = 'LEARNING' AND c.due <= ${utc(cutoff)})
          OR (c.queue = 'DAY_LEARN' AND c.due < ${utc(dayEnd)})
        )
      )::int AS "learningNow",
      count(*) FILTER (
        WHERE ${available(now)} AND c.queue = 'LEARNING'
          AND c.due > ${utc(cutoff)} AND c.due < ${utc(dayEnd)}
      )::int AS "learningLater",
      count(*) FILTER (
        WHERE ${available(now)} AND c.queue = 'REVIEW' AND c.due < ${utc(dayEnd)}
      )::int AS "reviewCount"
    FROM "FlashcardDeck" d
    JOIN "FlashcardVocab" v ON v.tags @> ARRAY[d.slug]::text[] AND v."retiredAt" IS NULL
    LEFT JOIN "FlashcardCard" c
      ON c."vocabId" = v.id AND c."userId" = ${userId} AND c."deckId" = d.id
    WHERE d.id = ANY(${deckIds}::int[])
    GROUP BY d.id
  `;
  return new Map(rows.map((row) => [row.deckId, row]));
}

/** Hitungan yang ditampilkan: kartu jatuh tempo dipotong sisa jatah hari ini. */
function toDueCounts(
  progress: ProgressRow | undefined,
  allowance: DailyAllowance,
  config: FlashcardConfig,
): DeckDueCounts {
  const reviewCount = Math.min(progress?.reviewCount ?? 0, allowance.reviewLeft);
  const newCap = config.newCardsIgnoreReviewLimit
    ? allowance.newLeft
    : Math.min(allowance.newLeft, Math.max(0, allowance.reviewLeft - reviewCount));
  return {
    newCount: Math.min(progress?.newCount ?? 0, newCap),
    learningCount: progress?.learningNow ?? 0,
    reviewCount,
    learningLaterCount: progress?.learningLater ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Deck milik user
// ---------------------------------------------------------------------------

export type MyDeck = DeckSummary & {
  config: FlashcardConfig;
  allowance: DailyAllowance;
  due: DeckDueCounts;
};

export type SubscribedDeck = DeckSummary & { config: FlashcardConfig };

/**
 * Deck yang sedang ditambahkan user beserta pengaturannya, tanpa hitungan
 * antrean. Deck yang dilepas, atau yang tidak lagi tampil di katalog, tidak ikut.
 */
export async function getSubscribedDecks(userId: number): Promise<SubscribedDeck[]> {
  const [catalog, subscriptions] = await Promise.all([
    getDeckCatalog(),
    prisma.flashcardDeckSubscription.findMany({
      where: { userId, unsubscribedAt: null },
      select: { deckId: true, config: true },
    }),
  ]);

  const configs = new Map(
    subscriptions.map((row) => [row.deckId, parseFlashcardConfig(row.config)]),
  );
  return catalog.flatMap((deck) => {
    const config = configs.get(deck.id);
    return config ? [{ ...deck, config }] : [];
  });
}

/** Deck yang sedang ditambahkan user beserta hitungan hari ini. */
export async function getMyDecks(userId: number) {
  const [settings, decks] = await Promise.all([
    getFlashcardSettings(userId),
    getSubscribedDecks(userId),
  ]);
  const deckIds = decks.map((deck) => deck.id);

  const now = new Date();
  const { endExclusive: dayEnd } = getFlashcardDayRange(now, settings.day);
  const [today, progress] = await Promise.all([
    countTodayByDeck(userId, deckIds, settings.day, now),
    countDeckProgress(userId, deckIds, now, dayEnd),
  ]);

  const myDecks = decks.map((deck): MyDeck => {
    const allowance = toAllowance(today.get(deck.id), deck.config);
    return { ...deck, allowance, due: toDueCounts(progress.get(deck.id), allowance, deck.config) };
  });

  return {
    settings,
    /** Jumlah semua deck hari ini; hanya informasi, bukan batas. */
    today: {
      newStudied: myDecks.reduce((total, deck) => total + deck.allowance.newStudiedToday, 0),
      reviews: myDecks.reduce((total, deck) => total + deck.allowance.reviewsToday, 0),
    },
    decks: myDecks,
  };
}

/**
 * Satu deck dari sudut pandang user. Deck yang belum pernah ditambahkan memakai
 * pengaturan bawaan untuk hitungannya; deck yang dilepas memakai pengaturannya
 * yang tersimpan dan kembali dengan pengaturan itu saat ditambahkan lagi.
 */
export async function getDeckForUser(userId: number, slug: string) {
  const deck = await getCatalogDeck(slug);
  if (!deck) return null;

  const [settings, subscription] = await Promise.all([
    getFlashcardSettings(userId),
    prisma.flashcardDeckSubscription.findUnique({
      where: { userId_deckId: { userId, deckId: deck.id } },
      select: { config: true, unsubscribedAt: true },
    }),
  ]);
  const config = subscription
    ? parseFlashcardConfig(subscription.config)
    : FLASHCARD_DEFAULT_CONFIG;

  const now = new Date();
  const { endExclusive: dayEnd } = getFlashcardDayRange(now, settings.day);
  const [today, progress] = await Promise.all([
    countTodayByDeck(userId, [deck.id], settings.day, now),
    countDeckProgress(userId, [deck.id], now, dayEnd),
  ]);
  const allowance = toAllowance(today.get(deck.id), config);

  return {
    deck,
    subscribed: subscription !== null && subscription.unsubscribedAt === null,
    settings,
    config,
    allowance,
    due: toDueCounts(progress.get(deck.id), allowance, config),
  };
}

// ---------------------------------------------------------------------------
// Daftar kata (read-only)
// ---------------------------------------------------------------------------

export const DECK_WORD_STATUSES = ["all", "new", "learning", "review", "suspended"] as const;
export type DeckWordFilter = (typeof DECK_WORD_STATUSES)[number];

type WordRow = {
  id: number;
  level: string;
  word: string;
  wordPlain: string;
  reading: string;
  meaningsId: string[];
  type: FlashcardCardType | null;
  isSuspended: boolean | null;
  buriedUntil: Date | null;
  isLeech: boolean | null;
  due: Date | null;
  intervalDays: number | null;
};

function statusFilter(status: DeckWordFilter) {
  switch (status) {
    case "new":
      return Prisma.sql`AND (c."vocabId" IS NULL OR (c.type = 'NEW' AND NOT c."isSuspended"))`;
    case "learning":
      return Prisma.sql`AND c.type IN ('LEARNING', 'RELEARNING') AND NOT c."isSuspended"`;
    case "review":
      return Prisma.sql`AND c.type = 'REVIEW' AND NOT c."isSuspended"`;
    case "suspended":
      return Prisma.sql`AND c."isSuspended"`;
    default:
      return Prisma.empty;
  }
}

function wordStatus(row: WordRow): DeckWordStatus {
  if (row.isSuspended) return "suspended";
  if (row.type === "REVIEW") return "review";
  if (row.type === "LEARNING" || row.type === "RELEARNING") return "learning";
  return "new";
}

/** Daftar kata satu deck beserta status kartu deck itu (bukan kartu deck lain). */
export async function getDeckWords(
  userId: number,
  deck: Pick<DeckSummary, "id" | "slug">,
  filters: { query: string; status: DeckWordFilter; page: number },
) {
  const now = new Date();
  const query = filters.query.trim().slice(0, 50);
  const pattern = `%${query.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
  const search = query
    ? Prisma.sql`AND (
        v."wordPlain" ILIKE ${pattern} OR v.reading ILIKE ${pattern}
        OR array_to_string(v."meaningsId", ' ') ILIKE ${pattern}
        OR array_to_string(v."meaningsEn", ' ') ILIKE ${pattern}
      )`
    : Prisma.empty;

  const base = Prisma.sql`
    FROM "FlashcardVocab" v
    LEFT JOIN "FlashcardCard" c
      ON c."vocabId" = v.id AND c."userId" = ${userId} AND c."deckId" = ${deck.id}
    WHERE v.tags @> ARRAY[${deck.slug}]::text[] AND v."retiredAt" IS NULL
    ${search}
    ${statusFilter(filters.status)}
  `;

  const page = Math.max(1, filters.page);
  const [rows, totals] = await Promise.all([
    prisma.$queryRaw<WordRow[]>`
      SELECT v.id, v.level::text AS level, v.word, v."wordPlain", v.reading, v."meaningsId",
        c.type, c."isSuspended", c."buriedUntil", c."isLeech", c.due, c."intervalDays"
      ${base}
      ORDER BY v.level ASC, v."order" ASC
      LIMIT ${WORDS_PAGE_SIZE} OFFSET ${(page - 1) * WORDS_PAGE_SIZE}
    `,
    prisma.$queryRaw<{ total: number }[]>`SELECT count(*)::int AS total ${base}`,
  ]);

  const total = totals[0]?.total ?? 0;
  const words: DeckWord[] = rows.map((row) => ({
    vocabId: row.id,
    level: row.level,
    wordPlain: row.wordPlain,
    word: row.word,
    reading: row.reading,
    meaningsId: row.meaningsId,
    status: wordStatus(row),
    isBuried: row.buriedUntil !== null && row.buriedUntil.getTime() > now.getTime(),
    isLeech: row.isLeech ?? false,
    hasCard: row.type !== null,
    due: row.type && row.type !== "NEW" && row.due ? row.due.toISOString() : null,
    intervalDays: row.intervalDays ?? 0,
  }));

  return {
    words,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / WORDS_PAGE_SIZE)),
  };
}

// ---------------------------------------------------------------------------
// Sesi belajar
// ---------------------------------------------------------------------------

type DueRow = {
  vocabId: number;
  type: FlashcardCardType;
  queue: FlashcardCardQueue;
  due: Date;
  intervalDays: number;
  easeFactor: number | null;
  stability: number | null;
  difficulty: number | null;
  lastReviewedAt: Date | null;
  reps: number;
  lapses: number;
  learningStep: number;
};

type NewRow = {
  id: number;
  level: string;
  order: number;
};

function toSchedulerState(candidate: QueueCandidate): SchedulerCardState {
  return {
    type: candidate.type,
    queue: candidate.queue,
    due: candidate.due,
    intervalDays: candidate.intervalDays,
    reps: candidate.reps,
    lapses: candidate.lapses,
    learningStep: candidate.learningStep,
    stability: candidate.stability,
    difficulty: candidate.difficulty,
    desiredRetention: null,
    easeFactor: candidate.easeFactor,
    lastReviewedAt: candidate.lastReviewedAt,
  };
}

/**
 * Catatan pribadi dan jumlah diskusi untuk kata-kata sesi belajar: satu query
 * catatan dan satu groupBy untuk seluruh potongan, bukan per kartu. Isi thread
 * baru diambil saat sheet diskusinya dibuka. `userId` null untuk mode coba,
 * yang hanya menampilkan diskusi publik.
 */
export async function getCardDiscussionData(
  userId: number | null,
  vocabIds: number[],
): Promise<CardDiscussionData | null> {
  if (!FEATURES.flashcardDiscussion) return null;

  const [notes, counts] = await Promise.all([
    userId === null ? new Map<number, OwnNote[]>() : getOwnVocabNotes(userId, vocabIds),
    getVocabDiscussionCounts(vocabIds),
  ]);
  return { notes: Object.fromEntries(notes), counts: Object.fromEntries(counts) };
}

/** Kelompok antrean v3 dipadatkan ke tiga hitungan yang tampil di layar belajar. */
function reviewerKind(entry: QueueEntry): ReviewerCardKind {
  if (entry.group === "new") return "new";
  if (entry.group === "review") return "review";
  return "learning";
}

/**
 * Antrean belajar satu deck, dibangun sekali lalu dikirim ke reviewer client.
 * Kartu learning yang jatuh tempo nanti hari ini ikut dikirim terpisah supaya
 * reviewer bisa menampilkannya tepat waktu dalam sesi yang sama.
 */
export async function getStudySession(userId: number, slug: string) {
  const access = await getDeckForUser(userId, slug);
  if (!access || !access.subscribed) return access ? { deck: access.deck, subscribed: false as const } : null;

  const { deck, config } = access;
  const settings = access.settings;
  const scheduling: DeckSchedulingContext = { config, day: settings.day };
  const now = new Date();
  const { endExclusive: dayEnd } = getFlashcardDayRange(now, settings.day);
  const { endExclusive: tomorrowEnd } = getFlashcardDayRange(dayEnd, settings.day);

  const [dueRows, newRows, tomorrowRows] = await Promise.all([
    prisma.$queryRaw<DueRow[]>`
      SELECT c."vocabId", c.type, c.queue, c.due, c."intervalDays", c."easeFactor",
        c.stability, c.difficulty, c."lastReviewedAt", c.reps, c.lapses, c."learningStep"
      FROM "FlashcardCard" c
      JOIN "FlashcardVocab" v ON v.id = c."vocabId"
      WHERE c."userId" = ${userId} AND c."deckId" = ${deck.id}
        AND v.tags @> ARRAY[${slug}]::text[] AND v."retiredAt" IS NULL
        AND c.queue <> 'NEW' AND c.due < ${utc(dayEnd)} AND ${available(now)}
    `,
    // Kolom ringan saja: deck N3 punya hampir 1.800 kata baru, dan urutan
    // pengambilannya (termasuk acak) harus dihitung dari seluruhnya.
    prisma.$queryRaw<NewRow[]>`
      SELECT v.id, v.level::text AS level, v."order"
      FROM "FlashcardVocab" v
      LEFT JOIN "FlashcardCard" c
        ON c."vocabId" = v.id AND c."userId" = ${userId} AND c."deckId" = ${deck.id}
      WHERE v.tags @> ARRAY[${slug}]::text[] AND v."retiredAt" IS NULL
        AND (c."vocabId" IS NULL OR (c.queue = 'NEW' AND ${available(now)}))
    `,
    // Kartu yang jatuh tempo besok tanpa ikut sesi ini. Kartu yang dijawab di
    // sesi ini ditambahkan reviewer dari hasil jawabannya.
    prisma.$queryRaw<{ total: number }[]>`
      SELECT count(*)::int AS total
      FROM "FlashcardCard" c
      JOIN "FlashcardVocab" v ON v.id = c."vocabId"
      WHERE c."userId" = ${userId} AND c."deckId" = ${deck.id}
        AND v.tags @> ARRAY[${slug}]::text[] AND v."retiredAt" IS NULL
        AND c.queue <> 'NEW' AND NOT c."isSuspended"
        AND c.due >= ${utc(dayEnd)} AND c.due < ${utc(tomorrowEnd)}
    `,
  ]);

  const fresh = createNewCardState(now);
  const candidates: QueueCandidate[] = [
    ...dueRows.map((row) => ({ ...row, position: 0 })),
    ...newRows.map((row) => ({
      vocabId: row.id,
      type: fresh.type,
      queue: fresh.queue,
      due: now,
      position: insertionPosition(config.insertionOrder, userId, row),
      intervalDays: 0,
      easeFactor: null,
      stability: null,
      difficulty: null,
      lastReviewedAt: null,
      reps: 0,
      lapses: 0,
      learningStep: 0,
    })),
  ];

  const built = buildQueue({
    candidates,
    budget: { newLimit: access.allowance.newLeft, reviewLimit: access.allowance.reviewLeft },
    config,
    now,
    day: settings.day,
  });

  const selected = built.queue.slice(0, STUDY_BATCH_SIZE);
  const later = built.laterLearning.slice(0, STUDY_BATCH_SIZE);
  const ids = [...selected, ...later].map((entry) => entry.vocabId);
  const [contentRows, discussion] = await Promise.all([
    prisma.flashcardVocab.findMany({
      where: { id: { in: ids } },
      select: VOCAB_CONTENT_SELECT,
    }),
    getCardDiscussionData(userId, ids),
  ]);
  const contents = new Map(contentRows.map((row) => [row.id, toCardContent(row)]));

  const toReviewerCard = (entry: QueueEntry, shownAt: Date): ReviewerCard | null => {
    const content = contents.get(entry.vocabId);
    if (!content) return null;
    return {
      vocabId: entry.vocabId,
      kind: reviewerKind(entry),
      content,
      previewLabels: buildPreviewLabels(toSchedulerState(entry), shownAt, scheduling),
    };
  };

  const cards = selected
    .map((entry) => toReviewerCard(entry, now))
    .filter((card): card is ReviewerCard => card !== null);
  const pendingLearning = later.flatMap((entry): PendingLearningCard[] => {
    // Interval tombol dihitung untuk saat kartu itu benar-benar tampil.
    const card = toReviewerCard(entry, entry.due);
    return card ? [{ ...card, dueAt: entry.due.toISOString() }] : [];
  });

  // Hitungan di layar belajar mencakup seluruh antrean, bukan hanya potongan
  // yang dikirim, supaya angkanya sama dengan yang tampil di halaman deck.
  const unloadedCounts: StudyCounts = { new: 0, learning: 0, review: 0 };
  for (const entry of [
    ...built.queue.slice(STUDY_BATCH_SIZE),
    ...built.laterLearning.slice(STUDY_BATCH_SIZE),
  ]) {
    unloadedCounts[reviewerKind(entry)] += 1;
  }

  const tomorrow: TomorrowWindow = {
    base: tomorrowRows[0]?.total ?? 0,
    start: dayEnd.toISOString(),
    end: tomorrowEnd.toISOString(),
  };

  return {
    deck,
    subscribed: true as const,
    display: settings.display,
    cards,
    pendingLearning,
    unloadedCounts,
    tomorrow,
    discussion,
    hasMore: built.queue.length > selected.length,
    generatedAt: now.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Halaman diskusi kata
// ---------------------------------------------------------------------------

/**
 * Isi kartu untuk halaman diskusi kata. Kata yang sudah pensiun tetap dapat
 * dibuka supaya catatan dan diskusi lamanya terbaca, tetapi tidak menerima
 * catatan baru (`retired`).
 */
export async function getVocabForDiscussion(vocabId: number) {
  const row = await prisma.flashcardVocab.findUnique({
    where: { id: vocabId },
    select: { ...VOCAB_CONTENT_SELECT, retiredAt: true },
  });
  if (!row) return null;
  return { vocabId: row.id, content: toCardContent(row), retired: row.retiredAt !== null };
}

// ---------------------------------------------------------------------------
// Mode coba (guest)
// ---------------------------------------------------------------------------

export async function getTrySession(slug: string) {
  const deck = await getCatalogDeck(slug);
  if (!deck) return null;

  const rows = await prisma.flashcardVocab.findMany({
    where: { tags: { has: slug }, retiredAt: null },
    orderBy: [{ level: "asc" }, { order: "asc" }],
    take: TRY_CARD_LIMIT,
    select: VOCAB_CONTENT_SELECT,
  });

  return { deck, rows: rows.map((row) => ({ vocabId: row.id, content: toCardContent(row) })) };
}

// ---------------------------------------------------------------------------
// Statistik
// ---------------------------------------------------------------------------

/**
 * Kartu baru (belum pernah dijawab dan tidak di-suspend) di deck yang sedang
 * ditambahkan user, atau di satu deck saja. Dihitung per deck: kata yang ada di
 * dua deck adalah dua kartu baru, sama seperti di antreannya.
 */
export async function countUnstudiedWords(userId: number, deckId?: number): Promise<number> {
  const onlyDeck = deckId === undefined ? Prisma.empty : Prisma.sql`AND s."deckId" = ${deckId}`;
  const rows = await prisma.$queryRaw<{ total: number }[]>`
    SELECT count(*)::int AS total
    FROM "FlashcardDeckSubscription" s
    JOIN "FlashcardDeck" d ON d.id = s."deckId" AND d."isPublished"
    JOIN "FlashcardVocab" v ON v.tags @> ARRAY[d.slug]::text[] AND v."retiredAt" IS NULL
    LEFT JOIN "FlashcardCard" c
      ON c."vocabId" = v.id AND c."userId" = s."userId" AND c."deckId" = s."deckId"
    WHERE s."userId" = ${userId} AND s."unsubscribedAt" IS NULL ${onlyDeck}
      AND (c."vocabId" IS NULL OR (c.type = 'NEW' AND NOT c."isSuspended"))
  `;
  return rows[0]?.total ?? 0;
}

const DECK_STATS_DAYS = 30;
const DECK_FORECAST_DAYS = 7;
const HARDEST_LIMIT = 5;

export type HardWord = {
  vocabId: number;
  wordPlain: string;
  reading: string;
  lapses: number;
  isLeech: boolean;
};

export type DeckStats = {
  wordCount: number;
  maturity: MaturityCounts;
  /** Kartu yang sudah keluar dari status baru dan tidak di-suspend. */
  studied: number;
  /** True retention review kartu matang deck ini, 30 hari terakhir. */
  retention: RetentionSummary;
  reviews30d: number;
  forecast: DailyBucket[];
  /** Lapse terbanyak; hanya kartu yang pernah terlupa. */
  hardest: HardWord[];
};

/**
 * Statistik satu deck untuk halaman deck. Hanya kartu deck ini, untuk kata yang
 * masih termasuk deck dan belum pensiun — sama dengan yang dihitung antreannya.
 */
export async function getDeckStats(
  userId: number,
  deck: Pick<DeckSummary, "id" | "slug" | "wordCount">,
  day: FlashcardDayContext,
): Promise<DeckStats> {
  const now = new Date();
  const { start: todayStart } = getFlashcardDayRange(now, day);
  const since = new Date(todayStart.getTime() - DECK_STATS_DAYS * 86_400_000);
  const inDeck = {
    userId,
    deckId: deck.id,
    vocab: { retiredAt: null, tags: { has: deck.slug } },
  } satisfies Prisma.FlashcardCardWhereInput;

  const [cards, reviews, hardest] = await Promise.all([
    prisma.flashcardCard.findMany({
      where: inDeck,
      select: { type: true, intervalDays: true, isSuspended: true, due: true },
    }),
    prisma.flashcardRevlog.findMany({
      where: { userId, deckId: deck.id, reviewedAt: { gte: since } },
      select: { reviewedAt: true, rating: true, kind: true, takenMs: true },
    }),
    prisma.flashcardCard.findMany({
      where: { ...inDeck, lapses: { gt: 0 } },
      orderBy: [{ lapses: "desc" }, { vocabId: "asc" }],
      take: HARDEST_LIMIT,
      select: {
        vocabId: true,
        lapses: true,
        isLeech: true,
        vocab: { select: { wordPlain: true, reading: true } },
      },
    }),
  ]);

  const maturity = buildMaturity(cards, deck.wordCount - cards.length);
  const scheduled = cards.filter((card) => !card.isSuspended && card.type !== "NEW");

  return {
    wordCount: deck.wordCount,
    maturity,
    studied: maturity.learning + maturity.young + maturity.mature,
    retention: computeTrueRetention(reviews),
    reviews30d: reviews.length,
    forecast: buildForecast(
      scheduled.map((card) => card.due),
      todayStart,
      DECK_FORECAST_DAYS,
    ),
    hardest: hardest.map((card) => ({
      vocabId: card.vocabId,
      wordPlain: card.vocab.wordPlain,
      reading: card.vocab.reading,
      lapses: card.lapses,
      isLeech: card.isLeech,
    })),
  };
}
