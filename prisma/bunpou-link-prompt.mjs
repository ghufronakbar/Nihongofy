// Prompts for gen:bunpou-links. Stage 1 identifies the grammar a question tests
// without seeing the catalog; stage 2 picks the catalog sense from the
// candidates found by the script lookup in between.

import { z } from "zod";
import { LINK_LIMITS, NO_DISTRACTOR_TYPES, explanationOf, normalizeForm } from "./bunpou-links.mjs";
import { stripJapaneseMarkup } from "./japanese-markup-check.mjs";

export const PROMPT_VERSION = "bunpou-link-v1";

function stripCodeFence(value) {
  const trimmed = value.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
}

function parseReply(raw, schema) {
  let json;
  try {
    json = JSON.parse(stripCodeFence(raw));
  } catch (error) {
    return { error: `keluaran bukan JSON valid: ${error.message}` };
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: `${issue?.path.join(".") || "root"}: ${issue?.message}` };
  }
  const items = new Map();
  for (const item of parsed.data.items) {
    if (items.has(item.id)) return { error: `id ganda dalam keluaran: ${item.id}` };
    items.set(item.id, item);
  }
  return { items };
}

export function buildRetryPrompt(failures) {
  return [
    "Keluaran ditolak validator. Tulis ulang JSON lengkap hanya untuk item berikut:",
    ...failures.map(({ id, problems }) => `- ${id}: ${problems.join("; ")}`),
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Tahap 1 — identifikasi
// ---------------------------------------------------------------------------

const identifyReplySchema = z.object({
  items: z.array(
    z.object({
      id: z.string().min(1),
      patterns: z.array(
        z.object({
          form: z.string(),
          reading: z.string(),
          meaning: z.string(),
          role: z.enum(["tested", "distractor"]),
        }),
      ),
    }),
  ),
});

export function parseIdentifyReply(raw) {
  return parseReply(raw, identifyReplySchema);
}

export const IDENTIFY_SYSTEM_PROMPT = `Anda pengajar JLPT yang menganalisis soal bunpou (文法) asli JLPT.

Untuk setiap soal, sebutkan pola grammar yang diuji:
- tested: pola yang harus dipahami untuk memilih jawaban benar, yaitu pola di jawaban benar atau pola di kalimat yang menentukan jawaban. Untuk soal 並べ替え (BUNPOU_SENTENCE_COMPOSITION), pola yang membentuk susunan kalimat yang benar.
- distractor: pola grammar di pilihan salah yang bisa dikira benar. Tidak ada distractor untuk soal 並べ替え.

ATURAN:
- Hanya grammar: partikel, pola kalimat, bentuk konjugasi bermakna (pasif, kausatif, potensial, dsb.), ungkapan gramatikal, kata sambung, dan adverbia fungsional (まだ, もう, ぜひ). Kosakata biasa (宿題, 大きい, 手伝う, いつも, たくさん) bukan pola; pilihan salah yang hanya kosakata tidak dijadikan distractor.
- Partikel ditulis sendiri sebagai form (を, に, で), bukan digabung dengan kata kerja di soal (bukan 〜を出る atau 〜に会う). Gabungkan hanya bila gabungan itu memang pola baku (〜に行く untuk tujuan, 〜をもらう).
- Maksimal ${LINK_LIMITS.keysPerRole} tested dan ${LINK_LIMITS.keysPerRole} distractor per soal. Pilih yang benar-benar menentukan, bukan semua grammar yang kebetulan muncul di kalimat.
- Boleh kosong bila soal tidak menguji grammar. Jangan memaksakan.
- Jangan membatasi diri pada level paket: soal N4 boleh menguji pola yang biasanya diajarkan di N3.
- form: bentuk baku pola seperti di buku grammar, diawali 〜 bila menempel ke kata lain, tanpa placeholder Latin (tulis 〜てしまう, 〜ように, 〜によって, で, つまり; bukan "Vてしまう"). Tulis bentuk kamus, bukan bentuk terkonjugasi di soal (〜てしまう, bukan 〜てしまいました). Kanji boleh dipakai tanpa furigana.
- reading: bacaan form dalam hiragana penuh, tanpa 〜.
- meaning: arti singkat dalam bahasa Indonesia dari makna yang dipakai di soal ini (maksimal ${LINK_LIMITS.meaningLength} karakter), cukup spesifik untuk membedakan makna lain dari bentuk yang sama (mis. で "tempat aktivitas" vs で "alat/cara").
- Teks soal sudah tanpa furigana. [_] dan [★] adalah slot kosong; pembahasan disertakan sebagai bantuan.

KELUARAN JSON MURNI:
{
  "items": [
    {
      "id": "BUNPOU_GRAMMAR#5",
      "patterns": [
        { "form": "〜てしまう", "reading": "てしまう", "meaning": "menyesal karena sudah terjadi", "role": "tested" }
      ]
    }
  ]
}

Keluarkan tepat satu item per soal input dan tidak ada teks di luar JSON.`;

function plain(value) {
  return value ? stripJapaneseMarkup(value).trim() : null;
}

export function identifyInput(pkg, entry) {
  const { item, question } = entry;
  const explanation = explanationOf(question);
  return {
    id: entry.id,
    mondaiType: item.mondaiType,
    instruction: plain(item.instruction),
    passage: question.questionContextRef ?? null,
    question: plain(question.questionText),
    choices: Object.fromEntries(
      question.questionChoices.map((choice) => [choice.codeAnswer, plain(choice.answerText)]),
    ),
    answer: question.questionAnswer,
    explanation: explanation
      ? {
          summary: plain(explanation.summary),
          detail: plain(explanation.detail),
          translation: plain(explanation.translation),
          keyPoints: (explanation.keyPoints ?? []).map(plain),
        }
      : null,
  };
}

export function buildIdentifyPrompt(pkg, entries) {
  const refs = [...new Set(entries.map((entry) => entry.question.questionContextRef).filter(Boolean))];
  const passages = Object.fromEntries(
    refs.map((ref) => [ref, plain(pkg.questionContexts?.find((context) => context.id === ref)?.storyText)]),
  );
  return [
    `Paket: ${pkg.name} (level ${pkg.jlptLevel}).`,
    refs.length > 0 ? `Bacaan yang dirujuk soal:\n${JSON.stringify(passages, null, 2)}` : null,
    `Soal:\n${JSON.stringify(entries.map((entry) => identifyInput(pkg, entry)), null, 2)}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

const HIRAGANA_READING = /^[ぁ-ゖー〜～・／/\s]+$/;

export function identifyProblems(entry, item) {
  const problems = [];
  const seen = new Set();
  for (const [position, pattern] of item.patterns.entries()) {
    const label = `patterns.${position}`;
    if (!normalizeForm(pattern.form)) problems.push(`${label}: form kosong`);
    if (pattern.form.length > LINK_LIMITS.formLength) problems.push(`${label}: form terlalu panjang`);
    if (!HIRAGANA_READING.test(pattern.reading)) problems.push(`${label}: reading harus hiragana`);
    if (!pattern.meaning.trim()) problems.push(`${label}: meaning kosong`);
    if (pattern.meaning.length > LINK_LIMITS.meaningLength) problems.push(`${label}: meaning terlalu panjang`);
    const identity = `${pattern.role}:${normalizeForm(pattern.form)}`;
    if (seen.has(identity)) problems.push(`${label}: pola ganda dengan peran sama`);
    seen.add(identity);
  }
  for (const role of ["tested", "distractor"]) {
    if (item.patterns.filter((pattern) => pattern.role === role).length > LINK_LIMITS.keysPerRole) {
      problems.push(`${role} lebih dari ${LINK_LIMITS.keysPerRole}`);
    }
  }
  if (
    NO_DISTRACTOR_TYPES.includes(entry.item.mondaiType) &&
    item.patterns.some((pattern) => pattern.role === "distractor")
  ) {
    problems.push("soal 並べ替え tidak boleh punya distractor");
  }
  return problems;
}

// ---------------------------------------------------------------------------
// Tahap 2 — pemilihan makna
// ---------------------------------------------------------------------------

const selectReplySchema = z.object({
  items: z.array(
    z.object({
      id: z.string().min(1),
      choices: z.array(z.object({ index: z.number().int().min(0), key: z.string().nullable() })),
      confidence: z.enum(["high", "low"]),
      note: z.string().nullable(),
    }),
  ),
});

export function parseSelectReply(raw) {
  return parseReply(raw, selectReplySchema);
}

export const SELECT_SYSTEM_PROMPT = `Anda pengajar JLPT yang mencocokkan pola grammar di soal JLPT asli dengan entri katalog grammar.

Setiap soal berisi daftar pola yang sudah diidentifikasi (form, arti di soal, peran) beserta kandidat entri katalog hasil pencarian bentuk. Satu bentuk bisa punya beberapa entri dengan makna berbeda (mis. 〜で untuk tempat, alat, alasan, bahan).

ATURAN:
- Untuk setiap pola, pilih satu key dari candidates miliknya yang maknanya sama dengan pemakaian di soal, atau null bila tidak ada kandidat yang maknanya sesuai.
- variants adalah bentuk lain dari entri yang sama (mis. entri 〜により dengan variants 〜によって); pola yang cocok dengan variants sama sahnya dengan yang cocok dengan title.
- Bentuk mirip tidak cukup; makna dan fungsinya harus sesuai. Kandidat hasil kecocokan sebagian (mis. 〜ようになる untuk pola 〜ように) hanya dipilih bila memang itu pola yang dipakai.
- Bila beberapa kandidat menjelaskan makna yang sama di level berbeda, pilih yang levelnya paling dekat dengan level paket; bila jaraknya sama, pilih level yang lebih rendah.
- Satu key tidak boleh dipakai sebagai tested sekaligus distractor dalam satu soal.
- confidence: "high" bila setiap pilihan (termasuk null) jelas benar; "low" bila ada keraguan.
- note: alasan singkat (maksimal ${LINK_LIMITS.noteLength} karakter) bila confidence low atau ada pola yang null padahal kandidatnya ada; selain itu null.

KELUARAN JSON MURNI:
{
  "items": [
    {
      "id": "BUNPOU_GRAMMAR#5",
      "choices": [ { "index": 0, "key": "te-shimau-penyesalan" } ],
      "confidence": "high",
      "note": null
    }
  ]
}

choices berisi tepat satu entri untuk setiap index pola yang dikirim. Keluarkan tepat satu item per soal input dan tidak ada teks di luar JSON.`;

/**
 * @param {object} pkg fixture paket
 * @param {Array<{ entry, patterns }>} items patterns: hasil tahap 1 + candidates
 * @param {{ points: Map }} index katalog
 */
export function buildSelectPrompt(pkg, items, index) {
  const keys = new Set(items.flatMap(({ patterns }) => patterns.flatMap((pattern) => pattern.candidates)));
  const catalog = Object.fromEntries(
    [...keys].map((key) => {
      const point = index.points.get(key);
      return [
        key,
        {
          level: point.level,
          title: point.title,
          ...(point.variants.length > 0 ? { variants: point.variants } : {}),
          senseLabel: point.senseLabel,
          meaning: point.meaningId,
        },
      ];
    }),
  );
  const questions = items.map(({ entry, patterns }) => ({
    id: entry.id,
    question: plain(entry.question.questionText),
    choices: Object.fromEntries(
      entry.question.questionChoices.map((choice) => [choice.codeAnswer, plain(choice.answerText)]),
    ),
    answer: entry.question.questionAnswer,
    summary: plain(explanationOf(entry.question)?.summary),
    patterns: patterns
      .map((pattern, position) => ({ index: position, ...pattern }))
      .filter((pattern) => pattern.candidates.length > 0)
      .map(({ index: position, form, meaning, role, candidates }) => ({ index: position, form, meaning, role, candidates })),
  }));
  return [
    `Paket: ${pkg.name} (level ${pkg.jlptLevel}).`,
    `Entri katalog:\n${JSON.stringify(catalog, null, 2)}`,
    `Soal:\n${JSON.stringify(questions, null, 2)}`,
  ].join("\n\n");
}

/** Index pola yang wajib dijawab di tahap 2 (yang punya kandidat). */
export function selectableIndexes(patterns) {
  return patterns.flatMap((pattern, position) => (pattern.candidates.length > 0 ? [position] : []));
}

export function selectProblems(patterns, item) {
  const problems = [];
  const expected = selectableIndexes(patterns);
  const answered = new Map();
  for (const choice of item.choices) {
    if (answered.has(choice.index)) problems.push(`index ${choice.index} ganda`);
    answered.set(choice.index, choice.key);
  }
  for (const position of expected) {
    if (!answered.has(position)) problems.push(`index ${position} belum dijawab`);
  }
  for (const [position, key] of answered) {
    if (!expected.includes(position)) {
      problems.push(`index ${position} tidak dikirim`);
      continue;
    }
    if (key !== null && !patterns[position].candidates.includes(key)) {
      problems.push(`index ${position}: ${key} bukan salah satu candidates`);
    }
  }
  if (item.note && item.note.length > LINK_LIMITS.noteLength) problems.push("note terlalu panjang");
  return problems;
}
