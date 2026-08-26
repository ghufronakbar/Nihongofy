"use server";

import { unstable_cache } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { CACHE_KEYS, CACHE_TAGS } from "@/constants/cache-key";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { scheduleFlashcard } from "./lib/scheduler";
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
  if (!session) redirect("/login");

  const decks = await getCachedDecks();
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
  if (!session) redirect("/login");

  const deck = await getCachedDeck(slug);
  if (!deck?.isPublished) notFound();

  const flashcardIds = deck.items.map((item) => item.flashcard.id);
  const progress = await prisma.flashcardProgress.findMany({
    where: { userId: session.userId, flashcardId: { in: flashcardIds } },
    select: {
      flashcardId: true,
      dueAt: true,
      intervalDays: true,
      repetitions: true,
    },
  });
  const progressByCard = new Map(progress.map((item) => [item.flashcardId, item]));
  const now = new Date();

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

  const reviewCards = cards
    .filter((card) => card.isNew || card.isDue)
    .sort((left, right) => {
      if (left.isDue !== right.isDue) return left.isDue ? -1 : 1;
      if (left.dueAt && right.dueAt) return left.dueAt.localeCompare(right.dueAt);
      return left.order - right.order;
    });

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
  };
}

export async function rateFlashcardAction(input: RateFlashcardInput) {
  const session = await getSession();
  if (!session) return { ok: false as const, message: "Sesi berakhir. Silakan masuk lagi." };

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

  const previous = await prisma.flashcardProgress.findUnique({
    where: { userId_flashcardId: { userId: session.userId, flashcardId } },
    select: { intervalDays: true, easeFactor: true, repetitions: true, lapses: true },
  });
  const reviewedAt = new Date();
  const scheduled = scheduleFlashcard({
    rating,
    intervalDays: previous?.intervalDays ?? 0,
    easeFactor: previous?.easeFactor ?? 2.5,
    repetitions: previous?.repetitions ?? 0,
    lapses: previous?.lapses ?? 0,
    reviewedAt,
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
        previousEaseFactor: previous?.easeFactor ?? 2.5,
        nextEaseFactor: scheduled.easeFactor,
        reviewedAt,
        dueAt: scheduled.dueAt,
      },
    }),
  ]);

  return {
    ok: true as const,
    nextDueAt: scheduled.dueAt.toISOString(),
    intervalDays: scheduled.intervalDays,
  };
}
