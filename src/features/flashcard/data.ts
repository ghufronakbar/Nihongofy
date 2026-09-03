import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import {
  buildDeckTree,
  collectSubtreeDeckIds,
  deckAncestorNames,
  flattenDeckTree,
  isDeckInSubtree,
  type DeckTreeNode,
} from "./lib/deck-tree";
import {
  budgetFromAncestors,
  buildQueue,
  computeDeckBudgets,
  UNLIMITED_BUDGET,
  type DeckLimitNode,
  type QueueCandidate,
} from "./lib/queue";
import { dayContextOf, ensureCollection, ensureDefaultPreset } from "./lib/collection";
import { renderCard } from "./lib/render/card-content";
import { getFlashcardDayRange } from "./lib/scheduler/day";
import { parsePresetConfig, type FlashcardPresetConfig } from "./schemas";

export type FlashcardDeckSummary = {
  id: number;
  name: string;
  description: string;
  presetId: number;
  presetName: string;
  sourceKind: "SYSTEM" | "IMPORTED" | "MANUAL";
  /** Hitungan untuk deck ini saja; roll-up subtree dilakukan di UI lewat pohon. */
  newCount: number;
  learningCount: number;
  reviewCount: number;
};

/**
 * Semua deck user beserta preset dan hitungan due-nya.
 *
 * Sengaja satu query agregat, bukan per deck: jumlah deck bisa ratusan setelah
 * import, dan N+1 di sini akan langsung terasa.
 */
export const getDeckOverview = cache(async (userId: number) => {
  const collection = await ensureCollection(userId);
  await ensureDefaultPreset(userId);

  const day = dayContextOf(collection);
  const now = new Date();
  const { start: dayStart, endExclusive: dayEnd } = getFlashcardDayRange(now, day);

  const [decks, cardCounts, studiedToday] = await Promise.all([
    prisma.flashcardDeck.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        description: true,
        presetId: true,
        sourceKind: true,
        preset: { select: { name: true, config: true } },
      },
    }),
    prisma.flashcardCard.groupBy({
      by: ["deckId", "queue"],
      where: {
        userId,
        OR: [{ queue: "NEW" }, { due: { lt: dayEnd } }],
      },
      _count: { _all: true },
    }),
    prisma.flashcardRevlog.groupBy({
      by: ["deckId", "kind"],
      where: { userId, reviewedAt: { gte: dayStart, lt: dayEnd } },
      _count: { _all: true },
    }),
  ]);

  const countOf = (deckId: number, queues: string[]) =>
    cardCounts
      .filter((row) => row.deckId === deckId && queues.includes(row.queue))
      .reduce((total, row) => total + row._count._all, 0);

  const summaries: FlashcardDeckSummary[] = decks.map((deck) => ({
    id: deck.id,
    name: deck.name,
    description: deck.description,
    presetId: deck.presetId,
    presetName: deck.preset.name,
    sourceKind: deck.sourceKind,
    newCount: countOf(deck.id, ["NEW"]),
    learningCount: countOf(deck.id, ["LEARNING", "DAY_LEARN"]),
    reviewCount: countOf(deck.id, ["REVIEW"]),
  }));

  const configByDeck = new Map<number, FlashcardPresetConfig>(
    decks.map((deck) => [deck.id, parsePresetConfig(deck.preset.config)]),
  );

  // `LEARN` tidak dihitung sebagai "kartu baru hari ini" — satu kartu baru bisa
  // menghasilkan beberapa revlog LEARN saat melewati learning steps.
  const studiedNewByDeck = new Map<number, number>();
  const studiedReviewByDeck = new Map<number, number>();
  for (const row of studiedToday) {
    const target = row.kind === "REVIEW" ? studiedReviewByDeck : studiedNewByDeck;
    if (row.kind === "RELEARN" || row.kind === "LEARN" || row.kind === "REVIEW") {
      target.set(row.deckId, (target.get(row.deckId) ?? 0) + row._count._all);
    }
  }

  return {
    collection,
    day,
    now,
    decks: summaries,
    tree: buildDeckTree(summaries),
    configByDeck,
    studiedNewByDeck,
    studiedReviewByDeck,
  };
});

export type DeckOverview = Awaited<ReturnType<typeof getDeckOverview>>;

/** Hitungan deck termasuk seluruh subdeck-nya, seperti yang ditampilkan Anki. */
export function rollUpCounts(node: DeckTreeNode<FlashcardDeckSummary>) {
  return flattenDeckTree([node]).reduce(
    (total, current) => ({
      newCount: total.newCount + current.deck.newCount,
      learningCount: total.learningCount + current.deck.learningCount,
      reviewCount: total.reviewCount + current.deck.reviewCount,
    }),
    { newCount: 0, learningCount: 0, reviewCount: 0 },
  );
}

function toLimitTree(
  overview: DeckOverview,
  rootName: string,
): DeckLimitNode | null {
  const subtree = overview.decks.filter((deck) => isDeckInSubtree(deck.name, rootName));
  const nodes = new Map<number, DeckLimitNode>(
    subtree.map((deck) => [
      deck.id,
      {
        deckId: deck.id,
        config: overview.configByDeck.get(deck.id)!,
        studiedNewToday: overview.studiedNewByDeck.get(deck.id) ?? 0,
        studiedReviewsToday: overview.studiedReviewByDeck.get(deck.id) ?? 0,
        children: [],
      },
    ]),
  );

  const byName = new Map(subtree.map((deck) => [deck.name, deck]));
  let root: DeckLimitNode | null = null;

  for (const deck of subtree) {
    const node = nodes.get(deck.id)!;
    if (deck.name === rootName) {
      root = node;
      continue;
    }
    const parentName = deck.name.slice(0, deck.name.lastIndexOf("::"));
    const parent = byName.get(parentName);
    // Deck yatim digantung langsung ke root supaya kartunya tetap bisa dipelajari.
    const parentNode = parent ? nodes.get(parent.id) : nodes.get(byName.get(rootName)!.id);
    parentNode?.children.push(node);
  }

  return root;
}

export type StudyCard = {
  cardId: string;
  noteId: string;
  deckId: number;
  deckName: string;
  ord: number;
  content: ReturnType<typeof renderCard>;
  state: QueueCandidate;
};

/**
 * Antrean belajar untuk satu deck beserta subdeck-nya.
 *
 * Dibangun sekali lalu dikirim utuh ke reviewer client. Modul lama membangun
 * queue saat server render per kartu, sehingga kartu ber-rating `Again` tidak
 * pernah kembali tanpa reload.
 */
export async function getStudyQueue(userId: number, deckId: number) {
  const overview = await getDeckOverview(userId);
  const deck = overview.decks.find((item) => item.id === deckId);
  if (!deck) return null;

  const subtreeIds = collectSubtreeDeckIds(overview.decks, deck.name);
  const config = overview.configByDeck.get(deck.id)!;

  const limitRoot = toLimitTree(overview, deck.name);
  if (!limitRoot) return null;

  const ancestorBudget = config.limitsStartFromTop
    ? budgetFromAncestors(
        deckAncestorNames(deck.name)
          .map((name) => overview.decks.find((item) => item.name === name))
          .filter((item): item is FlashcardDeckSummary => item !== undefined)
          .map((item) => ({
            config: overview.configByDeck.get(item.id)!,
            studiedNewToday: overview.studiedNewByDeck.get(item.id) ?? 0,
            studiedReviewsToday: overview.studiedReviewByDeck.get(item.id) ?? 0,
          })),
      )
    : UNLIMITED_BUDGET;

  const plan = computeDeckBudgets(limitRoot, ancestorBudget);

  const { endExclusive: dayEnd } = getFlashcardDayRange(overview.now, overview.day);
  const rows = await prisma.flashcardCard.findMany({
    where: {
      userId,
      deckId: { in: subtreeIds },
      queue: { notIn: ["SUSPENDED", "BURIED_USER", "BURIED_SIBLING"] },
      OR: [{ queue: "NEW" }, { due: { lt: dayEnd } }],
    },
    select: {
      id: true,
      noteId: true,
      deckId: true,
      ord: true,
      type: true,
      queue: true,
      due: true,
      position: true,
      intervalDays: true,
      easeFactor: true,
      stability: true,
      difficulty: true,
      lastReviewedAt: true,
      reps: true,
      lapses: true,
      learningStep: true,
      note: { select: { noteType: true, fields: true } },
      deck: { select: { name: true } },
    },
    // Batas aman: queue harian tidak akan sebesar ini, tapi deck hasil import
    // bisa berisi puluhan ribu kartu baru.
    take: 2_000,
  });

  const candidates: QueueCandidate[] = rows.map((row) => ({
    cardId: row.id.toString(),
    noteId: row.noteId.toString(),
    deckId: row.deckId,
    ord: row.ord,
    type: row.type,
    queue: row.queue,
    due: row.due,
    position: row.position,
    intervalDays: row.intervalDays,
    easeFactor: row.easeFactor,
    stability: row.stability,
    difficulty: row.difficulty,
    lastReviewedAt: row.lastReviewedAt,
    reps: row.reps,
    lapses: row.lapses,
    learningStep: row.learningStep,
  }));

  const deckOrder = new Map(
    overview.decks
      .filter((item) => subtreeIds.includes(item.id))
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((item, index) => [item.id, index] as const),
  );

  const built = buildQueue({
    candidates,
    plan,
    config,
    now: overview.now,
    day: overview.day,
    deckOrder,
  });

  const rowById = new Map(rows.map((row) => [row.id.toString(), row]));
  const cards: StudyCard[] = built.queue.map((entry) => {
    const row = rowById.get(entry.cardId)!;
    return {
      cardId: entry.cardId,
      noteId: entry.noteId,
      deckId: entry.deckId,
      deckName: row.deck.name,
      ord: entry.ord,
      content: renderCard(row.note.noteType, row.note.fields, entry.ord),
      state: entry,
    };
  });

  return {
    deck,
    config,
    day: overview.day,
    counts: built.counts,
    buriedCardIds: built.buried.map((entry) => entry.cardId),
    cards,
  };
}

export type StudyQueue = NonNullable<Awaited<ReturnType<typeof getStudyQueue>>>;
