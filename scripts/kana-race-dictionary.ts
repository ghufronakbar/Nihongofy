import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import { DictionarySchema } from "../src/features/kana-word-race/contracts";
import { isGameKana, normalizeKana } from "../src/features/kana-word-race/domain/kana";
import { readingFromMarkup, stripJapaneseMarkup } from "../prisma/japanese-markup-check.mjs";

const contentSchema = z.object({ word: z.string(), meaningsId: z.array(z.string()).min(1), tags: z.array(z.string()) });
const fixtureSchema = z.object({ level: z.string(), notes: z.array(z.object({
  key: z.string(), readingUncertain: z.boolean(), content: contentSchema.nullable(),
  ai: z.object({ doubt: z.string().nullable() }).nullable(),
})) });
const curationSchema = z.object({ version: z.literal(1), answers: z.record(z.string(), z.string()), excludedAnswers: z.record(z.string(), z.string()) });
export const dictionaryPath = resolve("src/kana-race-data/dictionary.v1.json");

export async function compileDictionary() {
  const curation = curationSchema.parse(JSON.parse(await readFile(resolve("src/kana-race-data/curation.json"), "utf8")));
  const words = new Map<string, Array<{ key: string; word: string; meaning: string; level: string }>>();
  let excluded = 0;
  for (const level of ["n5", "n4", "n3", "n2", "n1"]) {
    const fixture = fixtureSchema.parse(JSON.parse(await readFile(resolve(`src/flashcard-data/vocab/${level}.json`), "utf8")));
    for (const note of fixture.notes) {
      if (!note.content || note.readingUncertain || note.ai?.doubt) { excluded++; continue; }
      const kana = normalizeKana(readingFromMarkup(note.content.word));
      if (kana.length < 3 || kana.length > 7 || !isGameKana(kana)) { excluded++; continue; }
      const sources = words.get(kana) ?? [];
      sources.push({ key: note.key, word: stripJapaneseMarkup(note.content.word), meaning: note.content.meaningsId[0]!, level: fixture.level });
      words.set(kana, sources);
    }
  }
  const answers = Object.entries(curation.answers).map(([kana, category]) => {
    const sources = words.get(kana);
    if (curation.excludedAnswers[kana] || !sources || normalizeKana(kana) !== kana) throw new Error(`Invalid curated target: ${kana}`);
    return { kana, category, sources };
  }).sort((a, b) => a.kana.localeCompare(b.kana, "ja"));
  const dictionary = DictionarySchema.parse({ version: 1, guesses: [...words.keys()].sort(), answers });
  const payload = JSON.stringify(dictionary);
  const id = createHash("sha256").update(payload).digest("hex");
  const counts = Object.fromEntries([3,4,5,6,7].map((n) => [n, { guesses: dictionary.guesses.filter((word) => word.length === n).length, answers: answers.filter((word) => word.kana.length === n).length }]));
  if (Object.values(counts).some((count) => count.answers < 10)) throw new Error("Each length needs at least ten curated targets.");
  return { id, dictionary, words, counts, excluded };
}

async function main() {
  const result = await compileDictionary();
  if (process.argv.includes("--write")) await writeFile(dictionaryPath, JSON.stringify({ id: result.id, ...result.dictionary }) + "\n");
  if (process.argv.includes("--check")) {
    const saved: unknown = JSON.parse(await readFile(dictionaryPath, "utf8"));
    const parsed = DictionarySchema.extend({ id: z.string() }).parse(saved);
    if (parsed.id !== result.id || JSON.stringify(DictionarySchema.parse(parsed)) !== JSON.stringify(result.dictionary)) throw new Error("Dictionary changed. Rebuild and review the release.");
  }
  console.log(JSON.stringify({ release: result.id, counts: result.counts, excluded: result.excluded }, null, 2));
}
if (process.argv[1]?.endsWith("kana-race-dictionary.ts")) void main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
