import "server-only";
import { cache } from "react";
import { Prisma, type FlashcardCardQueue, type FlashcardCardType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getFlashcardSettings, type FlashcardSettings } from "./lib/collection";
import {
  buildQueue,
  insertionPosition,
  LEARN_AHEAD_MS,
  type QueueCandidate,
  type QueueEntry,
} from "./lib/queue";
import { formatIntervalLabel } from "./lib/preview-interval";
import { createNewCardState, previewSchedule, type SchedulerCardState } from "./lib/scheduler";
import { getFlashcardDayRange } from "./lib/scheduler/day";
import { FLASHCARD_RATINGS } from "./lib/scheduler/types";
import { describeTags, FLASHCARD_DECK_MIN_NOTES } from "./taxonomy";
import type {
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
 * Query flashcard. Satu kata = satu kartu per user, dan deck hanyalah tag:
 * kata termasuk deck bila `FlashcardVocab.tags` memuat slug deck itu. Karena
 * itu hampir semua hitungan ditulis sebagai SQL mentah — relasi "deck memuat
 * kata" tidak bisa diekspresikan Prisma tanpa memuat seluruh katalog ke memori.
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
  settings: Pick<FlashcardSettings, "config" | "day">,
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

/** Sisa jatah hari ini. Batas berlaku untuk semua deck sekaligus. */
async function getDailyAllowance(
  userId: number,
  settings: FlashcardSettings,
  now: Date,
): Promise<DailyAllowance> {
  const { start, endExclusive } = getFlashcardDayRange(now, settings.day);
  const today = { gte: start, lt: endExclusive };
  const [newStudiedToday, reviewsToday] = await Promise.all([
    prisma.flashcardRevlog.count({ where: { userId, wasNew: true, reviewedAt: today } }),
    prisma.flashcardRevlog.count({ where: { userId, kind: "REVIEW", reviewedAt: today } }),
  ]);

  return {
    newStudiedToday,
    reviewsToday,
    newLeft: Math.max(0, settings.config.newCardsPerDay - newStudiedToday),
    reviewLeft: Math.max(0, settings.config.maxReviewsPerDay - reviewsToday),
  };
}

type ProgressRow = {
  slug: string;
  newCount: number;
  learningNow: number;
  learningLater: number;
  reviewCount: number;
};

async function countDeckProgress(userId: number, slugs: string[], now: Date, dayEnd: Date) {
  if (slugs.length === 0) return new Map<string, ProgressRow>();

  const cutoff = new Date(now.getTime() + LEARN_AHEAD_MS);
  const rows = await prisma.$queryRaw<ProgressRow[]>`
    SELECT d.slug,
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
    LEFT JOIN "FlashcardCard" c ON c."vocabId" = v.id AND c."userId" = ${userId}
    WHERE d.slug = ANY(${slugs}::text[])
    GROUP BY d.slug
  `;
  return new Map(rows.map((row) => [row.slug, row]));
}

/** Hitungan yang ditampilkan: kartu jatuh tempo dipotong sisa jatah hari ini. */
function toDueCounts(
  progress: ProgressRow | undefined,
  allowance: DailyAllowance,
  settings: FlashcardSettings,
): DeckDueCounts {
  const reviewCount = Math.min(progress?.reviewCount ?? 0, allowance.reviewLeft);
  const newCap = settings.config.newCardsIgnoreReviewLimit
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

export type MyDeck = DeckSummary & { due: DeckDueCounts };

export async function getMyDecks(userId: number) {
  const [settings, catalog, subscriptions] = await Promise.all([
    getFlashcardSettings(userId),
    getDeckCatalog(),
    prisma.flashcardDeckSubscription.findMany({
      where: { userId },
      select: { deckId: true },
    }),
  ]);

  const subscribed = new Set(subscriptions.map((row) => row.deckId));
  const decks = catalog.filter((deck) => subscribed.has(deck.id));

  const now = new Date();
  const { endExclusive: dayEnd } = getFlashcardDayRange(now, settings.day);
  const [allowance, progress] = await Promise.all([
    getDailyAllowance(userId, settings, now),
    countDeckProgress(userId, decks.map((deck) => deck.slug), now, dayEnd),
  ]);

  return {
    settings,
    allowance,
    subscribedIds: subscribed,
    decks: decks.map(
      (deck): MyDeck => ({ ...deck, due: toDueCounts(progress.get(deck.slug), allowance, settings) }),
    ),
  };
}

export async function getDeckForUser(userId: number, slug: string) {
  const deck = await getCatalogDeck(slug);
  if (!deck) return null;

  const [settings, subscription] = await Promise.all([
    getFlashcardSettings(userId),
    prisma.flashcardDeckSubscription.findUnique({
      where: { userId_deckId: { userId, deckId: deck.id } },
      select: { createdAt: true },
    }),
  ]);

  const now = new Date();
  const { endExclusive: dayEnd } = getFlashcardDayRange(now, settings.day);
  const [allowance, progress] = await Promise.all([
    getDailyAllowance(userId, settings, now),
    countDeckProgress(userId, [deck.slug], now, dayEnd),
  ]);

  return {
    deck,
    subscribed: subscription !== null,
    allowance,
    due: toDueCounts(progress.get(deck.slug), allowance, settings),
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

export async function getDeckWords(
  userId: number,
  slug: string,
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
    LEFT JOIN "FlashcardCard" c ON c."vocabId" = v.id AND c."userId" = ${userId}
    WHERE v.tags @> ARRAY[${slug}]::text[] AND v."retiredAt" IS NULL
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

  const settings = await getFlashcardSettings(userId);
  const now = new Date();
  const { endExclusive: dayEnd } = getFlashcardDayRange(now, settings.day);
  const { endExclusive: tomorrowEnd } = getFlashcardDayRange(dayEnd, settings.day);

  const [dueRows, newRows, tomorrowRows] = await Promise.all([
    prisma.$queryRaw<DueRow[]>`
      SELECT c."vocabId", c.type, c.queue, c.due, c."intervalDays", c."easeFactor",
        c.stability, c.difficulty, c."lastReviewedAt", c.reps, c.lapses, c."learningStep"
      FROM "FlashcardCard" c
      JOIN "FlashcardVocab" v ON v.id = c."vocabId"
      WHERE c."userId" = ${userId}
        AND v.tags @> ARRAY[${slug}]::text[] AND v."retiredAt" IS NULL
        AND c.queue <> 'NEW' AND c.due < ${utc(dayEnd)} AND ${available(now)}
    `,
    // Kolom ringan saja: deck N3 punya hampir 1.800 kata baru, dan urutan
    // pengambilannya (termasuk acak) harus dihitung dari seluruhnya.
    prisma.$queryRaw<NewRow[]>`
      SELECT v.id, v.level::text AS level, v."order"
      FROM "FlashcardVocab" v
      LEFT JOIN "FlashcardCard" c ON c."vocabId" = v.id AND c."userId" = ${userId}
      WHERE v.tags @> ARRAY[${slug}]::text[] AND v."retiredAt" IS NULL
        AND (c."vocabId" IS NULL OR (c.queue = 'NEW' AND ${available(now)}))
    `,
    // Kartu yang jatuh tempo besok tanpa ikut sesi ini. Kartu yang dijawab di
    // sesi ini ditambahkan reviewer dari hasil jawabannya.
    prisma.$queryRaw<{ total: number }[]>`
      SELECT count(*)::int AS total
      FROM "FlashcardCard" c
      JOIN "FlashcardVocab" v ON v.id = c."vocabId"
      WHERE c."userId" = ${userId}
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
      position: insertionPosition(settings.config.insertionOrder, userId, row),
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
    config: settings.config,
    now,
    day: settings.day,
  });

  const selected = built.queue.slice(0, STUDY_BATCH_SIZE);
  const later = built.laterLearning.slice(0, STUDY_BATCH_SIZE);
  const ids = [...selected, ...later].map((entry) => entry.vocabId);
  const contents = new Map(
    (
      await prisma.flashcardVocab.findMany({
        where: { id: { in: ids } },
        select: VOCAB_CONTENT_SELECT,
      })
    ).map((row) => [row.id, toCardContent(row)]),
  );

  const toReviewerCard = (entry: QueueEntry, shownAt: Date): ReviewerCard | null => {
    const content = contents.get(entry.vocabId);
    if (!content) return null;
    return {
      vocabId: entry.vocabId,
      kind: reviewerKind(entry),
      content,
      previewLabels: buildPreviewLabels(toSchedulerState(entry), shownAt, settings),
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
    deck: access.deck,
    subscribed: true as const,
    display: settings.display,
    cards,
    pendingLearning,
    unloadedCounts,
    tomorrow,
    hasMore: built.queue.length > selected.length,
  };
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
 * Kata di deck-deck milik user yang belum pernah dipelajari. Dihitung unik:
 * kata yang ada di dua deck langganan hanya dihitung sekali.
 */
export async function countUnstudiedWords(userId: number): Promise<number> {
  const rows = await prisma.$queryRaw<{ total: number }[]>`
    SELECT count(DISTINCT v.id)::int AS total
    FROM "FlashcardDeckSubscription" s
    JOIN "FlashcardDeck" d ON d.id = s."deckId" AND d."isPublished"
    JOIN "FlashcardVocab" v ON v.tags @> ARRAY[d.slug]::text[] AND v."retiredAt" IS NULL
    LEFT JOIN "FlashcardCard" c ON c."vocabId" = v.id AND c."userId" = ${userId}
    WHERE s."userId" = ${userId} AND (c."vocabId" IS NULL OR c.type = 'NEW')
  `;
  return rows[0]?.total ?? 0;
}
