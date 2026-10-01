// Kontrak data kosakata flashcard, dipakai bersama oleh:
//   - prisma/extract-flashcard-anki.mjs   (daftar kata dari .apkg -> fixture)
//   - prisma/generate-flashcard-vocab.mjs (isi kartu oleh AI -> fixture)
//   - prisma/seed-flashcard.mjs           (fixture -> database)
//
// Fixture ada di src/flashcard-data/vocab/<level>.json, satu file per level
// JLPT. Taxonomy tag (satu-satunya daftar tag yang sah) ada di
// src/flashcard-data/taxonomy.json dan juga dibaca aplikasi.
// Kontrak lengkapnya: docs/seed-flashcard.md.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
  containsKanji,
  markupProblems,
  readingFromMarkup,
  stripJapaneseMarkup,
  toHiragana,
} from "./japanese-markup-check.mjs";

export const DATA_DIR = fileURLToPath(new URL("../src/flashcard-data/", import.meta.url));
export const VOCAB_DIR = path.join(DATA_DIR, "vocab");
export const TAXONOMY_FILE = path.join(DATA_DIR, "taxonomy.json");

/** Urutan dari yang paling mudah. Kata ganda masuk ke level paling mudah. */
export const LEVELS = ["N5", "N4", "N3", "N2", "N1"];
export const levelTag = (level) => level.toLowerCase();
export const vocabFileOf = (level) => path.join(VOCAB_DIR, `${level.toLowerCase()}.json`);

export const LIMITS = {
  meanings: { min: 1, max: 8, itemLength: 80 },
  examples: { min: 1, max: 2, jpLength: 300, translationLength: 300 },
  notesLength: 600,
  doubtLength: 400,
};

// ---------------------------------------------------------------------------
// Taxonomy
// ---------------------------------------------------------------------------

const dimensionSchema = z.object({
  id: z.string().regex(/^[a-z]+$/),
  label: z.string().min(1),
  source: z.enum(["extract", "ai"]),
  min: z.number().int().min(0),
  max: z.number().int().min(1),
  deckKind: z.enum(["LEVEL", "TOPIC", "CATEGORY"]).nullable(),
  rule: z.string().min(1),
});

const tagSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  dimension: z.string(),
  label: z.string().min(1),
  labelJa: z.string().min(1),
  deck: z.boolean(),
  deckName: z.string().min(1).optional(),
  description: z.string().min(1),
});

const taxonomySchema = z.object({
  version: z.number().int().positive(),
  license: z.string().min(1),
  deckMinNotes: z.number().int().min(1),
  dimensions: z.array(dimensionSchema).min(1),
  tags: z.array(tagSchema).min(1),
});

/**
 * Membaca dan memvalidasi taxonomy. Pelanggaran struktur adalah bug data, jadi
 * dilempar sebagai error, bukan dikembalikan sebagai daftar masalah.
 */
export async function loadTaxonomy() {
  const raw = JSON.parse(await fs.readFile(TAXONOMY_FILE, "utf8"));
  const parsed = taxonomySchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`taxonomy.json tidak valid: ${issue?.path.join(".")}: ${issue?.message}`);
  }

  const taxonomy = parsed.data;
  const problems = taxonomyProblems(taxonomy);
  if (problems.length > 0) {
    throw new Error(`taxonomy.json tidak valid:\n  - ${problems.join("\n  - ")}`);
  }

  const dimensions = new Map(taxonomy.dimensions.map((dimension) => [dimension.id, dimension]));
  const tags = new Map(taxonomy.tags.map((tag) => [tag.slug, tag]));
  return { ...taxonomy, dimensionById: dimensions, tagBySlug: tags };
}

/** @returns {string[]} */
export function taxonomyProblems(taxonomy) {
  const problems = [];
  const dimensionIds = new Set();
  for (const dimension of taxonomy.dimensions) {
    if (dimensionIds.has(dimension.id)) problems.push(`dimensi "${dimension.id}" ganda`);
    dimensionIds.add(dimension.id);
    if (dimension.min > dimension.max) problems.push(`dimensi "${dimension.id}": min > max`);
  }
  if (!dimensionIds.has("level")) problems.push('dimensi "level" wajib ada');

  const slugs = new Set();
  for (const tag of taxonomy.tags) {
    if (slugs.has(tag.slug)) problems.push(`tag "${tag.slug}" ganda`);
    slugs.add(tag.slug);

    const dimension = taxonomy.dimensions.find((item) => item.id === tag.dimension);
    if (!dimension) {
      problems.push(`tag "${tag.slug}": dimensi "${tag.dimension}" tidak dikenal`);
      continue;
    }
    if (tag.deck && !dimension.deckKind) {
      problems.push(`tag "${tag.slug}": dimensi "${tag.dimension}" tidak bisa menjadi deck`);
    }
  }

  for (const level of LEVELS) {
    const tag = taxonomy.tags.find((item) => item.slug === levelTag(level));
    if (!tag || tag.dimension !== "level") problems.push(`tag level "${levelTag(level)}" wajib ada`);
  }
  return problems;
}

/** Tag yang boleh ditulis AI, dikelompokkan per dimensi — dipakai prompt. */
export function aiTagGroups(taxonomy) {
  return taxonomy.dimensions
    .filter((dimension) => dimension.source === "ai")
    .map((dimension) => ({
      dimension,
      tags: taxonomy.tags.filter((tag) => tag.dimension === dimension.id),
    }));
}

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

const levelSchema = z.enum(LEVELS);

const exampleSchema = z.object({
  jp: z.string(),
  id: z.string(),
  en: z.string(),
});

export const vocabContentSchema = z.object({
  word: z.string(),
  meaningsId: z.array(z.string()),
  meaningsEn: z.array(z.string()),
  examples: z.array(exampleSchema),
  notes: z.string(),
  tags: z.array(z.string()),
});

const aiMetaSchema = z.object({
  model: z.string().min(1),
  promptVersion: z.string().min(1),
  generatedAt: z.iso.datetime({ offset: true }),
  doubt: z.string().nullable(),
  // Diisi prisma/fix-flashcard-doubts.mjs setelah doubt ditinjau. `override`
  // berisi tulisan/bacaan pengganti sumber (keputusan replace, atau bacaan
  // sumber yang keliru) yang dipasang ulang setelah flashcard:extract.
  // `retire` berarti kata ini duplikat `duplicateOf` dan tidak diterbitkan.
  doubtResolution: z
    .object({
      action: z.enum(["keep", "revise", "replace", "retire"]),
      reason: z.string(),
      previousDoubt: z.string(),
      model: z.string(),
      resolvedAt: z.iso.datetime({ offset: true }),
      source: z.object({ word: z.string(), reading: z.string(), readingUncertain: z.boolean() }),
      override: z.object({ word: z.string(), reading: z.string() }).nullable(),
      duplicateOf: z.string().optional(),
    })
    .optional(),
});

/** Kata yang dipensiunkan sebagai duplikat oleh fix:flashcard-doubts. */
export const isRetiredNote = (note) => note.ai?.doubtResolution?.action === "retire";

const vocabNoteSchema = z.object({
  key: z.string().min(3).max(160),
  order: z.number().int().positive(),
  word: z.string().min(1).max(120),
  reading: z.string().min(1).max(160),
  readingUncertain: z.boolean(),
  hints: z.array(z.string()),
  homographs: z.array(z.string()),
  sourceLevels: z.array(levelSchema),
  sourceGuids: z.array(z.string()),
  content: vocabContentSchema.nullable(),
  ai: aiMetaSchema.nullable(),
});

const vocabFileSchema = z.object({
  level: levelSchema,
  notes: z.array(vocabNoteSchema),
});

/**
 * Membaca satu fixture level. File yang belum ada dianggap kosong, supaya
 * ekstraksi pertama tidak perlu kasus khusus.
 */
export async function readVocabFile(level) {
  let raw;
  try {
    raw = await fs.readFile(vocabFileOf(level), "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return { level, notes: [] };
    throw error;
  }

  const parsed = vocabFileSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(
      `${path.basename(vocabFileOf(level))} tidak valid: ${issue?.path.join(".")}: ${issue?.message}`,
    );
  }
  if (parsed.data.level !== level) {
    throw new Error(`${path.basename(vocabFileOf(level))} berisi level ${parsed.data.level}`);
  }
  return parsed.data;
}

/**
 * Tulis ke file sementara lalu rename: rename dalam satu direktori bersifat
 * atomik, sehingga proses yang dihentikan di tengah jalan tidak pernah
 * meninggalkan fixture yang terpotong.
 */
export async function writeVocabFile(file) {
  const validation = vocabFileSchema.safeParse(file);
  if (!validation.success) {
    const issue = validation.error.issues[0];
    throw new Error(
      `fixture ${file.level} tidak valid, tidak ditulis: ${issue?.path.join(".")}: ${issue?.message}`,
    );
  }

  await fs.mkdir(VOCAB_DIR, { recursive: true });
  const target = vocabFileOf(file.level);
  const temporary = `${target}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(file, null, 2)}\n`, "utf8");
  await fs.rename(temporary, target);
}

// ---------------------------------------------------------------------------
// Validasi isi kartu
// ---------------------------------------------------------------------------

const VERB_TAGS = new Set(["verb-godan", "verb-ichidan", "verb-suru", "verb-irregular"]);

function glossProblems(label, items) {
  const problems = [];
  const { min, max, itemLength } = LIMITS.meanings;
  if (items.length < min || items.length > max) {
    problems.push(`${label}: harus ${min}-${max} arti, ditemukan ${items.length}`);
  }

  const seen = new Set();
  for (const item of items) {
    const value = item.trim();
    if (!value) {
      problems.push(`${label}: ada arti kosong`);
      continue;
    }
    if (value.length > itemLength) {
      problems.push(`${label}: "${value.slice(0, 30)}…" terlalu panjang (maks ${itemLength} karakter)`);
    }
    if (/[{}<>\n]|__/.test(value)) {
      problems.push(`${label}: "${value}" tidak boleh memuat markup, HTML, atau baris baru`);
    }
    if (value.includes(";")) {
      problems.push(`${label}: "${value}" — pisahkan tiap arti sebagai item array, bukan dengan ;`);
    }
    const normalized = value.toLowerCase();
    if (seen.has(normalized)) problems.push(`${label}: arti "${value}" ganda`);
    seen.add(normalized);
  }
  return problems;
}

function plainTextProblems(label, value, maxLength) {
  const problems = [];
  if (!value.trim()) problems.push(`${label}: kosong`);
  if (value.length > maxLength) problems.push(`${label}: terlalu panjang (maks ${maxLength} karakter)`);
  if (/[{}<>]|__/.test(value)) problems.push(`${label}: tidak boleh memuat markup atau HTML`);
  return problems;
}

/** Karakter pertama yang bermakna: tanda ～/〜 di depan kata diabaikan. */
function leadingCharacter(text) {
  return toHiragana(text.replace(/^[〜～~]+/, "")).slice(0, 1);
}

/**
 * Semua pelanggaran aturan isi kartu. Array kosong berarti isi siap disimpan.
 *
 * @param {{ word: string, reading: string, readingUncertain: boolean, homographs: string[] }} note
 * @param {z.infer<typeof vocabContentSchema>} content
 * @param {Awaited<ReturnType<typeof loadTaxonomy>>} taxonomy
 * @param {{ doubt?: string | null }} [options]
 * @returns {string[]}
 */
export function vocabContentProblems(note, content, taxonomy, options = {}) {
  const problems = [];

  // --- Kata -----------------------------------------------------------------
  const wordMarkup = markupProblems(content.word);
  problems.push(...wordMarkup.map((problem) => `word: ${problem}`));
  if (content.word.includes("__")) problems.push("word: jangan memakai __ pada kata");

  const bareWord = stripJapaneseMarkup(content.word);
  if (bareWord !== note.word) {
    problems.push(
      `word: tanpa furigana harus persis "${note.word}", ditemukan "${bareWord}" — jangan mengubah tulisan katanya`,
    );
  } else if (wordMarkup.length === 0 && containsKanji(note.word) && !note.readingUncertain) {
    const derived = toHiragana(readingFromMarkup(content.word));
    const expected = toHiragana(note.reading);
    if (derived !== expected && !options.doubt) {
      problems.push(
        `word: bacaan furigana "${derived}" berbeda dari bacaan sumber "${expected}" — ` +
          "pakai bacaan sumber, atau isi doubt bila bacaan sumber memang keliru",
      );
    }
  }

  // --- Arti -----------------------------------------------------------------
  problems.push(...glossProblems("meaningsId", content.meaningsId));
  problems.push(...glossProblems("meaningsEn", content.meaningsEn));

  if (content.tags.some((tag) => VERB_TAGS.has(tag))) {
    const literal = content.meaningsId.filter((item) => /^untuk\s+\S/i.test(item.trim()));
    if (literal.length > 0) {
      problems.push(
        `meaningsId: kata kerja ditulis dalam bentuk dasar tanpa "untuk", mis. "makan" bukan "untuk makan" (${literal.slice(0, 2).join(", ")})`,
      );
    }
  }

  // --- Contoh ---------------------------------------------------------------
  const { min, max, jpLength, translationLength } = LIMITS.examples;
  if (content.examples.length < min || content.examples.length > max) {
    problems.push(`examples: harus ${min}-${max} contoh, ditemukan ${content.examples.length}`);
  }
  content.examples.forEach((example, index) => {
    const label = `examples[${index}]`;
    problems.push(...markupProblems(example.jp).map((problem) => `${label}.jp: ${problem}`));
    if (!example.jp.trim()) problems.push(`${label}.jp: kosong`);
    if (example.jp.length > jpLength) problems.push(`${label}.jp: terlalu panjang`);
    if (example.jp.includes("\n")) problems.push(`${label}.jp: harus satu baris`);

    const underlined = [...example.jp.matchAll(/__(.+?)__/g)];
    if (underlined.length !== 1) {
      problems.push(`${label}.jp: tandai kata target dengan __...__ tepat satu kali`);
    } else {
      const target = toHiragana(stripJapaneseMarkup(underlined[0][1]));
      const wordStart = leadingCharacter(note.word);
      const readingStart = leadingCharacter(note.reading);
      if (!target.includes(wordStart) && !target.includes(readingStart)) {
        problems.push(`${label}.jp: bagian __...__ harus memuat kata "${note.word}" (boleh berubah bentuk)`);
      }
    }

    problems.push(...plainTextProblems(`${label}.id`, example.id, translationLength));
    problems.push(...plainTextProblems(`${label}.en`, example.en, translationLength));
  });

  // --- Catatan --------------------------------------------------------------
  if (content.notes.length > LIMITS.notesLength) {
    problems.push(`notes: terlalu panjang (maks ${LIMITS.notesLength} karakter)`);
  }
  if (content.notes.trim()) {
    problems.push(...markupProblems(content.notes).map((problem) => `notes: ${problem}`));
    if (content.notes.includes("__")) problems.push("notes: jangan memakai __");
  }

  // --- Tag ------------------------------------------------------------------
  const counts = new Map();
  const seen = new Set();
  for (const slug of content.tags) {
    if (seen.has(slug)) problems.push(`tags: "${slug}" ganda`);
    seen.add(slug);

    const tag = taxonomy.tagBySlug.get(slug);
    if (!tag) {
      problems.push(`tags: "${slug}" tidak ada di daftar tag`);
      continue;
    }
    const dimension = taxonomy.dimensionById.get(tag.dimension);
    if (dimension?.source !== "ai") {
      problems.push(`tags: "${slug}" diisi otomatis, jangan ditulis`);
      continue;
    }
    counts.set(tag.dimension, (counts.get(tag.dimension) ?? 0) + 1);
  }
  for (const dimension of taxonomy.dimensions) {
    if (dimension.source !== "ai") continue;
    const count = counts.get(dimension.id) ?? 0;
    if (count < dimension.min || count > dimension.max) {
      problems.push(
        `tags: dimensi ${dimension.id} harus ${dimension.min}-${dimension.max} tag, ditemukan ${count}`,
      );
    }
  }

  if (options.doubt != null && options.doubt.length > LIMITS.doubtLength) {
    problems.push(`doubt: terlalu panjang (maks ${LIMITS.doubtLength} karakter)`);
  }

  return problems;
}

/**
 * Hal yang patut ditinjau tetapi tidak menggagalkan isi kartu.
 *
 * Homograf sengaja hanya peringatan: sisi depan kartu menampilkan tulisan tanpa
 * furigana, jadi bacaan lain perlu disebut di catatan — tetapi daftar homograf
 * berasal dari sumber dan bisa memuat bacaan salah ketik (mis. はながたい untuk
 * 鼻が高い). Memaksa AI menyebutnya hanya akan menghasilkan catatan keliru.
 *
 * @returns {string[]}
 */
export function vocabContentWarnings(note, content) {
  // Bacaan lain biasanya ditulis bermarkup ({止|や}める), jadi yang dicari adalah
  // bacaannya, bukan teks mentahnya.
  const notesText = toHiragana(readingFromMarkup(content.notes));
  const missing = note.homographs.filter((reading) => !notesText.includes(toHiragana(reading)));
  return missing.length > 0
    ? [`notes tidak menyebut bacaan lain untuk tulisan yang sama: ${missing.join(", ")}`]
    : [];
}

/**
 * Bentuk baris database dari satu note yang sudah digenerate. Field turunan
 * (`wordPlain`, `reading`, tag level) dihitung di sini, bukan disimpan di
 * fixture, supaya tidak mungkin berselisih dengan isi aslinya.
 */
export function toVocabRow(level, note) {
  const { content, ai } = note;
  return {
    key: note.key,
    level,
    order: note.order,
    word: content.word,
    wordPlain: stripJapaneseMarkup(content.word),
    reading: readingFromMarkup(content.word),
    meaningsId: content.meaningsId.map((item) => item.trim()),
    meaningsEn: content.meaningsEn.map((item) => item.trim()),
    examples: content.examples.map((example) => ({
      jp: example.jp.trim(),
      id: example.id.trim(),
      en: example.en.trim(),
    })),
    notes: content.notes.trim(),
    tags: [levelTag(level), ...content.tags],
    aiModel: ai.model,
    promptVersion: ai.promptVersion,
    generatedAt: ai.generatedAt,
  };
}
