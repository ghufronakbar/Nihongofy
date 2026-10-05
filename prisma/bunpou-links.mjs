// Shared contract for Bunpou question links (Phase B): catalog lookup, the
// nearest-level rule, and fixture validation. Documented in
// docs/seed-bunpou.md ("Langkah 4" and the question-links format).

import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { DATA_DIR, LEVELS } from "./bunpou-data.mjs";
import { readingFromMarkup, stripJapaneseMarkup, toHiragana } from "./japanese-markup-check.mjs";

export const LINKS_DIR = path.join(DATA_DIR, "question-links");

// B1: soal yang menguji grammar. B2 (bacaan dokkai) ditautkan per konteks.
export const LINKED_QUESTION_TYPES = [
  "BUNPOU_GRAMMAR",
  "BUNPOU_SENTENCE_COMPOSITION",
  "BUNPOU_TEXT_GRAMMAR",
];
export const NO_DISTRACTOR_TYPES = ["BUNPOU_SENTENCE_COMPOSITION"];

export const LINK_LIMITS = {
  questionPatterns: 8,
  contextPatterns: 5,
  keysPerRole: 3,
  candidates: 20,
  partialMinLength: 2,
  formLength: 40,
  meaningLength: 120,
  noteLength: 300,
  excerptLength: 120,
};

const FORMATION_INDEXED_KINDS = new Set(["conjugation", "foundation"]);

const keySchema = z.string().min(1).max(80);

const aiMetaSchema = z.object({
  model: z.string().min(1),
  promptVersion: z.string().min(1),
  generatedAt: z.iso.datetime({ offset: true }),
});

const basePatternSchema = z.object({
  form: z.string().trim().min(1).max(LINK_LIMITS.formLength),
  reading: z.string().trim().min(1).max(LINK_LIMITS.formLength),
  meaning: z.string().trim().min(1).max(LINK_LIMITS.meaningLength),
  candidates: z.array(keySchema).max(LINK_LIMITS.candidates),
  key: keySchema.nullable(),
});

const questionPatternSchema = basePatternSchema.extend({
  role: z.enum(["tested", "distractor"]),
});

const contextPatternSchema = basePatternSchema.extend({
  role: z.literal("appears"),
  excerpt: z.string().trim().min(1).max(LINK_LIMITS.excerptLength),
});

const confidenceSchema = z.enum(["high", "low"]).nullable();

const questionLinkSchema = z.object({
  mondaiType: z.enum(LINKED_QUESTION_TYPES),
  order: z.number().int().positive(),
  patterns: z.array(questionPatternSchema).max(LINK_LIMITS.questionPatterns),
  confidence: confidenceSchema,
  note: z.string().max(LINK_LIMITS.noteLength).nullable(),
  ai: aiMetaSchema,
});

const contextLinkSchema = z.object({
  ref: z.string().min(1),
  patterns: z.array(contextPatternSchema).max(LINK_LIMITS.contextPatterns),
  confidence: confidenceSchema,
  note: z.string().max(LINK_LIMITS.noteLength).nullable(),
  ai: aiMetaSchema,
});

export const linkFileSchema = z.object({
  package: z.string().min(1),
  questions: z.array(questionLinkSchema),
  contexts: z.array(contextLinkSchema).default([]),
});

export function questionId(mondaiType, order) {
  return `${mondaiType}#${order}`;
}

export function linkFileOf(packageFile) {
  return path.join(LINKS_DIR, `${packageFile}.json`);
}

export async function readLinkFile(packageFile, packageName) {
  let raw;
  try {
    raw = await fs.readFile(linkFileOf(packageFile), "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return { package: packageName, questions: [], contexts: [] };
    throw error;
  }
  const parsed = linkFileSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`question-links/${packageFile}.json tidak valid: ${issue?.path.join(".")}: ${issue?.message}`);
  }
  return parsed.data;
}

export async function readAllLinkFiles() {
  let entries;
  try {
    entries = await fs.readdir(LINKS_DIR);
  } catch (error) {
    if (error?.code === "ENOENT") return new Map();
    throw error;
  }
  const files = new Map();
  for (const name of entries.filter((entry) => entry.endsWith(".json")).sort()) {
    const packageFile = name.slice(0, -".json".length);
    files.set(packageFile, await readLinkFile(packageFile, null));
  }
  return files;
}

export async function writeLinkFile(packageFile, file) {
  const parsed = linkFileSchema.safeParse(file);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`question-links/${packageFile}.json tidak ditulis: ${issue?.path.join(".")}: ${issue?.message}`);
  }
  const target = linkFileOf(packageFile);
  await fs.mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(parsed.data, null, 2)}\n`, "utf8");
  await fs.rename(temporary, target);
}

// ---------------------------------------------------------------------------
// Normalisasi bentuk dan lookup katalog
// ---------------------------------------------------------------------------

/**
 * Bentuk pola yang bisa dibandingkan: tanpa markup, NFKC, katakana → hiragana,
 * tanpa 〜, spasi, tanda baca, dan placeholder Latin (V, N, A).
 */
export function normalizeForm(value) {
  return toHiragana(stripJapaneseMarkup(value).normalize("NFKC"))
    .replace(/[\x00-\x7F〜～・（）「」『』【】…。、！？：＋\s]/g, "");
}

function alternatives(value) {
  return value.split(/[／/]/).map((part) => part.trim()).filter(Boolean);
}

/** Semua bentuk ternormalisasi dari teks bermarkup: tulisan dan bacaannya. */
export function formsOf(value) {
  const forms = new Set();
  for (const part of alternatives(value)) {
    for (const form of [normalizeForm(part), normalizeForm(readingFromMarkup(part))]) {
      if (form) forms.add(form);
    }
  }
  return forms;
}

const I_TO_U = { い: "う", き: "く", ぎ: "ぐ", し: "す", ち: "つ", に: "ぬ", び: "ぶ", み: "む", り: "る" };

/**
 * Turunan bentuk kamus dari bentuk sopan, karena katalog N5 menulis
 * 〜に行きます sedangkan model menulis bentuk kamus 〜に行く. Golongan kata
 * kerja tidak diketahui, jadi kedua kemungkinan (godan dan ichidan) dibuat;
 * turunan yang keliru tidak berbahaya karena tidak akan cocok dengan apa pun.
 */
export function plainVariants(form) {
  const variants = [];
  if (form.endsWith("です") && form.length > 2) variants.push(form.slice(0, -2));
  if (form.endsWith("ます") && form.length > 2) {
    const stem = form.slice(0, -2);
    variants.push(`${stem}る`);
    const godan = I_TO_U[stem.at(-1)];
    if (godan) variants.push(`${stem.slice(0, -1)}${godan}`);
  }
  return variants;
}

function withPlainVariants(forms) {
  for (const form of [...forms]) for (const variant of plainVariants(form)) forms.add(variant);
  return forms;
}

/**
 * Bentuk pencarian: seperti formsOf, ditambah bentuk tanpa bagian berkurung
 * (〜し（〜し） → し) dan tiap segmen pola majemuk (〜や〜など → や, など).
 * Dipakai untuk query maupun judul katalog.
 */
export function searchFormsOf(value) {
  const forms = formsOf(value);
  for (const part of alternatives(value)) {
    const bare = part.replace(/[（(][^）)]*[）)]/g, "");
    if (bare !== part) for (const form of formsOf(bare)) forms.add(form);
    const segments = bare.split(/[〜~～]/).filter((segment) => segment.trim());
    if (segments.length < 2) continue;
    for (const segment of segments) for (const form of formsOf(segment)) forms.add(form);
  }
  return withPlainVariants(forms);
}

export function levelDistance(left, right) {
  return Math.abs(LEVELS.indexOf(left) - LEVELS.indexOf(right));
}

// Urutan kedekatan ke level paket: jarak terkecil, lalu level yang lebih rendah
// (N5 paling rendah). LEVELS diurutkan N5 → N1, jadi index kecil = level rendah.
function compareByLevel(packageLevel) {
  return (left, right) =>
    levelDistance(left.level, packageLevel) - levelDistance(right.level, packageLevel) ||
    LEVELS.indexOf(left.level) - LEVELS.indexOf(right.level) ||
    left.order - right.order;
}

/**
 * Indeks katalog untuk lookup. Hanya point yang punya `content`, karena tahap
 * pemilihan makna butuh arti dan senseLabel.
 */
export function buildCatalogIndex(pointFiles) {
  const points = new Map();
  for (const [level, file] of pointFiles) {
    for (const point of file.points) {
      if (!point.content) continue;
      const forms = new Set([...searchFormsOf(point.content.title), ...searchFormsOf(point.title)]);
      for (const variant of point.content.variants) for (const form of searchFormsOf(variant)) forms.add(form);
      // Entri konjugasi berjudul nama bentuk (使役形), bukan bentuknya, jadi
      // contoh hasil di tabel formation (食べさせる) dipakai untuk pencarian.
      if (FORMATION_INDEXED_KINDS.has(point.kind)) {
        // た形 → た, ます形 → ます: model menyebut konjugasi lewat akhirannya.
        for (const form of [...forms]) if (form.length > 1 && form.endsWith("形")) forms.add(form.slice(0, -1));
        for (const row of point.content.formation) {
          for (const output of row.output.split(/[；;、,＋+]/)) for (const form of formsOf(output)) forms.add(form);
        }
      }
      withPlainVariants(forms);
      points.set(point.key, {
        key: point.key,
        level,
        order: point.order,
        kind: point.kind,
        family: point.family,
        title: stripJapaneseMarkup(point.content.title),
        variants: point.content.variants.map(stripJapaneseMarkup),
        titleForms: formsOf(point.content.title),
        senseLabel: point.content.senseLabel ?? null,
        meaningId: point.content.meaningId,
        forms,
      });
    }
  }
  return { points };
}

export function catalogLevels(index) {
  return new Set([...index.points.values()].map((point) => point.level));
}

/**
 * Kandidat untuk satu pola hasil identifikasi. Kecocokan persis didahulukan dan
 * diperluas ke family yang sama; kecocokan sebagian (salah satu bentuk memuat
 * yang lain, minimal 2 karakter) ditambahkan sesudahnya.
 */
export function lookupCandidates(index, { form, reading }, packageLevel) {
  const queries = new Set([...searchFormsOf(form), ...searchFormsOf(reading)]);
  const { primary, partial } = lookupByForms(index, queries, packageLevel);
  const keys = [...primary];

  // Model kadang menggabungkan partikel dengan kata di soal (〜にもらう, 〜の間)
  // walau prompt melarangnya. Bila tidak ada kecocokan persis, pisahkan
  // partikel di depan. Kecocokan persis sisa bentuk didahulukan (〜の間 → 間),
  // lalu partikelnya, baru kecocokan sebagian keduanya.
  if (primary.length === 0) {
    const splits = [];
    for (const query of queries) {
      const particle = LEADING_PARTICLES.find((candidate) => query.startsWith(candidate) && query.length > candidate.length);
      if (!particle) continue;
      splits.push({
        rest: lookupByForms(index, new Set([query.slice(particle.length)]), packageLevel),
        particle: lookupByForms(index, new Set([particle]), packageLevel),
      });
    }
    const ordered = [
      ...splits.flatMap((split) => split.rest.primary),
      ...splits.flatMap((split) => split.particle.primary),
      ...splits.flatMap((split) => split.rest.partial),
      ...splits.flatMap((split) => split.particle.partial),
    ];
    for (const key of ordered) if (!keys.includes(key)) keys.push(key);
  }
  for (const key of partial) if (!keys.includes(key)) keys.push(key);
  return keys.slice(0, LINK_LIMITS.candidates);
}

// Partikel majemuk didahulukan supaya から tidak terbaca sebagai か + ら.
const LEADING_PARTICLES = ["から", "まで", "より", "を", "に", "で", "が", "は", "と", "へ", "も", "の"];

function lookupByForms(index, queries, packageLevel) {
  if (queries.size === 0) return { primary: [], partial: [] };
  const byLevel = compareByLevel(packageLevel);
  const all = [...index.points.values()];

  const exact = all.filter((point) => [...queries].some((query) => point.forms.has(query)));
  const families = new Set(exact.map((point) => point.family).filter(Boolean));
  const familyMembers = all.filter((point) => point.family && families.has(point.family));
  const primary = [...new Set([...exact, ...familyMembers])].sort(byLevel);

  const taken = new Set(primary.map((point) => point.key));
  const overlap = (point) => {
    let best = 0;
    for (const query of queries) {
      for (const candidate of point.forms) {
        const shorter = Math.min(query.length, candidate.length);
        if (shorter < LINK_LIMITS.partialMinLength) continue;
        if (query.includes(candidate) || candidate.includes(query)) best = Math.max(best, shorter);
      }
    }
    return best;
  };
  const partial = all
    .filter((point) => !taken.has(point.key))
    .map((point) => ({ point, score: overlap(point) }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || byLevel(left.point, right.point))
    .map(({ point }) => point);

  return { primary: primary.map((point) => point.key), partial: partial.map((point) => point.key) };
}

function sameSense(left, right) {
  if (left.senseLabel !== right.senseLabel) return false;
  if (left.titleForms.size !== right.titleForms.size) return false;
  return [...left.titleForms].every((form) => right.titleForms.has(form));
}

/**
 * Aturan level terdekat: bila makna yang sama (judul ternormalisasi dan
 * senseLabel sama) tercatat di beberapa level, pakai entri terdekat ke level
 * paket. Mengembalikan key pengganti, atau key asal bila sudah terdekat.
 */
export function nearestLevelKey(index, key, packageLevel) {
  const chosen = index.points.get(key);
  if (!chosen) return key;
  const siblings = [...index.points.values()].filter((point) => sameSense(point, chosen));
  return siblings.sort(compareByLevel(packageLevel))[0]?.key ?? key;
}

// ---------------------------------------------------------------------------
// Data soal dari fixture paket
// ---------------------------------------------------------------------------

/** Soal B1 dari fixture paket, dalam urutan fixture. */
export function linkedQuestionsOf(pkg) {
  const questions = [];
  for (const item of pkg.testPackageItems) {
    if (!LINKED_QUESTION_TYPES.includes(item.mondaiType)) continue;
    for (const question of item.questions) {
      questions.push({ id: questionId(item.mondaiType, question.order), item, question });
    }
  }
  return questions;
}

export function explanationOf(question) {
  const explanation = question.explanation;
  if (!explanation) return null;
  if (typeof explanation === "string") return { summary: explanation, detail: null, keyPoints: [] };
  return explanation;
}

/** Teks soal, pilihan, dan bacaan (masih bermarkup) untuk pemeriksaan kemunculan bentuk. */
export function questionSurfaceText(pkg, question) {
  const context = question.questionContextRef
    ? pkg.questionContexts?.find((candidate) => candidate.id === question.questionContextRef)
    : null;
  return [
    question.questionText,
    ...question.questionChoices.map((choice) => choice.answerText),
    context?.storyText ?? "",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Validasi
// ---------------------------------------------------------------------------

export function derivedKeys(record) {
  const tested = new Set();
  const distractor = new Set();
  for (const pattern of record.patterns) {
    if (!pattern.key) continue;
    (pattern.role === "tested" ? tested : distractor).add(pattern.key);
  }
  return { tested: [...tested], distractor: [...distractor] };
}

/** Masalah aturan peran dan key untuk satu catatan soal (tanpa cek fixture paket). */
export function questionLinkProblems(record, index) {
  const problems = [];
  if (NO_DISTRACTOR_TYPES.includes(record.mondaiType) && record.patterns.some((pattern) => pattern.role === "distractor")) {
    problems.push("soal 並べ替え tidak boleh punya distractor");
  }
  for (const role of ["tested", "distractor"]) {
    const count = record.patterns.filter((pattern) => pattern.role === role).length;
    if (count > LINK_LIMITS.keysPerRole) problems.push(`${role} lebih dari ${LINK_LIMITS.keysPerRole} pola`);
  }
  for (const [position, pattern] of record.patterns.entries()) {
    if (!normalizeForm(pattern.form)) problems.push(`patterns.${position}: form kosong setelah normalisasi`);
    if (pattern.key === null) continue;
    if (!pattern.candidates.includes(pattern.key)) {
      problems.push(`patterns.${position}: key ${pattern.key} bukan salah satu candidates`);
    }
    if (index && !index.points.has(pattern.key)) {
      problems.push(`patterns.${position}: key ${pattern.key} tidak ada di katalog`);
    }
  }
  const { tested, distractor } = derivedKeys(record);
  const both = tested.filter((key) => distractor.includes(key));
  if (both.length > 0) problems.push(`key dipakai sebagai tested dan distractor: ${both.join(", ")}`);
  const hasKey = tested.length + distractor.length > 0;
  if (hasKey && record.confidence === null) problems.push("confidence wajib diisi bila ada key");
  if (!hasKey && record.confidence !== null) problems.push("confidence harus null bila tidak ada key");
  return problems;
}

/** Validasi satu file tautan terhadap fixture paket dan katalog. */
export function linkFileProblems(file, pkg, index) {
  const problems = [];
  if (file.package !== pkg.name) problems.push(`package "${file.package}" ≠ fixture "${pkg.name}"`);

  const questions = new Map(linkedQuestionsOf(pkg).map((entry) => [entry.id, entry]));
  const seen = new Set();
  for (const record of file.questions) {
    const id = questionId(record.mondaiType, record.order);
    if (seen.has(id)) problems.push(`${id}: soal ganda`);
    seen.add(id);
    if (!questions.has(id)) problems.push(`${id}: soal tidak ada di fixture paket`);
    for (const problem of questionLinkProblems(record, index)) problems.push(`${id}: ${problem}`);
  }

  const dokkaiRefs = new Set(
    pkg.testPackageItems
      .filter((item) => item.mondaiType.startsWith("DOKKAI_"))
      .flatMap((item) => item.questions.map((question) => question.questionContextRef).filter(Boolean)),
  );
  const seenRefs = new Set();
  for (const record of file.contexts) {
    if (seenRefs.has(record.ref)) problems.push(`${record.ref}: konteks ganda`);
    seenRefs.add(record.ref);
    if (!dokkaiRefs.has(record.ref)) problems.push(`${record.ref}: bukan konteks soal dokkai di fixture`);
    for (const [position, pattern] of record.patterns.entries()) {
      if (pattern.key === null) continue;
      if (!pattern.candidates.includes(pattern.key)) {
        problems.push(`${record.ref}: patterns.${position}: key ${pattern.key} bukan salah satu candidates`);
      }
      if (index && !index.points.has(pattern.key)) {
        problems.push(`${record.ref}: patterns.${position}: key ${pattern.key} tidak ada di katalog`);
      }
    }
    const hasKey = record.patterns.some((pattern) => pattern.key);
    if (hasKey === (record.confidence === null)) {
      problems.push(`${record.ref}: confidence harus null tepat ketika tidak ada key`);
    }
  }
  return problems;
}
