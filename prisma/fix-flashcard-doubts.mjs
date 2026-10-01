// Peninjau kata flashcard yang ditandai ragu (`ai.doubt`) oleh generator.
// Setiap kata ditinjau sendiri oleh model dengan reasoning tinggi: model
// membaca data sumber, kartu yang sudah ada, dan alasan ragunya, lalu memilih
// satu keputusan:
//
//   keep      kartu sudah benar; hanya data sumbernya yang janggal
//   revise    tulisan kata tetap, isi kartu ditulis ulang (bacaan, arti, catatan)
//   replace   entri sumbernya sendiri rusak (mis. 空オケ, 介護士/介護士さん);
//             tulisan + bacaan diganti dan kartunya dibuat ulang dari konteks
//   escalate  model tidak yakin; diputuskan manusia
//
// Dua tahap, supaya keputusan bisa dibaca (dan diedit) sebelum menyentuh
// fixture tanpa membayar model dua kali:
//
//   npm run fix:flashcard-doubts                  # tinjau semua -> tulis rencana
//   npm run fix:flashcard-doubts -- --level N4 --key "吃驚|きっきょう"
//   npm run fix:flashcard-doubts -- --apply       # terapkan rencana ke fixture
//
// Rencana ditulis ke .flashcard-doubt-plan.json (di-gitignore). Hapus entri
// yang tidak disetujui, atau ubah "action"-nya menjadi "escalate", sebelum
// --apply.
//
// Key TIDAK pernah diubah (progres user merujuk key). Keputusan replace
// mengganti `word`/`reading` note; `flashcard:extract` berikutnya akan
// mengembalikannya ke tulisan sumber, dan --apply (tanpa rencana pun)
// memasangnya lagi dari `ai.doubtResolution`. Script ini TIDAK menyentuh
// database.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";
import { z } from "zod";
import {
  LEVELS,
  loadTaxonomy,
  readVocabFile,
  vocabContentProblems,
  vocabContentWarnings,
  writeVocabFile,
} from "./flashcard-vocab.mjs";
import { buildSystemPrompt, replyItemToContent } from "./flashcard-vocab-prompt.mjs";
import { containsKanji, readingFromMarkup, stripJapaneseMarkup, toHiragana } from "./japanese-markup-check.mjs";

const PLAN_FILE = fileURLToPath(new URL("../.flashcard-doubt-plan.json", import.meta.url));
const REQUEST_TIMEOUT_MS = 300_000;
const SDK_MAX_RETRIES = 4;
const MAX_ATTEMPTS = 3;
const MAX_CONCURRENCY = 8;
// Gateway menolak User-Agent bawaan SDK OpenAI dengan 403.
const USER_AGENT = "nihongofy/1.0";
const ACTIONS = ["keep", "revise", "replace", "escalate"];

const envSchema = z.object({
  EXPLANATION_BASE_URL: z.url(),
  EXPLANATION_API_KEY: z.string().trim().min(1),
  EXPLANATION_MODEL: z.string().trim().min(1),
  FLASHCARD_MODEL: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().trim().min(1).optional(),
  ),
});

function log(message) {
  console.log(`[fix:flashcard-doubts] ${message}`);
}

function parseArguments(argv) {
  const options = { level: null, keys: [], apply: false, concurrency: 4, reasoningEffort: "high", model: null };
  const readValue = (argument, name, index) =>
    argument.startsWith(`${name}=`) ? argument.slice(name.length + 1) : argv[index + 1];

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const consumesNext = !argument.includes("=");

    if (argument === "--apply") {
      options.apply = true;
    } else if (argument.startsWith("--level")) {
      const level = readValue(argument, "--level", index)?.toUpperCase();
      if (!LEVELS.includes(level)) throw new Error(`--level harus salah satu dari ${LEVELS.join(", ")}`);
      options.level = level;
      if (consumesNext) index += 1;
    } else if (argument.startsWith("--key")) {
      const key = readValue(argument, "--key", index);
      if (!key || key.startsWith("--")) throw new Error('--key membutuhkan key kata, mis. "吃驚|きっきょう"');
      options.keys.push(key);
      if (consumesNext) index += 1;
    } else if (argument.startsWith("--concurrency")) {
      const value = Number(readValue(argument, "--concurrency", index));
      if (!Number.isInteger(value) || value < 1 || value > MAX_CONCURRENCY) {
        throw new Error(`--concurrency harus bilangan bulat 1-${MAX_CONCURRENCY}`);
      }
      options.concurrency = value;
      if (consumesNext) index += 1;
    } else if (argument.startsWith("--reasoning-effort")) {
      const value = readValue(argument, "--reasoning-effort", index)?.toLowerCase();
      if (!["minimal", "low", "medium", "high"].includes(value)) {
        throw new Error("--reasoning-effort harus minimal|low|medium|high");
      }
      options.reasoningEffort = value;
      if (consumesNext) index += 1;
    } else if (argument.startsWith("--model")) {
      const value = readValue(argument, "--model", index)?.trim();
      if (!value || value.startsWith("--")) throw new Error("--model membutuhkan nama model");
      options.model = value;
      if (consumesNext) index += 1;
    } else {
      throw new Error(`argumen tidak dikenal: ${argument}`);
    }
  }
  return options;
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

// Aturan isi kartu dan daftar tag dipakai ulang dari prompt generator, supaya
// kartu hasil tinjauan lolos validator yang sama. Hanya tugas dan format
// keluarannya yang diganti.
function buildReviewSystemPrompt(taxonomy) {
  return `${buildSystemPrompt(taxonomy)}

=== TUGAS KHUSUS: MENINJAU KATA YANG DITANDAI RAGU ===
Abaikan FORMAT KELUARAN di atas. Kali ini Anda menerima SATU kata yang sebelumnya ditandai ragu (doubt) saat kartunya dibuat. Pikirkan dengan teliti apa yang sebenarnya dimaksud daftar sumber: baca tulisan, bacaan, hints, level, dan kartu yang sudah ada. Lalu pilih SATU keputusan:

- keep: kartu yang ada sudah benar dan berguna bagi pelajar; kejanggalannya hanya di data sumber (mis. bacaan sumber hanya mencatat kata kerjanya padahal kata berupa frasa, dan furigana kartu sudah lengkap).
- revise: tulisan kata sudah benar (atau cukup lazim untuk dipertahankan), tetapi isi kartu perlu diperbaiki — bacaan furigana, arti, contoh, atau catatan. Tulis kartu lengkap yang baru. Tulisan tanpa furigana HARUS persis sama dengan word masukan. Bila hints menunjuk bacaan lain yang sudah ada di "entriMirip" sebagai kata terpisah (mis. key 分別|ふんべつ dengan hints "to sort", sementara 分別|ぶんべつ sudah ada), JANGAN menyalin kata itu: tulis kartu untuk makna bacaan key bila bacaan itu benar dan lazim, atau pilih escalate.
- replace: entri sumber rusak sehingga kartu dengan tulisan itu menyesatkan pelajar (salah ketik, gabungan dua bentuk, penulisan yang praktis tidak dipakai). Tentukan tulisan dan bacaan baku yang dimaksud sumber, lalu tulis kartu lengkap untuk bentuk baku itu. Bentuk baku HARUS sesuai dengan hints dan level. Bila bentuk baku itu sudah ada di "entriMirip" sebagai kata terpisah, JANGAN replace — pilih escalate.
- escalate: Anda tidak yakin apa maksud sumber, atau ada lebih dari satu perbaikan yang masuk akal. Jangan menebak.

Isi confidence dengan high, medium, atau low. revise dan replace dengan confidence low tidak akan diterapkan.

FORMAT KELUARAN TUGAS INI
Hanya JSON, tanpa teks lain dan tanpa blok kode:
{"key":"...","action":"keep|revise|replace|escalate","confidence":"high|medium|low","reason":"alasan singkat bahasa Indonesia, maksimal 2 kalimat","word":"tulisan baku tanpa furigana (hanya replace)","reading":"bacaan baku hiragana/katakana (hanya replace)","card":{"word":"...","meaningsId":["..."],"meaningsEn":["..."],"examples":[{"jp":"...","id":"...","en":"..."}],"notes":"","tags":["..."]}}
card wajib untuk revise dan replace, dan harus null untuk keep dan escalate. card.word adalah tulisan (baru, untuk replace) ditambah furigana; semua aturan teks Jepang dan tag di atas tetap berlaku.`;
}

function buildReviewPrompt(item, similar) {
  const { note, level } = item;
  const input = {
    key: note.key,
    level,
    word: note.word,
    reading: note.reading,
    readingUncertain: note.readingUncertain,
    hints: note.hints,
    homographs: note.homographs,
    sourceLevels: note.sourceLevels,
    doubt: note.ai.doubt,
    kartuSaatIni: note.content,
    entriMirip: similar,
  };
  return `Tinjau kata berikut:\n${JSON.stringify(input, null, 2)}`;
}

function buildRetryPrompt(problems) {
  return (
    "Keputusan atau kartu Anda belum memenuhi aturan:\n" +
    problems.map((problem) => `- ${problem}`).join("\n") +
    "\nTulis ulang jawaban lengkap dalam format JSON yang sama. Bila masalahnya tidak bisa diperbaiki, pilih escalate."
  );
}

// ---------------------------------------------------------------------------
// Keputusan
// ---------------------------------------------------------------------------

const decisionSchema = z.object({
  key: z.string(),
  action: z.enum(ACTIONS),
  confidence: z.enum(["high", "medium", "low"]),
  reason: z.string().trim().min(1),
  word: z.string().nullish(),
  reading: z.string().nullish(),
  card: z.record(z.string(), z.unknown()).nullish(),
});

/** Objek JSON dari jawaban model; blok kode dan teks pengantar ditoleransi. */
function parseDecision(raw) {
  const text = raw.trim().replace(/^```[a-z]*\n?/i, "").replace(/```$/, "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return { error: "keluaran bukan objek JSON" };
  try {
    const value = JSON.parse(text.slice(start, end + 1));
    // Toleransi bila model tetap memakai format generator {"notes":[...]}.
    return { value: Array.isArray(value?.notes) ? value.notes[0] : value };
  } catch (error) {
    return { error: `JSON tidak valid: ${error instanceof Error ? error.message : String(error)}` };
  }
}

const plainReading = (text) => toHiragana(text).normalize("NFC");
const wordReadingOf = (note) => plainReading(readingFromMarkup(note.content.word));

/**
 * Note sesudah keputusan diterapkan: tulisan/bacaan yang diganti (replace),
 * atau bacaan yang disesuaikan dengan furigana kartu bila bacaan sumber pasti
 * (readingUncertain false) tetapi ternyata keliru. Tanpa penyesuaian itu
 * validator menolak kartu begitu `doubt` dikosongkan.
 */
function resolvedNote(note, action, content, replacement) {
  if (action === "replace") {
    return { ...note, word: replacement.word, reading: replacement.reading, readingUncertain: false };
  }
  if (!note.readingUncertain && containsKanji(note.word)) {
    const derived = plainReading(readingFromMarkup(content.word));
    if (derived !== plainReading(note.reading)) return { ...note, reading: derived };
  }
  return note;
}

/** Note lain (semua level) dengan tulisan atau bacaan yang sama. */
function similarEntries(index, key, words, readings) {
  const found = [];
  for (const { level, note } of index) {
    if (note.key === key) continue;
    const reading = plainReading(note.reading);
    if (words.has(note.word) || readings.has(reading) || (note.content && readings.has(wordReadingOf(note)))) {
      found.push({ key: note.key, level, word: note.word, reading: note.reading });
    }
  }
  return found.slice(0, 15);
}

/**
 * Note lain yang menghasilkan kartu dengan tulisan + bacaan yang sama. Dicek
 * terhadap data sumber maupun kartu yang sudah digenerate, karena bacaan kartu
 * bisa berbeda dari bacaan sumber (mis. 分別|ふんべつ yang kartunya dibaca
 * ぶんべつ akan kembar dengan 分別|ぶんべつ).
 */
function findDuplicate(index, key, word, reading) {
  const target = plainReading(reading);
  return index.find(({ note: other }) => {
    if (other.key === key) return false;
    const sameSource = other.word === word && plainReading(other.reading) === target;
    const sameCard =
      other.content !== null &&
      stripJapaneseMarkup(other.content.word) === word &&
      wordReadingOf(other) === target;
    return sameSource || sameCard;
  });
}

const describeDuplicate = (duplicate) => `${duplicate.level} ${duplicate.note.key}`;

/**
 * Validasi satu keputusan model. Mengembalikan rencana atau daftar masalah
 * yang dikirim balik ke model.
 */
function evaluateDecision(item, decision, taxonomy, index) {
  const { note } = item;
  if (decision.key !== note.key) return { problems: [`key harus "${note.key}"`] };

  if (decision.action === "keep" || decision.action === "escalate") {
    if (decision.action === "keep") {
      const target = resolvedNote(note, "keep", note.content, null);
      const problems = vocabContentProblems(target, note.content, taxonomy, { doubt: null });
      if (problems.length > 0) {
        return { problems: [`kartu saat ini tidak lolos validasi, jadi tidak bisa keep: ${problems.join("; ")}`] };
      }
      const duplicate = findDuplicate(index, note.key, note.word, wordReadingOf(note));
      if (duplicate) {
        return {
          plan: {
            action: "escalate",
            content: null,
            replacement: null,
            note: `kartu saat ini kembar dengan ${describeDuplicate(duplicate)}`,
          },
        };
      }
    }
    return { plan: { action: decision.action, content: null, replacement: null } };
  }

  if (!decision.card) return { problems: [`card wajib untuk ${decision.action}`] };
  const generated = replyItemToContent({ ...decision.card, key: note.key, doubt: null });
  if (generated.problems) return { problems: generated.problems };

  let replacement = null;
  if (decision.action === "replace") {
    const word = decision.word?.trim();
    const reading = decision.reading?.trim();
    if (!word || !reading) return { problems: ["replace wajib mengisi word dan reading"] };
    if (word === note.word) return { problems: ["word sama dengan sumber; pakai revise, bukan replace"] };
    replacement = { word, reading };
    const duplicate = findDuplicate(index, note.key, word, reading);
    if (duplicate) {
      return {
        plan: {
          action: "escalate",
          content: null,
          replacement: null,
          note: `bentuk baku ${word}|${reading} sudah ada sebagai ${describeDuplicate(duplicate)}`,
        },
      };
    }
  } else {
    // revise boleh mengganti bacaan, tetapi tidak boleh menjadi salinan kata
    // lain. Model diberi kesempatan memperbaikinya (mis. menulis kartu sesuai
    // bacaan key) sebelum akhirnya escalate.
    const reading = plainReading(readingFromMarkup(generated.content.word));
    const duplicate = findDuplicate(index, note.key, note.word, reading);
    if (duplicate) {
      return {
        problems: [
          `kartu ${note.word} dibaca ${reading} sudah ada sebagai kata terpisah ${describeDuplicate(duplicate)}. ` +
            `Tulis kartu untuk makna bacaan ${note.reading} bila bacaan itu benar dan lazim, atau pilih escalate`,
        ],
      };
    }
  }

  const target = resolvedNote(note, decision.action, generated.content, replacement);
  const problems = vocabContentProblems(target, generated.content, taxonomy, { doubt: null });
  if (problems.length > 0) return { problems };
  return { plan: { action: decision.action, content: generated.content, replacement } };
}

async function reviewNote({ client, model, reasoningEffort, systemPrompt, taxonomy, index, item }) {
  const similar = similarEntries(
    index,
    item.note.key,
    new Set([item.note.word]),
    new Set([plainReading(item.note.reading), wordReadingOf(item.note)]),
  );
  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: buildReviewPrompt(item, similar) },
  ];
  const usage = { input: 0, output: 0 };
  let problems = [];

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const completion = await client.chat.completions.create({
      model,
      messages,
      ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
    });
    const reply = completion.choices?.[0]?.message?.content ?? "";
    usage.input += completion.usage?.prompt_tokens ?? 0;
    usage.output += completion.usage?.completion_tokens ?? 0;

    problems = [];
    let evaluation = null;
    const parsed = parseDecision(reply);
    if (parsed.error) {
      problems = [parsed.error];
    } else {
      const decision = decisionSchema.safeParse(parsed.value);
      if (!decision.success) {
        const issue = decision.error.issues[0];
        problems = [`bentuk keluaran salah di ${issue?.path.join(".") || "objek"}: ${issue?.message}`];
      } else {
        evaluation = evaluateDecision(item, decision.data, taxonomy, index);
        problems = evaluation.problems ?? [];
        if (evaluation.plan) {
          const { confidence, reason } = decision.data;
          const plan = { ...evaluation.plan, confidence, reason };
          // Perubahan berisiko dengan keyakinan rendah tidak pernah diterapkan.
          if (confidence === "low" && (plan.action === "revise" || plan.action === "replace")) {
            plan.note = `model memilih ${plan.action} dengan confidence low`;
            plan.action = "escalate";
          }
          return { plan, attempts: attempt, usage };
        }
      }
    }

    if (attempt < MAX_ATTEMPTS) {
      messages.push({ role: "assistant", content: reply }, { role: "user", content: buildRetryPrompt(problems) });
    }
  }

  return {
    plan: {
      action: "escalate",
      content: null,
      replacement: null,
      confidence: "low",
      reason: "",
      note: `gagal ${MAX_ATTEMPTS}x: ${problems.join("; ")}`,
    },
    attempts: MAX_ATTEMPTS,
    usage,
  };
}

// ---------------------------------------------------------------------------
// Rencana -> fixture
// ---------------------------------------------------------------------------

/**
 * Memasang ulang tulisan/bacaan dari keputusan replace yang dikembalikan oleh
 * `flashcard:extract` ke tulisan sumber. Bila sumbernya sudah berubah ke bentuk
 * lain (deck sumber diperbaiki), note dibiarkan dan hanya dilaporkan.
 */
function restoreOverrides(file) {
  let restored = 0;
  for (const note of file.notes) {
    const override = note.ai?.doubtResolution?.override;
    if (!override || (note.word === override.word && note.reading === override.reading)) continue;
    const source = note.ai.doubtResolution.source;
    if (note.word === source.word && note.reading === source.reading) {
      note.word = override.word;
      note.reading = override.reading;
      note.readingUncertain = false;
      restored += 1;
      log(`  PASANG ULANG ${file.level} ${note.key} -> ${override.word}|${override.reading}`);
    } else {
      log(`  LEWATI ${file.level} ${note.key} - sumber sekarang ${note.word}|${note.reading}, cek manual`);
    }
  }
  return restored;
}

function applyPlanItem(note, item, taxonomy) {
  if (!note) return "key tidak ditemukan";
  if (!note.ai || !note.content) return "kata belum digenerate";
  if (note.ai.doubt === null && note.ai.doubtResolution?.previousDoubt === item.previousDoubt) {
    return "sudah diterapkan sebelumnya";
  }
  if (note.ai.generatedAt !== item.generatedAt || note.ai.doubt !== item.previousDoubt) {
    return "kartu berubah sejak rencana dibuat; jalankan peninjauan ulang";
  }

  const content = item.action === "keep" ? note.content : item.content;
  const target = resolvedNote(note, item.action, content, item.replacement);
  const problems = vocabContentProblems(target, content, taxonomy, { doubt: null });
  if (problems.length > 0) return `tidak lolos validasi: ${problems.join("; ")}`;

  const source = { word: note.word, reading: note.reading, readingUncertain: note.readingUncertain };
  const changed = target.word !== note.word || target.reading !== note.reading;
  note.word = target.word;
  note.reading = target.reading;
  note.readingUncertain = target.readingUncertain;
  note.content = content;
  note.ai = {
    ...note.ai,
    doubt: null,
    doubtResolution: {
      action: item.action,
      reason: item.reason,
      previousDoubt: item.previousDoubt,
      model: item.model,
      resolvedAt: new Date().toISOString(),
      source,
      override: changed ? { word: target.word, reading: target.reading } : null,
    },
  };
  return null;
}

async function applyPlan(options, taxonomy) {
  let plan = [];
  try {
    plan = JSON.parse(await fs.readFile(PLAN_FILE, "utf8")).items ?? [];
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    log(`${path.basename(PLAN_FILE)} tidak ada; hanya memasang ulang hasil replace sebelumnya.`);
  }

  const summary = { applied: 0, skipped: 0, escalated: 0, restored: 0 };
  for (const level of LEVELS) {
    if (options.level && level !== options.level) continue;
    const file = await readVocabFile(level);
    const restored = restoreOverrides(file);
    summary.restored += restored;
    let changed = restored > 0;

    const notesByKey = new Map(file.notes.map((note) => [note.key, note]));
    for (const item of plan.filter((entry) => entry.level === level)) {
      if (options.keys.length > 0 && !options.keys.includes(item.key)) continue;
      if (item.action === "escalate") {
        summary.escalated += 1;
        continue;
      }
      if (!ACTIONS.includes(item.action)) {
        summary.skipped += 1;
        log(`  LEWATI ${level} ${item.key} - action tidak dikenal: ${item.action}`);
        continue;
      }
      const error = applyPlanItem(notesByKey.get(item.key), item, taxonomy);
      if (error) {
        summary.skipped += 1;
        log(`  LEWATI ${level} ${item.key} - ${error}`);
      } else {
        summary.applied += 1;
        changed = true;
        log(`  ${item.action.toUpperCase()} ${level} ${item.key}`);
      }
    }
    if (changed) await writeVocabFile(file);
  }

  log(
    `DONE - ${summary.applied} diterapkan, ${summary.escalated} escalate (tetap ragu, tinjau manual), ` +
      `${summary.skipped} dilewati, ${summary.restored} replace dipasang ulang`,
  );
  if (summary.applied + summary.restored > 0) log("Lanjutkan dengan: npm run seed:flashcard:check");
}

// ---------------------------------------------------------------------------
// Orkestrasi
// ---------------------------------------------------------------------------

async function runPool(tasks, concurrency, worker) {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(concurrency, tasks.length) }, async () => {
    while (cursor < tasks.length) await worker(tasks[cursor++]);
  });
  await Promise.all(runners);
}

function describePlan(item) {
  const lines = [`${item.action.toUpperCase()} [${item.level}] ${item.key} (${item.confidence}) - ${item.reason}`];
  if (item.note) lines.push(`    catatan: ${item.note}`);
  if (item.replacement) {
    lines.push(`    ganti: ${item.sourceWord} -> ${item.replacement.word}|${item.replacement.reading}`);
  }
  if (item.content) {
    const { word, meaningsId } = item.content;
    lines.push(`    kartu: ${stripJapaneseMarkup(word)} (${readingFromMarkup(word)}) - ${meaningsId.join("; ")}`);
    if (item.content.notes) lines.push(`    notes: ${stripJapaneseMarkup(item.content.notes)}`);
  }
  return lines;
}

async function review(options, taxonomy) {
  const parsedEnv = envSchema.safeParse(process.env);
  if (!parsedEnv.success) {
    const missing = parsedEnv.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`environment belum lengkap: ${missing} (lihat .env.example)`);
  }
  const env = parsedEnv.data;
  const model = options.model ?? env.FLASHCARD_MODEL ?? env.EXPLANATION_MODEL;
  const client = new OpenAI({
    apiKey: env.EXPLANATION_API_KEY,
    baseURL: env.EXPLANATION_BASE_URL,
    timeout: REQUEST_TIMEOUT_MS,
    maxRetries: SDK_MAX_RETRIES,
    defaultHeaders: { "User-Agent": USER_AGENT },
  });

  // Indeks semua level dipakai untuk mencari entri mirip dan mencegah
  // replace membuat kartu kembar.
  const index = [];
  for (const level of LEVELS) {
    for (const note of (await readVocabFile(level)).notes) index.push({ level, note });
  }
  const items = index.filter(
    ({ level, note }) =>
      note.ai?.doubt &&
      note.content &&
      (!options.level || level === options.level) &&
      (options.keys.length === 0 || options.keys.includes(note.key)),
  );
  if (items.length === 0) {
    log("Tidak ada kata bertanda ragu yang cocok.");
    return;
  }

  log(
    `Meninjau ${items.length} kata - model ${model}, reasoning ${options.reasoningEffort}, ` +
      `concurrency ${options.concurrency}`,
  );
  const systemPrompt = buildReviewSystemPrompt(taxonomy);
  const results = [];
  const usage = { input: 0, output: 0 };

  await runPool(items, options.concurrency, async (item) => {
    let entry;
    try {
      const result = await reviewNote({
        client,
        model,
        reasoningEffort: options.reasoningEffort,
        systemPrompt,
        taxonomy,
        index,
        item,
      });
      usage.input += result.usage.input;
      usage.output += result.usage.output;
      entry = result.plan;
    } catch (error) {
      entry = {
        action: "escalate",
        content: null,
        replacement: null,
        confidence: "low",
        reason: "",
        note: `request gagal: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
    const planItem = {
      level: item.level,
      key: item.note.key,
      sourceWord: item.note.word,
      previousDoubt: item.note.ai.doubt,
      generatedAt: item.note.ai.generatedAt,
      model,
      ...entry,
    };
    results.push(planItem);
    for (const line of describePlan(planItem)) log(line);
    if (planItem.content) {
      const target = resolvedNote(item.note, planItem.action, planItem.content, planItem.replacement);
      for (const warning of vocabContentWarnings(target, planItem.content)) log(`    WARN ${warning}`);
    }
  });

  // Rencana lama untuk kata lain dipertahankan, supaya peninjauan per level
  // atau per key bisa dicicil sebelum satu kali --apply.
  let previous = [];
  try {
    previous = JSON.parse(await fs.readFile(PLAN_FILE, "utf8")).items ?? [];
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  const reviewed = new Set(results.map((item) => item.key));
  const order = new Map(index.map(({ note }, position) => [note.key, position]));
  const merged = [...previous.filter((item) => !reviewed.has(item.key)), ...results].sort(
    (left, right) => (order.get(left.key) ?? 0) - (order.get(right.key) ?? 0),
  );
  await fs.writeFile(PLAN_FILE, `${JSON.stringify({ items: merged }, null, 2)}\n`, "utf8");

  const count = (action) => results.filter((item) => item.action === action).length;
  log(
    `DONE - keep ${count("keep")}, revise ${count("revise")}, replace ${count("replace")}, ` +
      `escalate ${count("escalate")}; ${usage.input}/${usage.output} token`,
  );
  log(`Rencana ditulis ke ${path.basename(PLAN_FILE)}. Baca/edit dulu, lalu: npm run fix:flashcard-doubts -- --apply`);
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const taxonomy = await loadTaxonomy();
  if (options.apply) await applyPlan(options, taxonomy);
  else await review(options, taxonomy);
}

main().catch((error) => {
  console.error("[fix:flashcard-doubts] gagal", error);
  process.exitCode = 1;
});
