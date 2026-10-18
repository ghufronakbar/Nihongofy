import { Prisma, PrismaClient } from "@prisma/client";
import { compileDictionary } from "./kana-race-dictionary";

const db = new PrismaClient();
async function main() {
try {
  const release = await compileDictionary();
  if (!process.argv.includes("--validate-only")) {
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(186109, 1)::text`;
      await tx.kanaWord.createMany({ data: release.dictionary.guesses.map((kana) => ({ kana, length: kana.length })), skipDuplicates: true });
      await tx.kanaWord.updateMany({ data: { allowGuess: false, allowAnswer: false, retiredAt: new Date() } });
      await tx.kanaWord.updateMany({ where: { kana: { in: release.dictionary.guesses } }, data: { allowGuess: true, retiredAt: null } });
      for (const answer of release.dictionary.answers) await tx.kanaWord.update({ where: { kana: answer.kana }, data: { allowAnswer: true, category: answer.category } });
      const words = await tx.kanaWord.findMany({ select: { id: true, kana: true } });
      const vocabs = await tx.flashcardVocab.findMany({ select: { id: true, key: true } });
      const vocabIds = new Map(vocabs.map((row) => [row.key, row.id]));
      const sources = words.flatMap((word) => (release.words.get(word.kana) ?? []).map((source) => ({ wordId: word.id, sourceKey: source.key, vocabId: vocabIds.get(source.key) ?? null })));
      await tx.kanaWordSource.deleteMany();
      await tx.kanaWordSource.createMany({ data: sources, skipDuplicates: true });
      await tx.kanaRaceDictionary.upsert({ where: { id: release.id }, create: { id: release.id, payload: release.dictionary as Prisma.InputJsonObject }, update: {} });
    }, { timeout: 60_000 });
  }
  console.log(JSON.stringify({ mode: process.argv.includes("--validate-only") ? "validate" : "seed", release: release.id, counts: release.counts }));
} finally { await db.$disconnect(); }
}
void main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
