import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { REPORT_TARGET_LABEL_MAX_LENGTH } from "../constants";
import {
  FLASHCARD_SEED_COMMANDS,
  flashcardCategoryNote,
  flashcardFixtureFile,
  flashcardRegenerateCommand,
  flashcardReportLabel,
  shellQuote,
} from "./flashcard-target";

const ROOT = new URL("../../../../", import.meta.url);
const read = (path: string) => readFileSync(fileURLToPath(new URL(path, ROOT)), "utf8");

describe("label snapshot laporan kartu", () => {
  it("memuat level dan key utuh", () => {
    expect(flashcardReportLabel({ key: "食事|しょくじ", level: "N5" })).toBe(
      "Flashcard · N5 · 食事|しょくじ",
    );
  });

  it("muat di kolom targetLabel untuk key terpanjang", () => {
    // FlashcardVocab.key VARCHAR(160): key tidak pernah terpotong, karena key
    // itulah yang menunjuk entri fixture bila FK-nya kelak menjadi NULL.
    const label = flashcardReportLabel({ key: "あ".repeat(160), level: "N1" });
    expect(label.length).toBeLessThanOrEqual(REPORT_TARGET_LABEL_MAX_LENGTH);
  });
});

describe("petunjuk perbaikan di admin", () => {
  it.each(["N5", "N4", "N3", "N2", "N1"])("fixture %s benar-benar ada", (level) => {
    const file = flashcardFixtureFile(level);
    expect(file).toBe(`src/flashcard-data/vocab/${level.toLowerCase()}.json`);
    expect(existsSync(fileURLToPath(new URL(file, ROOT)))).toBe(true);
  });

  it("perintah generate ulang memakai --key dan --overwrite", () => {
    expect(flashcardRegenerateCommand("食事|しょくじ")).toBe(
      'npm run gen:flashcard -- --key "食事|しょくじ" --overwrite',
    );
  });

  it("key dikutip ganda seperti di docs, kecuali memuat karakter shell", () => {
    expect(shellQuote("〜月|〜がつ")).toBe('"〜月|〜がつ"');
    expect(shellQuote('say "hi"|せい')).toBe(`'say "hi"|せい'`);
    expect(shellQuote("$HOME|ほーむ")).toBe("'$HOME|ほーむ'");
    expect(shellQuote("it's $1|いっつ")).toBe(`'it'\\''s $1|いっつ'`);
  });

  it("bacaan yang keliru diarahkan ke peninjau kata ragu, bukan generate ulang", () => {
    const note = flashcardCategoryNote("READING_ERROR", "食事|しょくじ");
    expect(note?.commands).toEqual([
      'npm run fix:flashcard-doubts -- --key "食事|しょくじ"',
      "npm run fix:flashcard-doubts -- --apply",
    ]);
    expect(note?.text).toContain("ai.doubt");
  });

  it("kategori lain cukup dengan langkah umum", () => {
    expect(flashcardCategoryNote("MEANING_ERROR", "食事|しょくじ")).toBeNull();
    expect(flashcardCategoryNote("EXAMPLE_ERROR", "食事|しょくじ")).toBeNull();
    expect(flashcardCategoryNote("TAG_ERROR", "食事|しょくじ")?.commands).toEqual([]);
  });

  // Petunjuk yang menyebut script atau flag yang sudah berganti nama lebih buruk
  // daripada tanpa petunjuk sama sekali.
  it("hanya menyebut script npm dan flag yang benar-benar ada", () => {
    const scripts = (JSON.parse(read("package.json")) as { scripts: Record<string, string> })
      .scripts;
    const commands = [
      flashcardRegenerateCommand("食事|しょくじ"),
      ...FLASHCARD_SEED_COMMANDS,
      ...(flashcardCategoryNote("READING_ERROR", "食事|しょくじ")?.commands ?? []),
    ];
    for (const command of commands) {
      const script = /^npm run (\S+)/.exec(command)?.[1];
      expect(script && scripts[script], command).toBeTruthy();
    }

    const generator = read("prisma/generate-flashcard-vocab.mjs");
    expect(generator).toContain('"--overwrite"');
    expect(generator).toContain('"--key"');
    const doubtFixer = read("prisma/fix-flashcard-doubts.mjs");
    expect(doubtFixer).toContain('"--apply"');
    expect(doubtFixer).toContain('"--key"');
  });
});
