// Generator isi kartu kosakata flashcard: membaca fixture
// src/flashcard-data/vocab/<level>.json, meminta isi kartu (arti ID/EN, contoh
// kalimat, catatan, tag) ke model bahasa beberapa kata sekaligus, lalu menulis
// hasilnya kembali ke file yang sama. Script ini TIDAK menyentuh database —
// impor ke database dilakukan terpisah oleh prisma/seed-flashcard.mjs.
//
//   npm run gen:flashcard                         # semua kata yang belum digenerate
//   npm run gen:flashcard -- --level N5 --limit 50
//   npm run gen:flashcard -- --concurrency 2      # lebih pelan, bila gateway membalas 429
//   npm run gen:flashcard -- --key "食事|しょくじ"  # satu kata (bisa diulang)
//   npm run gen:flashcard -- --only-doubts --overwrite
//   npm run gen:flashcard -- --dry-run            # cetak prompt, tanpa memanggil model
//
// Kata yang sudah punya isi TIDAK ditimpa kecuali dengan --overwrite, sehingga
// script ini aman dijalankan berulang sampai semua kata terisi.

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
import {
  buildRetryPrompt,
  buildSystemPrompt,
  buildUserPrompt,
  parseReply,
  PROMPT_VERSION,
  replyItemToContent,
} from "./flashcard-vocab-prompt.mjs";

const REQUEST_TIMEOUT_MS = 300_000;
// Di atas bawaan SDK (2): concurrency tinggi lebih sering kena 429, dan SDK
// menunggu sesuai header retry-after (atau backoff eksponensial) sebelum
// mengulang. Batch yang tetap gagal hanya membuat katanya kosong; jalankan ulang.
const SDK_MAX_RETRIES = 4;
const MAX_ATTEMPTS = 3;
const MAX_BATCH_SIZE = 30;
const MAX_CONCURRENCY = 16;
// Gateway menolak User-Agent bawaan SDK OpenAI dengan 403. Lihat catatan di
// src/features/conversation/lib/provider/openai.ts.
const USER_AGENT = "nihongofy/1.0";

// Memakai gateway yang sama dengan generator pembahasan soal. Model boleh
// dipisah lewat FLASHCARD_MODEL; tanpa itu dipakai EXPLANATION_MODEL.
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
  console.log(`[gen:flashcard] ${message}`);
}

function parseArguments(argv) {
  const options = {
    level: null,
    keys: [],
    limit: Infinity,
    // Diukur 1 Okt 2026 dengan gemini-3.8-flash: batch 20 memakai sekitar
    // setengah token input batch 10 (system prompt taxonomy dibagi ke lebih
    // banyak kata) dengan tingkat percobaan ulang yang sama, dan gateway
    // melayani 6 request paralel tanpa melambat.
    batchSize: 20,
    concurrency: 6,
    overwrite: false,
    onlyDoubts: false,
    dryRun: false,
    reasoningEffort: null,
  };

  const readValue = (argument, name, index) =>
    argument.startsWith(`${name}=`) ? argument.slice(name.length + 1) : argv[index + 1];

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const consumesNext = !argument.includes("=");

    if (argument === "--overwrite") {
      options.overwrite = true;
    } else if (argument === "--only-doubts") {
      options.onlyDoubts = true;
    } else if (argument === "--dry-run") {
      options.dryRun = true;
    } else if (argument.startsWith("--level")) {
      const level = readValue(argument, "--level", index)?.toUpperCase();
      if (!LEVELS.includes(level)) throw new Error(`--level harus salah satu dari ${LEVELS.join(", ")}`);
      options.level = level;
      if (consumesNext) index += 1;
    } else if (argument.startsWith("--key")) {
      const key = readValue(argument, "--key", index);
      if (!key || key.startsWith("--")) throw new Error('--key membutuhkan key kata, mis. "食事|しょくじ"');
      options.keys.push(key);
      if (consumesNext) index += 1;
    } else if (argument.startsWith("--limit")) {
      const value = Number(readValue(argument, "--limit", index));
      if (!Number.isInteger(value) || value < 1) throw new Error("--limit harus bilangan bulat > 0");
      options.limit = value;
      if (consumesNext) index += 1;
    } else if (argument.startsWith("--batch-size")) {
      const value = Number(readValue(argument, "--batch-size", index));
      if (!Number.isInteger(value) || value < 1 || value > MAX_BATCH_SIZE) {
        throw new Error(`--batch-size harus bilangan bulat 1-${MAX_BATCH_SIZE}`);
      }
      options.batchSize = value;
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
    } else {
      throw new Error(`argumen tidak dikenal: ${argument}`);
    }
  }

  return options;
}

// ---------------------------------------------------------------------------
// Pemanggilan model
// ---------------------------------------------------------------------------

async function generateBatch({ client, model, reasoningEffort, systemPrompt, taxonomy, level, notes }) {
  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: buildUserPrompt(level, notes) },
  ];

  const pending = new Map(notes.map((note) => [note.key, note]));
  const results = new Map();
  const lastProblems = new Map();
  // Alasan setiap percobaan ulang. Dicetak supaya aturan prompt yang sering
  // dilanggar terlihat: setiap percobaan ulang menambah satu request penuh.
  const retries = [];
  const usage = { input: 0, output: 0 };
  let attempts = 0;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS && pending.size > 0; attempt += 1) {
    attempts = attempt;
    // Parameter hanya dikirim bila diminta: model non-reasoning menolak
    // permintaan yang memuat field yang tidak dikenalnya.
    const completion = await client.chat.completions.create({
      model,
      messages,
      ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
    });
    const reply = completion.choices?.[0]?.message?.content ?? "";
    usage.input += completion.usage?.prompt_tokens ?? 0;
    usage.output += completion.usage?.completion_tokens ?? 0;

    const parsed = parseReply(reply);
    for (const [key, note] of pending) {
      let problems;
      let generated = null;

      if (parsed.error) {
        problems = [parsed.error];
      } else if (!parsed.items.has(key)) {
        problems = ["kartu ini tidak ada di keluaran"];
      } else {
        generated = replyItemToContent(parsed.items.get(key));
        problems =
          generated.problems ??
          vocabContentProblems(note, generated.content, taxonomy, { doubt: generated.doubt });
      }

      if (problems.length === 0) {
        results.set(key, {
          content: generated.content,
          doubt: generated.doubt,
          warnings: vocabContentWarnings(note, generated.content),
          attempt,
        });
        pending.delete(key);
      } else {
        lastProblems.set(key, problems);
      }
    }

    if (pending.size > 0 && attempt < MAX_ATTEMPTS) {
      const failures = [...pending.keys()].map((key) => ({ key, problems: lastProblems.get(key) ?? [] }));
      retries.push(...failures.map((failure) => ({ ...failure, attempt })));
      messages.push(
        { role: "assistant", content: reply },
        { role: "user", content: buildRetryPrompt(failures) },
      );
    }
  }

  return {
    results,
    failures: [...pending.keys()].map((key) => ({ key, problems: lastProblems.get(key) ?? [] })),
    retries,
    usage,
    attempts,
  };
}

// ---------------------------------------------------------------------------
// Orkestrasi
// ---------------------------------------------------------------------------

function selectNotes(notes, options) {
  if (options.keys.length > 0) return notes.filter((note) => options.keys.includes(note.key));
  if (options.onlyDoubts) {
    return notes.filter((note) => note.ai?.doubt && (options.overwrite || !note.content));
  }
  return options.overwrite ? notes : notes.filter((note) => !note.content);
}

function chunk(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}

// Pool sederhana: beberapa batch berjalan bersamaan.
async function runPool(tasks, concurrency, worker) {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(concurrency, tasks.length) }, async () => {
    while (cursor < tasks.length) {
      const index = cursor++;
      await worker(tasks[index], index);
    }
  });
  await Promise.all(runners);
}

function formatDuration(ms) {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return `${Math.max(1, Math.round(ms / 1000))} detik`;
  if (minutes < 60) return `${minutes} menit`;
  return `${Math.floor(minutes / 60)} jam ${minutes % 60} menit`;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const taxonomy = await loadTaxonomy();
  const systemPrompt = buildSystemPrompt(taxonomy);

  let env = null;
  if (!options.dryRun) {
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
      const missing = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
      throw new Error(`environment belum lengkap: ${missing} (lihat .env.example)`);
    }
    env = parsed.data;
  }

  const model = env ? (env.FLASHCARD_MODEL ?? env.EXPLANATION_MODEL) : "(dry-run)";
  const client = env
    ? new OpenAI({
        apiKey: env.EXPLANATION_API_KEY,
        baseURL: env.EXPLANATION_BASE_URL,
        timeout: REQUEST_TIMEOUT_MS,
        maxRetries: SDK_MAX_RETRIES,
        defaultHeaders: { "User-Agent": USER_AGENT },
      })
    : null;

  // Batch dari semua level dikumpulkan dulu lalu dikerjakan satu pool, supaya
  // --concurrency tetap penuh saat pindah level.
  const tasks = [];
  const writers = [];
  let budget = options.limit;
  let printedSystemPrompt = false;

  for (const level of LEVELS) {
    if (options.level && level !== options.level) continue;
    if (budget <= 0) break;

    const file = await readVocabFile(level);
    const selected = selectNotes(file.notes, options).slice(0, budget);
    if (selected.length === 0) continue;
    budget -= selected.length;

    const batches = chunk(selected, options.batchSize);
    log(`${level}: ${selected.length} kata dalam ${batches.length} batch`);

    if (options.dryRun) {
      if (!printedSystemPrompt) {
        log(`DRY-RUN system prompt (${PROMPT_VERSION}):\n${systemPrompt}\n---`);
        printedSystemPrompt = true;
      }
      log(`DRY-RUN prompt batch pertama ${level}:\n${buildUserPrompt(level, batches[0])}\n---`);
      continue;
    }

    // Semua batch satu level memutasi objek `file` yang sama, jadi setiap
    // penulisan menyimpan seluruh progres level itu. Penulisan diantrekan per
    // file supaya tidak pernah dua rename bersamaan pada file yang sama.
    const writer = { queue: Promise.resolve() };
    const persist = () => {
      writer.queue = writer.queue.then(() => writeVocabFile(file));
      return writer.queue;
    };
    writers.push(writer);
    batches.forEach((batch, index) => {
      tasks.push({ level, batch, persist, label: `${level} batch ${index + 1}/${batches.length}` });
    });
  }

  if (options.dryRun) return;
  if (tasks.length === 0) {
    log(
      "Tidak ada kata yang perlu digenerate: semua kata yang dipilih sudah punya konten. " +
        "Pakai --overwrite untuk membuat ulang.",
    );
    return;
  }

  const totalWords = tasks.reduce((sum, task) => sum + task.batch.length, 0);
  log(
    `Mulai ${totalWords} kata dalam ${tasks.length} batch - model ${model}, ` +
      `batch-size ${options.batchSize}, concurrency ${options.concurrency}`,
  );

  const summary = { generated: 0, failed: 0, recovered: 0, doubts: 0, warnings: 0, input: 0, output: 0 };
  const startedAt = Date.now();
  let processedWords = 0;
  let finishedBatches = 0;

  await runPool(tasks, options.concurrency, async (task) => {
    const batchStartedAt = Date.now();
    const details = [];
    let headline;

    try {
      const result = await generateBatch({
        client,
        model,
        reasoningEffort: options.reasoningEffort,
        systemPrompt,
        taxonomy,
        level: task.level,
        notes: task.batch,
      });
      summary.input += result.usage.input;
      summary.output += result.usage.output;

      // Penolakan di tengah jalan diulang otomatis dalam run ini. Status
      // akhirnya ditulis eksplisit (LOLOS atau FAIL) supaya baris DITOLAK
      // tidak terbaca seolah kata itu masih harus digenerate ulang.
      for (const retry of result.retries) {
        details.push(
          `  DITOLAK ${retry.key} (percobaan ${retry.attempt}/${MAX_ATTEMPTS}, diminta ulang otomatis) - ` +
            retry.problems.join("; "),
        );
      }
      for (const key of new Set(result.retries.map((retry) => retry.key))) {
        const generated = result.results.get(key);
        if (!generated) continue;
        summary.recovered += 1;
        details.push(`  LOLOS ${key} di percobaan ${generated.attempt}/${MAX_ATTEMPTS} - sudah tersimpan`);
      }

      const generatedAt = new Date().toISOString();
      for (const note of task.batch) {
        const generated = result.results.get(note.key);
        if (!generated) continue;
        note.content = generated.content;
        note.ai = { model, promptVersion: PROMPT_VERSION, generatedAt, doubt: generated.doubt };
        summary.generated += 1;
        if (generated.doubt) {
          summary.doubts += 1;
          details.push(`  DOUBT ${note.key} - ${generated.doubt}`);
        }
        for (const warning of generated.warnings) {
          summary.warnings += 1;
          details.push(`  WARN ${note.key} - ${warning}`);
        }
      }
      for (const failure of result.failures) {
        summary.failed += 1;
        details.push(`  FAIL ${failure.key} - ${failure.problems.join("; ")}`);
      }

      if (result.results.size > 0) await task.persist();
      const seconds = ((Date.now() - batchStartedAt) / 1000).toFixed(1);
      headline =
        `OK ${task.label} - ${result.results.size}/${task.batch.length} kata, ${result.attempts} percobaan, ` +
        `${seconds}s, ${result.usage.input}/${result.usage.output} token`;
    } catch (error) {
      summary.failed += task.batch.length;
      headline = `FAIL ${task.label} - ${error instanceof Error ? error.message : String(error)}`;
    }

    processedWords += task.batch.length;
    finishedBatches += 1;
    // Perkiraan sisa waktu baru masuk akal setelah putaran pertama pool
    // selesai; sebelum itu laju yang terukur masih sebagian kecil laju aslinya.
    const elapsed = Date.now() - startedAt;
    const eta =
      finishedBatches >= options.concurrency && processedWords < totalWords
        ? `, sisa ±${formatDuration((elapsed / processedWords) * (totalWords - processedWords))}`
        : "";
    // Detail dicetak sekaligus setelah ringkasan batch-nya supaya tidak
    // tercampur dengan batch lain yang selesai hampir bersamaan.
    log(`${headline} [${processedWords}/${totalWords}${eta}]`);
    for (const line of details) log(line);
  });

  await Promise.all(writers.map((writer) => writer.queue));

  log(
    `DONE dalam ${formatDuration(Date.now() - startedAt)} - ${summary.generated} kata dibuat ` +
      `(${summary.recovered} di antaranya lolos setelah diminta ulang otomatis), ${summary.failed} gagal, ` +
      `${summary.doubts} ditandai ragu, ${summary.warnings} peringatan, ` +
      `${summary.input}/${summary.output} token`,
  );
  if (summary.doubts > 0) log("Tinjau yang ditandai ragu dengan: npm run flashcard:doubts");
  if (summary.failed > 0) {
    log("Kata yang gagal tetap kosong; jalankan ulang perintah yang sama untuk mencobanya lagi.");
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("[gen:flashcard] gagal", error);
  process.exitCode = 1;
});
