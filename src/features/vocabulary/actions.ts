"use server";

import { unstable_cache, updateTag } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { CACHE_KEYS, CACHE_TAGS } from "@/constants/cache-key";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { scheduleFlashcard } from "./lib/scheduler";
import { getFlashcardSettingsForUser } from "./lib/settings-data";
import { getJakartaDayStart } from "./lib/settings";
import {
  RateFlashcardSchema,
  UsageExamplesSchema,
  type RateFlashcardInput,
} from "./schemas";

const getCachedDecks = unstable_cache(
  async () =>
    prisma.flashcardDeck.findMany({
      where: { isPublished: true, kind: "VOCABULARY" },
      orderBy: [{ order: "asc" }, { title: "asc" }],
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        jlptLevel: true,
        items: {
          orderBy: { order: "asc" },
          select: { flashcardId: true },
        },
      },
    }),
  CACHE_KEYS.vocabularyDeckList,
  { tags: [CACHE_TAGS.vocabularyDeckList] },
);

export async function getVocabularyDecks() {
  const session = await getSession();
  const decks = await getCachedDecks();

  if (!session) {
    return decks.map((deck) => ({
      id: deck.id,
      slug: deck.slug,
      title: deck.title,
      description: deck.description,
      jlptLevel: deck.jlptLevel,
      cardCount: deck.items.length,
      newCount: deck.items.length,
      dueCount: 0,
    }));
  }

  const flashcardIds = [...new Set(decks.flatMap((deck) => deck.items.map((item) => item.flashcardId)))];
  const progress = await prisma.flashcardProgress.findMany({
    where: { userId: session.userId, flashcardId: { in: flashcardIds } },
    select: { flashcardId: true, dueAt: true },
  });
  const progressByCard = new Map(progress.map((item) => [item.flashcardId, item]));
  const now = new Date();

  return decks.map((deck) => ({
    id: deck.id,
    slug: deck.slug,
    title: deck.title,
    description: deck.description,
    jlptLevel: deck.jlptLevel,
    cardCount: deck.items.length,
    newCount: deck.items.filter((item) => !progressByCard.has(item.flashcardId)).length,
    dueCount: deck.items.filter((item) => {
      const itemProgress = progressByCard.get(item.flashcardId);
      return itemProgress ? itemProgress.dueAt <= now : false;
    }).length,
  }));
}

const getCachedDeck = (slug: string) =>
  unstable_cache(
    async (deckSlug: string) =>
      prisma.flashcardDeck.findUnique({
        where: { slug: deckSlug },
        select: {
          id: true,
          slug: true,
          title: true,
          description: true,
          jlptLevel: true,
          isPublished: true,
          items: {
            orderBy: { order: "asc" },
            select: {
              order: true,
              flashcard: {
                select: {
                  id: true,
                  word: true,
                  reading: true,
                  romaji: true,
                  meaning: true,
                  jlptLevel: true,
                  audioText: true,
                  audioUrl: true,
                  usageExamples: true,
                  tagLinks: {
                    orderBy: { tag: { label: "asc" } },
                    select: { tag: { select: { slug: true, label: true } } },
                  },
                },
              },
            },
          },
        },
      }),
    CACHE_KEYS.vocabularyDeck(slug),
    { tags: [CACHE_TAGS.vocabularyDeck(slug), CACHE_TAGS.vocabularyDeckList] },
  )(slug);

export async function getVocabularyDeck(slug: string) {
  const session = await getSession();
  const deck = await getCachedDeck(slug);
  if (!deck?.isPublished) notFound();

  if (!session) {
    const cards = deck.items.map((item) => {
      const parsedExamples = UsageExamplesSchema.safeParse(item.flashcard.usageExamples);
      return {
        id: item.flashcard.id,
        order: item.order,
        word: item.flashcard.word,
        reading: item.flashcard.reading,
        romaji: item.flashcard.romaji,
        meaning: item.flashcard.meaning,
        jlptLevel: item.flashcard.jlptLevel,
        audioText: item.flashcard.audioText ?? item.flashcard.word,
        audioUrl: item.flashcard.audioUrl,
        usageExamples: parsedExamples.success ? parsedExamples.data : [],
        tags: item.flashcard.tagLinks.map((link) => link.tag),
        isNew: true,
        isDue: false,
        dueAt: null,
        intervalDays: 0,
        repetitions: 0,
      };
    });

    return {
      id: deck.id,
      slug: deck.slug,
      title: deck.title,
      description: deck.description,
      jlptLevel: deck.jlptLevel,
      cards,
      reviewCardIds: cards.map((card) => card.id),
      dueCount: 0,
      newCount: cards.length,
      dailyQueue: {
        remainingReviews: 0,
        remainingNew: cards.length,
        completedReviewsToday: 0,
        completedNewToday: 0,
        limitReached: false,
      },
    };
  }

  const flashcardIds = deck.items.map((item) => item.flashcard.id);
  const now = new Date();
  const dayStart = getJakartaDayStart(now);
  const [progress, settings, completedNewToday, completedReviewsToday] = await Promise.all([
    prisma.flashcardProgress.findMany({
      where: { userId: session.userId, flashcardId: { in: flashcardIds } },
      select: {
        flashcardId: true,
        dueAt: true,
        intervalDays: true,
        repetitions: true,
      },
    }),
    getFlashcardSettingsForUser(session.userId),
    prisma.flashcardReviewLog.count({
      where: { userId: session.userId, wasNew: true, reviewedAt: { gte: dayStart } },
    }),
    prisma.flashcardReviewLog.count({
      where: { userId: session.userId, wasNew: false, reviewedAt: { gte: dayStart } },
    }),
  ]);
  const progressByCard = new Map(progress.map((item) => [item.flashcardId, item]));

  const cards = deck.items.map((item) => {
    const cardProgress = progressByCard.get(item.flashcard.id);
    const parsedExamples = UsageExamplesSchema.safeParse(item.flashcard.usageExamples);

    return {
      id: item.flashcard.id,
      order: item.order,
      word: item.flashcard.word,
      reading: item.flashcard.reading,
      romaji: item.flashcard.romaji,
      meaning: item.flashcard.meaning,
      jlptLevel: item.flashcard.jlptLevel,
      audioText: item.flashcard.audioText ?? item.flashcard.word,
      audioUrl: item.flashcard.audioUrl,
      usageExamples: parsedExamples.success ? parsedExamples.data : [],
      tags: item.flashcard.tagLinks.map((link) => link.tag),
      isNew: !cardProgress,
      isDue: cardProgress ? cardProgress.dueAt <= now : false,
      dueAt: cardProgress?.dueAt.toISOString() ?? null,
      intervalDays: cardProgress?.intervalDays ?? 0,
      repetitions: cardProgress?.repetitions ?? 0,
    };
  });

  const dueCards = cards
    .filter((card) => card.isDue)
    .sort((left, right) => (left.dueAt ?? "").localeCompare(right.dueAt ?? ""));
  const newCards = cards
    .filter((card) => card.isNew)
    .sort((left, right) => left.order - right.order);
  const remainingReviews = Math.max(0, settings.maxReviewsPerDay - completedReviewsToday);
  const remainingNew = Math.max(0, settings.newCardsPerDay - completedNewToday);
  const reviewCards = [
    ...dueCards.slice(0, remainingReviews),
    ...newCards.slice(0, remainingNew),
  ];

  return {
    id: deck.id,
    slug: deck.slug,
    title: deck.title,
    description: deck.description,
    jlptLevel: deck.jlptLevel,
    cards,
    reviewCardIds: reviewCards.map((card) => card.id),
    dueCount: cards.filter((card) => card.isDue).length,
    newCount: cards.filter((card) => card.isNew).length,
    dailyQueue: {
      remainingReviews,
      remainingNew,
      completedReviewsToday,
      completedNewToday,
      limitReached:
        reviewCards.length === 0 &&
        ((dueCards.length > 0 && remainingReviews === 0) ||
          (newCards.length > 0 && remainingNew === 0)),
    },
  };
}

export async function rateFlashcardAction(input: RateFlashcardInput) {
  const session = await getSession();
  if (!session) {
    // Guest mode: do not record in database
    return {
      ok: true as const,
      nextDueAt: new Date().toISOString(),
      intervalDays: 1,
    };
  }

  const validated = RateFlashcardSchema.safeParse(input);
  if (!validated.success) {
    return { ok: false as const, message: "Rating kartu tidak valid." };
  }

  const { flashcardId, deckSlug, rating } = validated.data;
  const membership = await prisma.flashcardDeckItem.findFirst({
    where: {
      flashcardId,
      deck: { slug: deckSlug, isPublished: true, kind: "VOCABULARY" },
    },
    select: { id: true },
  });
  if (!membership) return { ok: false as const, message: "Kartu tidak ditemukan di deck ini." };

  const [previous, settings] = await Promise.all([
    prisma.flashcardProgress.findUnique({
      where: { userId_flashcardId: { userId: session.userId, flashcardId } },
      select: {
        state: true,
        dueAt: true,
        intervalDays: true,
        easeFactor: true,
        repetitions: true,
        lapses: true,
        learningStep: true,
      },
    }),
    getFlashcardSettingsForUser(session.userId),
  ]);
  const reviewedAt = new Date();
  const dayStart = getJakartaDayStart(reviewedAt);

  if (previous && previous.dueAt > reviewedAt) {
    return { ok: false as const, message: "Kartu ini belum jatuh tempo." };
  }

  const completedInBucket = await prisma.flashcardReviewLog.count({
    where: {
      userId: session.userId,
      wasNew: previous === null,
      reviewedAt: { gte: dayStart },
    },
  });
  const dailyLimit = previous ? settings.maxReviewsPerDay : settings.newCardsPerDay;

  if (completedInBucket >= dailyLimit) {
    return {
      ok: false as const,
      message: previous
        ? "Batas review hari ini sudah tercapai."
        : "Batas kartu baru hari ini sudah tercapai.",
    };
  }

  const scheduled = scheduleFlashcard({
    rating,
    state: previous?.state ?? "LEARNING",
    intervalDays: previous?.intervalDays ?? 0,
    easeFactor: previous?.easeFactor ?? settings.startingEaseFactor,
    repetitions: previous?.repetitions ?? 0,
    lapses: previous?.lapses ?? 0,
    learningStep: previous?.learningStep ?? 0,
    reviewedAt,
    settings,
  });

  await prisma.$transaction([
    prisma.flashcardProgress.upsert({
      where: { userId_flashcardId: { userId: session.userId, flashcardId } },
      create: {
        userId: session.userId,
        flashcardId,
        ...scheduled,
        lastReviewedAt: reviewedAt,
      },
      update: { ...scheduled, lastReviewedAt: reviewedAt },
    }),
    prisma.flashcardReviewLog.create({
      data: {
        userId: session.userId,
        flashcardId,
        rating,
        previousInterval: previous?.intervalDays ?? 0,
        scheduledInterval: scheduled.intervalDays,
        previousEaseFactor: previous?.easeFactor ?? settings.startingEaseFactor,
        nextEaseFactor: scheduled.easeFactor,
        wasNew: previous === null,
        reviewedAt,
        dueAt: scheduled.dueAt,
      },
    }),
  ]);

  updateTag(CACHE_TAGS.profileOverview(session.userId));

  return {
    ok: true as const,
    nextDueAt: scheduled.dueAt.toISOString(),
    intervalDays: scheduled.intervalDays,
  };
}
