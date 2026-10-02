// Shared Bunpou data contract used by extraction, content generation, validation,
// and database seeding. The canonical contract is documented in
// docs/seed-bunpou.md.

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
  markupProblems,
  readingFromMarkup,
  stripJapaneseMarkup,
  toHiragana,
} from "./japanese-markup-check.mjs";

export const DATA_DIR = fileURLToPath(new URL("../src/bunpou-data/", import.meta.url));
export const POINTS_DIR = path.join(DATA_DIR, "points");
export const TAXONOMY_FILE = path.join(DATA_DIR, "taxonomy.json");
export const SLIDES_FILE = path.join(DATA_DIR, "slides.json");
export const COMPARISONS_FILE = path.join(DATA_DIR, "comparisons.json");
export const RAW_IMAGES_DIR = fileURLToPath(new URL("../data/bunpou/raw_images/", import.meta.url));

export const LEVELS = ["N5", "N4", "N3", "N2", "N1"];
export const KINDS = ["pattern", "particle", "conjugation", "foundation"];
export const KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const DECK_PATTERN = /^n([1-5])-[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const LIMITS = {
  connectionNoteLength: 120,
  doubtLength: 400,
  explanation: { min: 1, max: 4, itemLength: 700 },
  examples: { min: 3, max: 5, jpLength: 400, translationLength: 300 },
  formation: { max: 24, labelLength: 80, valueLength: 120, noteLength: 160 },
  meaningLength: 160,
  pitfalls: { max: 4, itemLength: 300 },
  variants: { max: 6, itemLength: 120 },
};

const levelSchema = z.enum(LEVELS);
const kindSchema = z.enum(KINDS);
const keySchema = z.string().min(1).max(80).regex(KEY_PATTERN);
const slugSchema = z.string().min(1).max(80).regex(KEY_PATTERN);

const formationRowSchema = z.object({
  label: z.string(),
  input: z.string(),
  rule: z.string(),
  output: z.string(),
  note: z.string().nullable(),
});

const sourceSchema = z.object({
  slides: z.array(z.string().min(1)).min(1),
  title: z.string(),
  meaning: z.string(),
  connection: z.string(),
  formation: z.array(formationRowSchema),
  notes: z.string(),
  examples: z.array(z.string()),
});

const extractMetaSchema = z.object({
  model: z.string().min(1),
  promptVersion: z.string().min(1),
  extractedAt: z.iso.datetime({ offset: true }),
  doubt: z.string().nullable(),
});

const connectionSchema = z.object({
  form: slugSchema,
  pattern: z.string(),
  note: z.string().max(LIMITS.connectionNoteLength).optional(),
});

const exampleSchema = z.object({
  jp: z.string(),
  id: z.string(),
  en: z.string(),
});

export const bunpouContentSchema = z.object({
  title: z.string(),
  senseLabel: z.string().max(30).nullable(),
  meaningId: z.string(),
  meaningEn: z.string(),
  connections: z.array(connectionSchema),
  formation: z.array(formationRowSchema),
  variants: z.array(z.string()),
  explanation: z.array(z.string()),
  examples: z.array(exampleSchema),
  pitfalls: z.array(z.string()),
  tags: z.array(slugSchema),
});

const aiMetaSchema = z.object({
  model: z.string().min(1),
  promptVersion: z.string().min(1),
  generatedAt: z.iso.datetime({ offset: true }),
  doubt: z.string().nullable(),
});

const reviewMetaSchema = z.object({
  reviewedAt: z.iso.datetime({ offset: true }),
  note: z.string().min(1).max(700),
});

export const bunpouPointSchema = z.object({
  key: keySchema,
  order: z.number().int().positive(),
  kind: kindSchema,
  sectionKey: slugSchema,
  family: keySchema.nullable(),
  title: z.string().min(1).max(160),
  source: sourceSchema,
  extract: extractMetaSchema,
  content: bunpouContentSchema.nullable(),
  ai: aiMetaSchema.nullable(),
  review: reviewMetaSchema.nullable().default(null),
});

const pointFileSchema = z.object({
  level: levelSchema,
  points: z.array(bunpouPointSchema),
});

const manifestDeckSchema = z.object({
  key: slugSchema,
  level: levelSchema,
  order: z.number().int().positive(),
});

const manifestSlideSchema = z.object({
  path: z.string().min(1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  level: levelSchema,
  deck: slugSchema,
  sequence: z.number().int().positive(),
  points: z.array(keySchema),
  skipped: z.string().nullable(),
  model: z.string().min(1),
  promptVersion: z.string().min(1),
  extractedAt: z.iso.datetime({ offset: true }),
});

const manifestSchema = z.object({
  decks: z.array(manifestDeckSchema),
  slides: z.array(manifestSlideSchema),
});

const sectionSchema = z.object({
  key: slugSchema,
  order: z.number().int().positive(),
  label: z.string().min(1),
  labelJa: z.string().min(1),
  description: z.string().min(1),
});

const dimensionSchema = z.object({
  id: z.string().regex(/^[a-z]+$/),
  label: z.string().min(1),
  min: z.number().int().min(0),
  max: z.number().int().min(1),
  rule: z.string().min(1),
});

const tagSchema = z.object({
  slug: slugSchema,
  dimension: z.string().min(1),
  label: z.string().min(1),
  labelJa: z.string().min(1),
  description: z.string().min(1),
});

const connectionFormSchema = z.object({
  slug: slugSchema,
  label: z.string().min(1),
  labelJa: z.string().min(1),
  example: z.string(),
});

const taxonomySchema = z.object({
  version: z.number().int().positive(),
  license: z.string().min(1),
  sections: z.array(sectionSchema).min(1),
  dimensions: z.array(dimensionSchema).min(1),
  tags: z.array(tagSchema).min(1),
  connectionForms: z.array(connectionFormSchema).min(1),
});

const comparisonRowSchema = z.object({
  key: keySchema,
  nuance: z.string(),
  register: z.string(),
  restriction: z.string(),
});

const comparisonOptionSchema = z.object({
  key: keySchema,
  text: z.string(),
  verdict: z.enum(["ok", "awkward", "wrong"]),
  note: z.string().optional(),
});

const comparisonContrastSchema = z.object({
  jp: z.string(),
  id: z.string(),
  options: z.array(comparisonOptionSchema).min(2),
});

export const comparisonContentSchema = z.object({
  summary: z.string(),
  rows: z.array(comparisonRowSchema),
  contrasts: z.array(comparisonContrastSchema).min(1),
});

const comparisonSchema = z.object({
  key: keySchema,
  title: z.string().min(1).max(160),
  points: z.array(keySchema).min(2).max(6),
  content: comparisonContentSchema.nullable(),
  ai: aiMetaSchema.nullable(),
  reviewedAt: z.iso.datetime({ offset: true }).nullable(),
});

const comparisonsFileSchema = z.object({
  comparisons: z.array(comparisonSchema),
});

function firstIssue(error) {
  const issue = error.issues[0];
  return `${issue?.path.join(".") || "root"}: ${issue?.message ?? "format tidak valid"}`;
}

async function readJson(file) {
  let raw;
  try {
    raw = await fs.readFile(file, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`${path.relative(process.cwd(), file)} bukan JSON valid: ${error.message}`);
  }
}

async function writeJsonAtomic(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await fs.rename(temporary, file);
}

export function pointFileOf(level) {
  return path.join(POINTS_DIR, `${level.toLowerCase()}.json`);
}

export async function loadTaxonomy() {
  const parsed = taxonomySchema.safeParse(await readJson(TAXONOMY_FILE));
  if (!parsed.success) throw new Error(`taxonomy bunpou tidak valid: ${firstIssue(parsed.error)}`);

  const taxonomy = parsed.data;
  const problems = taxonomyProblems(taxonomy);
  if (problems.length > 0) {
    throw new Error(`taxonomy bunpou tidak valid:\n  - ${problems.join("\n  - ")}`);
  }

  return {
    ...taxonomy,
    sectionByKey: new Map(taxonomy.sections.map((item) => [item.key, item])),
    dimensionById: new Map(taxonomy.dimensions.map((item) => [item.id, item])),
    tagBySlug: new Map(taxonomy.tags.map((item) => [item.slug, item])),
    connectionBySlug: new Map(taxonomy.connectionForms.map((item) => [item.slug, item])),
  };
}

export function taxonomyProblems(taxonomy) {
  const problems = [];
  const unique = (items, value, label) => {
    const seen = new Set();
    for (const item of items) {
      const key = value(item);
      if (seen.has(key)) problems.push(`${label} "${key}" ganda`);
      seen.add(key);
    }
  };

  unique(taxonomy.sections, (item) => item.key, "section");
  unique(taxonomy.sections, (item) => item.order, "urutan section");
  unique(taxonomy.dimensions, (item) => item.id, "dimensi");
  unique(taxonomy.tags, (item) => item.slug, "tag");
  unique(taxonomy.connectionForms, (item) => item.slug, "bentuk sambungan");

  const dimensions = new Set(taxonomy.dimensions.map((item) => item.id));
  for (const dimension of taxonomy.dimensions) {
    if (dimension.min > dimension.max) problems.push(`dimensi "${dimension.id}": min > max`);
  }
  for (const tag of taxonomy.tags) {
    if (!dimensions.has(tag.dimension)) {
      problems.push(`tag "${tag.slug}": dimensi "${tag.dimension}" tidak dikenal`);
    }
  }
  return problems;
}

export function aiTagGroups(taxonomy) {
  return taxonomy.dimensions.map((dimension) => ({
    dimension,
    tags: taxonomy.tags.filter((tag) => tag.dimension === dimension.id),
  }));
}

export async function readManifest() {
  const raw = (await readJson(SLIDES_FILE)) ?? { decks: [], slides: [] };
  const parsed = manifestSchema.safeParse(raw);
  if (!parsed.success) throw new Error(`slides.json tidak valid: ${firstIssue(parsed.error)}`);
  return parsed.data;
}

export async function writeManifest(manifest) {
  const parsed = manifestSchema.safeParse(manifest);
  if (!parsed.success) throw new Error(`slides.json tidak valid: ${firstIssue(parsed.error)}`);
  await writeJsonAtomic(SLIDES_FILE, parsed.data);
}

export async function readPointFile(level) {
  const raw = (await readJson(pointFileOf(level))) ?? { level, points: [] };
  const parsed = pointFileSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`${path.basename(pointFileOf(level))} tidak valid: ${firstIssue(parsed.error)}`);
  }
  if (parsed.data.level !== level) {
    throw new Error(`${path.basename(pointFileOf(level))} berisi level ${parsed.data.level}`);
  }
  return parsed.data;
}

export async function writePointFile(file) {
  const parsed = pointFileSchema.safeParse(file);
  if (!parsed.success) {
    throw new Error(`fixture ${file.level} tidak valid, tidak ditulis: ${firstIssue(parsed.error)}`);
  }
  await writeJsonAtomic(pointFileOf(file.level), parsed.data);
}

export async function readAllPointFiles() {
  const files = new Map();
  for (const level of LEVELS) files.set(level, await readPointFile(level));
  return files;
}

export async function readComparisons() {
  const raw = (await readJson(COMPARISONS_FILE)) ?? { comparisons: [] };
  const parsed = comparisonsFileSchema.safeParse(raw);
  if (!parsed.success) throw new Error(`comparisons.json tidak valid: ${firstIssue(parsed.error)}`);
  return parsed.data;
}

export async function writeComparisons(file) {
  const parsed = comparisonsFileSchema.safeParse(file);
  if (!parsed.success) throw new Error(`comparisons.json tidak valid: ${firstIssue(parsed.error)}`);
  await writeJsonAtomic(COMPARISONS_FILE, parsed.data);
}

export function levelFromDeck(deck) {
  const match = deck.match(DECK_PATTERN);
  if (!match) return null;
  return `N${match[1]}`;
}

export async function sha256File(file) {
  const data = await fs.readFile(file);
  return crypto.createHash("sha256").update(data).digest("hex");
}

export async function discoverRawDecks(rawImagesDir = RAW_IMAGES_DIR) {
  let entries;
  try {
    entries = await fs.readdir(rawImagesDir, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }

  const decks = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) continue;
    const level = levelFromDeck(entry.name);
    if (!level) {
      throw new Error(`folder deck tidak sah: ${entry.name} (harus diawali n5- sampai n1-)`);
    }

    const deckDir = path.join(rawImagesDir, entry.name);
    const files = [];
    for (const file of await fs.readdir(deckDir, { withFileTypes: true })) {
      if (!file.isFile()) continue;
      if (file.name.startsWith(".")) continue;
      const escaped = entry.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const match = file.name.match(new RegExp(`^${escaped}-(\\d+)\\.(png|jpe?g|webp)$`, "i"));
      if (!match) {
        throw new Error(
          `nama gambar tidak sah: ${entry.name}/${file.name} (harus ${entry.name}-<nomor>.<ext>)`,
        );
      }
      files.push({
        path: `${entry.name}/${file.name}`,
        absolutePath: path.join(deckDir, file.name),
        sequence: Number(match[1]),
        extension: match[2].toLowerCase(),
      });
    }

    files.sort((left, right) => left.sequence - right.sequence || left.path.localeCompare(right.path));
    const sequences = new Set();
    for (const file of files) {
      if (sequences.has(file.sequence)) {
        throw new Error(`nomor slide ganda pada deck ${entry.name}: ${file.sequence}`);
      }
      sequences.add(file.sequence);
    }
    decks.push({ key: entry.name, level, files });
  }
  return decks;
}

function plainTextProblems(label, value, maxLength, { allowEmpty = false } = {}) {
  const problems = [];
  const trimmed = value.trim();
  if (!allowEmpty && !trimmed) problems.push(`${label}: kosong`);
  if (value.length > maxLength) problems.push(`${label}: terlalu panjang (maks ${maxLength} karakter)`);
  if (/[{}<>\n]|__/.test(value)) problems.push(`${label}: harus teks polos satu baris tanpa markup`);
  return problems;
}

function markedTextProblems(label, value, maxLength, { allowEmpty = false, underline = false } = {}) {
  const problems = [];
  if (!allowEmpty && !value.trim()) problems.push(`${label}: kosong`);
  if (value.length > maxLength) problems.push(`${label}: terlalu panjang (maks ${maxLength} karakter)`);
  if (value.includes("\n")) problems.push(`${label}: harus satu baris`);
  problems.push(...markupProblems(value).map((problem) => `${label}: ${problem}`));
  if (!underline && value.includes("__")) problems.push(`${label}: tidak boleh memakai __`);
  return problems;
}

function latinProsePunctuationProblems(label, value) {
  return /[A-Za-z]/.test(value) && /[。！？]$/.test(value.trim())
    ? [`${label}: prosa Indonesia/Inggris harus memakai tanda baca Latin (. ! ?), bukan 。！？`]
    : [];
}

function normalizeLatinProsePunctuation(value) {
  if (!/[A-Za-z]/.test(value)) return value;
  return value.replace(/[。！？]$/, (mark) => ({ "。": ".", "！": "!", "？": "?" })[mark]);
}

export function normalizeBunpouContent(content) {
  for (const connection of content.connections) {
    if (connection.note != null) connection.note = normalizeLatinProsePunctuation(connection.note);
  }
  for (const row of content.formation) {
    if (row.note != null) row.note = normalizeLatinProsePunctuation(row.note);
  }
  content.explanation = content.explanation.map(normalizeLatinProsePunctuation);
  content.pitfalls = content.pitfalls.map(normalizeLatinProsePunctuation);
  for (const example of content.examples) {
    example.id = normalizeLatinProsePunctuation(example.id);
    example.en = normalizeLatinProsePunctuation(example.en);
  }
  return content;
}

function meaningLanguageProblems(meaningId, meaningEn) {
  const problems = [];
  const englishMarkers = /\b(?:an|the|of|from|with|for|be|is|are|at|in|on|by)\b/i;
  const indonesianMarkers =
    /\b(?:yang|untuk|dengan|dari|pada|dan|atau|sebagai|menyatakan|menandai|kata|bentuk|tempat|waktu|tidak|hingga|dalam|melalui|menggantikan|menghubungkan)\b/i;
  if (englishMarkers.test(meaningId)) {
    problems.push("meaningId: tampak berbahasa Inggris; wajib berupa Indonesia");
  }
  if (indonesianMarkers.test(meaningEn)) {
    problems.push("meaningEn: tampak berbahasa Indonesia; wajib berupa Inggris");
  }
  return problems;
}

function normalizedSentence(value) {
  return stripJapaneseMarkup(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]/gu, "");
}

export function bunpouContentProblems(point, content, taxonomy, options = {}) {
  const problems = [];

  problems.push(...markedTextProblems("title", content.title, 200));
  if (stripJapaneseMarkup(content.title) !== point.title) {
    problems.push(
      `title: tanpa markup harus persis "${point.title}", ditemukan "${stripJapaneseMarkup(content.title)}"`,
    );
  }

  if (point.family) {
    if (!content.senseLabel?.trim()) problems.push("senseLabel: wajib bila family diisi");
    else problems.push(...plainTextProblems("senseLabel", content.senseLabel, 30));
  } else if (content.senseLabel !== null) {
    problems.push("senseLabel: harus null bila family tidak diisi");
  }

  problems.push(...plainTextProblems("meaningId", content.meaningId, LIMITS.meaningLength));
  problems.push(...plainTextProblems("meaningEn", content.meaningEn, LIMITS.meaningLength));
  problems.push(...meaningLanguageProblems(content.meaningId, content.meaningEn));

  if (content.connections.length > 8) problems.push("connections: maksimal 8 item");
  if (point.kind === "pattern" && content.connections.length === 0) {
    problems.push('connections: kind "pattern" wajib memiliki minimal satu sambungan');
  }
  content.connections.forEach((connection, index) => {
    const label = `connections[${index}]`;
    if (!taxonomy.connectionBySlug.has(connection.form)) {
      problems.push(`${label}.form: "${connection.form}" tidak ada di taxonomy`);
    }
    problems.push(...markedTextProblems(`${label}.pattern`, connection.pattern, 160));
    if (connection.form === "other" && !connection.note?.trim()) {
      problems.push(`${label}.note: wajib untuk form "other"`);
    }
    if (connection.note != null) {
      problems.push(
        ...markedTextProblems(`${label}.note`, connection.note, LIMITS.connectionNoteLength),
      );
      problems.push(...latinProsePunctuationProblems(`${label}.note`, connection.note));
    }
  });

  if (content.formation.length > LIMITS.formation.max) {
    problems.push(`formation: maksimal ${LIMITS.formation.max} baris`);
  }
  if (point.kind === "conjugation" && content.formation.length === 0) {
    problems.push('formation: kind "conjugation" wajib memiliki minimal satu baris');
  }
  content.formation.forEach((row, index) => {
    const label = `formation[${index}]`;
    problems.push(...plainTextProblems(`${label}.label`, row.label, LIMITS.formation.labelLength));
    problems.push(...markedTextProblems(`${label}.input`, row.input, LIMITS.formation.valueLength));
    problems.push(...markedTextProblems(`${label}.rule`, row.rule, LIMITS.formation.valueLength));
    problems.push(...markedTextProblems(`${label}.output`, row.output, LIMITS.formation.valueLength));
    if (row.note != null) {
      problems.push(...markedTextProblems(`${label}.note`, row.note, LIMITS.formation.noteLength));
      problems.push(...latinProsePunctuationProblems(`${label}.note`, row.note));
    }
  });

  if (content.variants.length > LIMITS.variants.max) {
    problems.push(`variants: maksimal ${LIMITS.variants.max} item`);
  }
  const variants = new Set();
  content.variants.forEach((variant, index) => {
    problems.push(...markedTextProblems(`variants[${index}]`, variant, LIMITS.variants.itemLength));
    const plain = stripJapaneseMarkup(variant);
    if (plain === point.title) problems.push(`variants[${index}]: sama dengan title`);
    if (variants.has(plain)) problems.push(`variants[${index}]: varian "${plain}" ganda`);
    variants.add(plain);
  });

  if (
    content.explanation.length < LIMITS.explanation.min ||
    content.explanation.length > LIMITS.explanation.max
  ) {
    problems.push(
      `explanation: harus ${LIMITS.explanation.min}-${LIMITS.explanation.max} paragraf, ` +
        `ditemukan ${content.explanation.length}`,
    );
  }
  content.explanation.forEach((paragraph, index) => {
    problems.push(...markedTextProblems(`explanation[${index}]`, paragraph, LIMITS.explanation.itemLength));
    problems.push(...latinProsePunctuationProblems(`explanation[${index}]`, paragraph));
  });

  if (content.examples.length < LIMITS.examples.min || content.examples.length > LIMITS.examples.max) {
    problems.push(
      `examples: harus ${LIMITS.examples.min}-${LIMITS.examples.max} contoh, ` +
        `ditemukan ${content.examples.length}`,
    );
  }
  const sourceExamples = new Set(point.source.examples.map(normalizedSentence));
  content.examples.forEach((example, index) => {
    const label = `examples[${index}]`;
    problems.push(
      ...markedTextProblems(`${label}.jp`, example.jp, LIMITS.examples.jpLength, { underline: true }),
    );
    const targets = [...example.jp.matchAll(/__(.+?)__/g)];
    if (targets.length !== 1 || (example.jp.match(/__/g) ?? []).length !== 2) {
      problems.push(`${label}.jp: tandai bagian pola dengan __...__ tepat satu kali`);
    } else if (!stripJapaneseMarkup(targets[0][1]).trim()) {
      problems.push(`${label}.jp: bagian __...__ kosong`);
    }
    problems.push(...plainTextProblems(`${label}.id`, example.id, LIMITS.examples.translationLength));
    problems.push(...plainTextProblems(`${label}.en`, example.en, LIMITS.examples.translationLength));
    problems.push(...latinProsePunctuationProblems(`${label}.id`, example.id));
    problems.push(...latinProsePunctuationProblems(`${label}.en`, example.en));
    if (sourceExamples.has(normalizedSentence(example.jp))) {
      problems.push(`${label}.jp: tidak boleh menyalin contoh dari source`);
    }
  });

  if (content.pitfalls.length > LIMITS.pitfalls.max) {
    problems.push(`pitfalls: maksimal ${LIMITS.pitfalls.max} item`);
  }
  content.pitfalls.forEach((pitfall, index) => {
    problems.push(...markedTextProblems(`pitfalls[${index}]`, pitfall, LIMITS.pitfalls.itemLength));
    problems.push(...latinProsePunctuationProblems(`pitfalls[${index}]`, pitfall));
  });

  const tagCounts = new Map();
  const seenTags = new Set();
  for (const tagSlug of content.tags) {
    if (seenTags.has(tagSlug)) problems.push(`tags: "${tagSlug}" ganda`);
    seenTags.add(tagSlug);
    const tag = taxonomy.tagBySlug.get(tagSlug);
    if (!tag) {
      problems.push(`tags: "${tagSlug}" tidak ada di taxonomy`);
      continue;
    }
    tagCounts.set(tag.dimension, (tagCounts.get(tag.dimension) ?? 0) + 1);
  }
  for (const dimension of taxonomy.dimensions) {
    const count = tagCounts.get(dimension.id) ?? 0;
    if (count < dimension.min || count > dimension.max) {
      problems.push(
        `tags: dimensi ${dimension.id} harus ${dimension.min}-${dimension.max}, ditemukan ${count}`,
      );
    }
  }

  if (options.doubt != null && options.doubt.length > LIMITS.doubtLength) {
    problems.push(`doubt: terlalu panjang (maks ${LIMITS.doubtLength} karakter)`);
  }
  return problems;
}

export function pointIdentityProblems(level, point, taxonomy) {
  const problems = [];
  if (!taxonomy.sectionByKey.has(point.sectionKey)) {
    problems.push(`sectionKey "${point.sectionKey}" tidak ada di taxonomy`);
  }
  if (point.title.includes("{") || point.title.includes("__") || point.title.includes("\n")) {
    problems.push("title harus teks polos satu baris tanpa markup");
  }
  if (point.extract.doubt != null && point.extract.doubt.length > LIMITS.doubtLength) {
    problems.push(`extract.doubt terlalu panjang (maks ${LIMITS.doubtLength} karakter)`);
  }
  if (point.review?.note != null && point.review.note.length > 700) {
    problems.push("review.note terlalu panjang (maks 700 karakter)");
  }
  for (const sourcePath of point.source.slides) {
    if (!sourcePath.startsWith(`${level.toLowerCase()}-`)) {
      problems.push(`source slide "${sourcePath}" tidak sesuai level ${level}`);
    }
  }
  if (point.content && point.ai) {
    problems.push(...bunpouContentProblems(point, point.content, taxonomy, { doubt: point.ai.doubt }));
  } else if (point.content || point.ai) {
    problems.push("content dan ai harus null atau terisi bersama");
  }
  return problems;
}

export function pointPublicationFlags(point) {
  const pending = !point.content || !point.ai;
  const doubt = Boolean(point.extract.doubt || point.ai?.doubt);
  return { pending, doubt, ready: !pending && !doubt };
}

export function validateCatalog(pointFiles, manifest, taxonomy) {
  const errors = [];
  const warnings = [];
  const pointsByKey = new Map();
  const families = new Map();
  const ordersByLevel = new Map();
  const slidePaths = new Set(manifest.slides.map((slide) => slide.path));
  const decksByKey = new Map(manifest.decks.map((deck) => [deck.key, deck]));

  const deckOrders = new Set();
  for (const deck of manifest.decks) {
    const identity = `${deck.level}:${deck.order}`;
    if (deckOrders.has(identity)) errors.push(`slides.json: urutan deck ganda ${identity}`);
    deckOrders.add(identity);
    if (levelFromDeck(deck.key) !== deck.level) {
      errors.push(`slides.json: deck ${deck.key} tidak cocok dengan level ${deck.level}`);
    }
  }

  const manifestPaths = new Set();
  const manifestHashes = new Set();
  const manifestSequences = new Set();
  for (const slide of manifest.slides) {
    if (manifestPaths.has(slide.path)) errors.push(`slides.json: path ganda ${slide.path}`);
    manifestPaths.add(slide.path);
    if (manifestHashes.has(slide.sha256)) warnings.push(`slides.json: sha256 ganda ${slide.path}`);
    manifestHashes.add(slide.sha256);
    const sequenceIdentity = `${slide.deck}:${slide.sequence}`;
    if (manifestSequences.has(sequenceIdentity)) {
      errors.push(`slides.json: sequence ganda ${sequenceIdentity}`);
    }
    manifestSequences.add(sequenceIdentity);
    const deck = decksByKey.get(slide.deck);
    if (!deck) errors.push(`slides.json: deck ${slide.deck} tidak terdaftar`);
    else if (deck.level !== slide.level) errors.push(`slides.json: level slide ${slide.path} tidak cocok deck`);
    if (slide.skipped && slide.points.length > 0) {
      errors.push(`slides.json: slide ${slide.path} skipped tetapi masih memiliki point`);
    }
  }

  for (const level of LEVELS) {
    const file = pointFiles.get(level);
    const orders = new Set();
    ordersByLevel.set(level, orders);
    for (const point of file.points) {
      const where = `${level} ${point.key}`;
      if (pointsByKey.has(point.key)) {
        errors.push(`${where}: key ganda (juga ada di ${pointsByKey.get(point.key).level})`);
      } else {
        pointsByKey.set(point.key, { level, point });
      }
      if (orders.has(point.order)) errors.push(`${where}: order ${point.order} ganda`);
      orders.add(point.order);
      if (point.family) {
        const members = families.get(point.family) ?? [];
        members.push(point);
        families.set(point.family, members);
      }
      for (const problem of pointIdentityProblems(level, point, taxonomy)) {
        errors.push(`${where}: ${problem}`);
      }
      for (const sourcePath of point.source.slides) {
        if (!slidePaths.has(sourcePath)) errors.push(`${where}: source slide tidak ada di manifest: ${sourcePath}`);
      }
    }
  }

  for (const [family, members] of families) {
    if (members.length < 2) warnings.push(`family "${family}" hanya memiliki satu anggota`);
    const labels = new Set();
    for (const member of members) {
      const label = member.content?.senseLabel?.toLowerCase();
      if (!label) continue;
      if (labels.has(label)) errors.push(`family "${family}": senseLabel "${label}" ganda`);
      labels.add(label);
    }
  }

  for (const slide of manifest.slides) {
    for (const key of slide.points) {
      const found = pointsByKey.get(key);
      if (!found) errors.push(`slides.json ${slide.path}: point "${key}" tidak ditemukan`);
      else if (found.level !== slide.level) {
        errors.push(`slides.json ${slide.path}: point "${key}" berada di ${found.level}`);
      }
    }
  }

  return { errors, warnings, pointsByKey };
}

export function comparisonProblems(comparison, pointsByKey) {
  const problems = [];
  const members = new Set();
  for (const key of comparison.points) {
    if (members.has(key)) problems.push(`points: "${key}" ganda`);
    members.add(key);
    if (!pointsByKey.has(key)) problems.push(`points: "${key}" tidak ditemukan`);
  }
  if ((comparison.content === null) !== (comparison.ai === null)) {
    problems.push("content dan ai harus null atau terisi bersama");
  }
  if (!comparison.content) {
    if (comparison.reviewedAt) problems.push("reviewedAt harus null bila content belum ada");
    return problems;
  }

  problems.push(...markedTextProblems("content.summary", comparison.content.summary, 700));
  problems.push(...latinProsePunctuationProblems("content.summary", comparison.content.summary));
  if (comparison.content.rows.length !== comparison.points.length) {
    problems.push("content.rows harus tepat satu baris per point");
  }
  comparison.content.rows.forEach((row, index) => {
    if (row.key !== comparison.points[index]) {
      problems.push(`content.rows[${index}].key harus ${comparison.points[index]}`);
    }
    problems.push(...markedTextProblems(`content.rows[${index}].nuance`, row.nuance, 300));
    problems.push(...markedTextProblems(`content.rows[${index}].register`, row.register, 300));
    problems.push(...markedTextProblems(`content.rows[${index}].restriction`, row.restriction, 300));
    problems.push(...latinProsePunctuationProblems(`content.rows[${index}].nuance`, row.nuance));
    problems.push(...latinProsePunctuationProblems(`content.rows[${index}].register`, row.register));
    problems.push(...latinProsePunctuationProblems(`content.rows[${index}].restriction`, row.restriction));
  });
  comparison.content.contrasts.forEach((contrast, index) => {
    problems.push(...markedTextProblems(`content.contrasts[${index}].jp`, contrast.jp, 400));
    if ((contrast.jp.match(/\[_\]/g) ?? []).length !== 1) {
      problems.push(`content.contrasts[${index}].jp harus memiliki satu slot [_]`);
    }
    problems.push(...plainTextProblems(`content.contrasts[${index}].id`, contrast.id, 300));
    problems.push(...latinProsePunctuationProblems(`content.contrasts[${index}].id`, contrast.id));
    const verdicts = new Set();
    for (const option of contrast.options) {
      if (!members.has(option.key)) {
        problems.push(`content.contrasts[${index}]: option ${option.key} bukan anggota comparison`);
      }
      verdicts.add(option.verdict);
      problems.push(...markedTextProblems(`content.contrasts[${index}].text`, option.text, 120));
      if (option.note != null) {
        problems.push(...markedTextProblems(`content.contrasts[${index}].note`, option.note, 300));
        problems.push(...latinProsePunctuationProblems(`content.contrasts[${index}].note`, option.note));
      }
    }
    if (!contrast.options.some((option) => option.verdict === "ok")) {
      problems.push(`content.contrasts[${index}]: minimal satu option harus ok`);
    }
    if (verdicts.size < 2) problems.push(`content.contrasts[${index}]: verdict tidak membentuk kontras`);
  });
  if (comparison.ai?.doubt != null && comparison.ai.doubt.length > LIMITS.doubtLength) {
    problems.push(`ai.doubt terlalu panjang (maks ${LIMITS.doubtLength} karakter)`);
  }
  return problems;
}

export function recomputePointOrders(pointFiles, manifest) {
  const deckOrder = new Map(manifest.decks.map((deck) => [deck.key, deck.order]));
  const position = new Map();
  const slides = [...manifest.slides].sort((left, right) => {
    const levelDifference = LEVELS.indexOf(left.level) - LEVELS.indexOf(right.level);
    if (levelDifference !== 0) return levelDifference;
    const deckDifference = (deckOrder.get(left.deck) ?? 9999) - (deckOrder.get(right.deck) ?? 9999);
    if (deckDifference !== 0) return deckDifference;
    return left.sequence - right.sequence;
  });

  for (const slide of slides) {
    slide.points.forEach((key, index) => {
      if (!position.has(key)) {
        position.set(key, [deckOrder.get(slide.deck) ?? 9999, slide.sequence, index]);
      }
    });
  }

  for (const level of LEVELS) {
    const file = pointFiles.get(level);
    file.points.sort((left, right) => {
      const leftPosition = position.get(left.key) ?? [9999, left.order, 0];
      const rightPosition = position.get(right.key) ?? [9999, right.order, 0];
      for (let index = 0; index < leftPosition.length; index += 1) {
        if (leftPosition[index] !== rightPosition[index]) return leftPosition[index] - rightPosition[index];
      }
      return left.key.localeCompare(right.key);
    });
    file.points.forEach((point, index) => {
      point.order = index + 1;
    });
  }
}

const ROMAJI_DIGRAPHS = {
  きゃ: "kya", きゅ: "kyu", きょ: "kyo", ぎゃ: "gya", ぎゅ: "gyu", ぎょ: "gyo",
  しゃ: "sha", しゅ: "shu", しょ: "sho", じゃ: "ja", じゅ: "ju", じょ: "jo",
  ちゃ: "cha", ちゅ: "chu", ちょ: "cho", にゃ: "nya", にゅ: "nyu", にょ: "nyo",
  ひゃ: "hya", ひゅ: "hyu", ひょ: "hyo", びゃ: "bya", びゅ: "byu", びょ: "byo",
  ぴゃ: "pya", ぴゅ: "pyu", ぴょ: "pyo", みゃ: "mya", みゅ: "myu", みょ: "myo",
  りゃ: "rya", りゅ: "ryu", りょ: "ryo", てぃ: "ti", でぃ: "di", ふぁ: "fa", ふぃ: "fi",
  ふぇ: "fe", ふぉ: "fo", うぃ: "wi", うぇ: "we", うぉ: "wo", しぇ: "she", じぇ: "je",
  ちぇ: "che", つぁ: "tsa", つぃ: "tsi", つぇ: "tse", つぉ: "tso",
};

const ROMAJI_KANA = {
  あ: "a", い: "i", う: "u", え: "e", お: "o", か: "ka", き: "ki", く: "ku", け: "ke", こ: "ko",
  が: "ga", ぎ: "gi", ぐ: "gu", げ: "ge", ご: "go", さ: "sa", し: "shi", す: "su", せ: "se", そ: "so",
  ざ: "za", じ: "ji", ず: "zu", ぜ: "ze", ぞ: "zo", た: "ta", ち: "chi", つ: "tsu", て: "te", と: "to",
  だ: "da", ぢ: "ji", づ: "zu", で: "de", ど: "do", な: "na", に: "ni", ぬ: "nu", ね: "ne", の: "no",
  は: "ha", ひ: "hi", ふ: "fu", へ: "he", ほ: "ho", ば: "ba", び: "bi", ぶ: "bu", べ: "be", ぼ: "bo",
  ぱ: "pa", ぴ: "pi", ぷ: "pu", ぺ: "pe", ぽ: "po", ま: "ma", み: "mi", む: "mu", め: "me", も: "mo",
  や: "ya", ゆ: "yu", よ: "yo", ら: "ra", り: "ri", る: "ru", れ: "re", ろ: "ro", わ: "wa", ゐ: "i",
  ゑ: "e", を: "o", ん: "n", ゔ: "vu", ぁ: "a", ぃ: "i", ぅ: "u", ぇ: "e", ぉ: "o",
};

export function toRomaji(value) {
  const text = toHiragana(value.normalize("NFKC"));
  let result = "";
  let geminate = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === "っ") {
      geminate = true;
      continue;
    }
    if (char === "ー") {
      const vowel = result.match(/[aeiou](?!.*[aeiou])/g)?.at(-1);
      if (vowel) result += vowel;
      continue;
    }
    const pair = text.slice(index, index + 2);
    let syllable = ROMAJI_DIGRAPHS[pair];
    if (syllable) index += 1;
    else syllable = ROMAJI_KANA[char] ?? char;
    if (geminate && /^[bcdfghjkmprstvwxyz]/.test(syllable)) syllable = syllable[0] + syllable;
    geminate = false;
    result += syllable;
  }
  return result
    .replace(/[~〜～・()（）]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeTitle(value) {
  return value
    .normalize("NFKC")
    .replace(/[~〜～\s・()（）]/g, "")
    .toLowerCase();
}

export function toBunpouRow(level, point) {
  const titlePlain = stripJapaneseMarkup(point.content.title);
  const titleReading = readingFromMarkup(point.content.title);
  const titleRomaji = toRomaji(titleReading);
  const searchText = [
    titlePlain,
    titleReading,
    titleRomaji,
    point.content.meaningId,
    point.content.meaningEn,
    ...point.content.variants.map(stripJapaneseMarkup),
  ]
    .join(" ")
    .normalize("NFKC")
    .toLowerCase();

  return {
    key: point.key,
    level,
    order: point.order,
    kind: point.kind.toUpperCase(),
    sectionKey: point.sectionKey,
    family: point.family,
    title: point.content.title,
    titlePlain,
    titleReading,
    titleRomaji,
    meaningId: point.content.meaningId.trim(),
    meaningEn: point.content.meaningEn.trim(),
    searchText,
    content: point.content,
    tags: point.content.tags,
    source: point.source,
    extract: point.extract,
    aiModel: point.ai.model,
    promptVersion: point.ai.promptVersion,
    generatedAt: point.ai.generatedAt,
    review: point.review,
  };
}

export function mergeUniqueStrings(left, right) {
  return [...new Set([...left, ...right].map((item) => item.trim()).filter(Boolean))];
}

export function mergeDoubts(left, right) {
  const values = mergeUniqueStrings(left ? [left] : [], right ? [right] : []);
  return values.length > 0 ? values.join("; ").slice(0, LIMITS.doubtLength) : null;
}

export async function fileToDataUrl(file, extension) {
  const mime = extension === "jpg" || extension === "jpeg" ? "image/jpeg" : `image/${extension}`;
  return `data:${mime};base64,${(await fs.readFile(file)).toString("base64")}`;
}
