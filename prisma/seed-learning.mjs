import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const vocabFile = fileURLToPath(
  new URL("../src/features/vocabulary/data/vocabulary-seed.json", import.meta.url),
);

const deckDefinitions = [
  {
    slug: "n5-core",
    title: "Fondasi N5",
    description: "Kosakata inti N5 untuk membangun ritme belajar harian.",
    jlptLevel: "N5",
    order: 1,
    includes: (card) => card.jlptLevel === "N5",
  },
  {
    slug: "kata-kerja-n5",
    title: "Kata Kerja N5",
    description: "Kata kerja dasar yang sering muncul dalam kalimat sehari-hari.",
    jlptLevel: "N5",
    order: 2,
    includes: (card) => card.jlptLevel === "N5" && card.tags.includes("Kata kerja"),
  },
  {
    slug: "kata-sifat-n5",
    title: "Kata Sifat N5",
    description: "Latih kata sifat dasar untuk menggambarkan benda dan pengalaman.",
    jlptLevel: "N5",
    order: 3,
    includes: (card) => card.jlptLevel === "N5" && card.tags.includes("Kata sifat"),
  },
  {
    slug: "sehari-hari-n5",
    title: "Sehari-hari",
    description: "Kosakata yang dekat dengan sekolah, rumah, teman, dan rutinitas.",
    jlptLevel: "N5",
    order: 4,
    includes: (card) => card.jlptLevel === "N5" && card.tags.includes("Sehari-hari"),
  },
  {
    slug: "perjalanan-n5",
    title: "Perjalanan",
    description: "Kata-kata dasar untuk bergerak, pulang, dan bepergian.",
    jlptLevel: "N5",
    order: 5,
    includes: (card) => card.tags.includes("Perjalanan"),
  },
  {
    slug: "bisnis-dasar-n4",
    title: "Bisnis Dasar",
    description: "Kosakata awal untuk lingkungan kerja dan rapat.",
    jlptLevel: "N4",
    order: 6,
    includes: (card) => card.tags.includes("Bisnis"),
  },
];

function slugify(value) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function main() {
  const cards = JSON.parse(await readFile(vocabFile, "utf8"));

  for (const card of cards) {
    await prisma.flashcard.upsert({
      where: { key: card.key },
      update: {
        word: card.word,
        reading: card.reading,
        romaji: card.romaji,
        meaning: card.meaning,
        jlptLevel: card.jlptLevel,
        audioText: card.word,
        usageExamples: card.usages,
      },
      create: {
        key: card.key,
        word: card.word,
        reading: card.reading,
        romaji: card.romaji,
        meaning: card.meaning,
        jlptLevel: card.jlptLevel,
        audioText: card.word,
        usageExamples: card.usages,
      },
    });
  }

  const storedCards = await prisma.flashcard.findMany({
    where: { key: { in: cards.map((card) => card.key) } },
    select: { id: true, key: true },
  });
  const cardIdByKey = new Map(storedCards.map((card) => [card.key, card.id]));

  const tags = [...new Set(cards.flatMap((card) => card.tags))];
  for (const label of tags) {
    await prisma.flashcardTag.upsert({
      where: { slug: slugify(label) },
      update: { label },
      create: { slug: slugify(label), label },
    });
  }

  const storedTags = await prisma.flashcardTag.findMany({
    where: { slug: { in: tags.map(slugify) } },
    select: { id: true, slug: true },
  });
  const tagIdBySlug = new Map(storedTags.map((tag) => [tag.slug, tag.id]));

  await prisma.flashcardTagLink.deleteMany({
    where: { flashcardId: { in: storedCards.map((card) => card.id) } },
  });
  await prisma.flashcardTagLink.createMany({
    data: cards.flatMap((card) =>
      card.tags.map((label) => ({
        flashcardId: cardIdByKey.get(card.key),
        tagId: tagIdBySlug.get(slugify(label)),
      })),
    ),
  });

  for (const definition of deckDefinitions) {
    const deck = await prisma.flashcardDeck.upsert({
      where: { slug: definition.slug },
      update: {
        title: definition.title,
        description: definition.description,
        jlptLevel: definition.jlptLevel,
        isPublished: true,
        order: definition.order,
      },
      create: {
        slug: definition.slug,
        title: definition.title,
        description: definition.description,
        jlptLevel: definition.jlptLevel,
        isPublished: true,
        order: definition.order,
      },
      select: { id: true },
    });

    const includedCards = cards.filter(definition.includes);
    await prisma.flashcardDeckItem.deleteMany({ where: { deckId: deck.id } });
    await prisma.flashcardDeckItem.createMany({
      data: includedCards.map((card, index) => ({
        deckId: deck.id,
        flashcardId: cardIdByKey.get(card.key),
        order: index + 1,
      })),
    });
  }

  console.info(
    `[seed:learning] ${cards.length} kartu, ${deckDefinitions.length} deck, ${tags.length} tag siap.`,
  );
}

main()
  .catch((error) => {
    console.error("[seed:learning] gagal", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
