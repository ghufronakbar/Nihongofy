// Transkripsikan audio CHOUKAI per soal melalui chat multimodal.
// Hasil ditulis ke staging gitignored dan wajib diaudit sebelum diterapkan.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";
import { z } from "zod";
import { assertSafeFileName, loadAndValidateSeedFiles } from "./test-package-fixture.mjs";

const PROJECT_ROOT = fileURLToPath(new URL("../", import.meta.url));
const STAGING_ROOT = path.join(PROJECT_ROOT, "data/generated/choukai-transcripts");
const DEFAULT_MODEL = "ag/gemini-3.8-flash";
const PROMPT_VERSION = "choukai-question-audio-chat-v1";
const REQUEST_TIMEOUT_MS = 300_000;

const envSchema = z.object({
  EXPLANATION_BASE_URL: z.url(),
  EXPLANATION_API_KEY: z.string().trim().min(1),
  CHOUKAI_AUDIO_CHAT_MODEL: z
    .preprocess((value) => (value === "" ? undefined : value), z.string().trim().min(1).optional()),
});

function log(message) {
  console.log(`[choukai:transcript:question-audio] ${message}`);
}

function parseArguments(argv) {
  const options = {
    selectedFile: null,
    questionKeys: new Set(),
    limit: Infinity,
    concurrency: 1,
    reasoningEffort: "high",
    overwrite: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const readValue = (prefix) =>
      argument.startsWith(`${prefix}=`) ? argument.slice(prefix.length + 1) : argv[index + 1];
    const consumesNext = !argument.includes("=");

    if (argument === "--overwrite") {
      options.overwrite = true;
      continue;
    }
    if (argument === "--help") {
      options.help = true;
      continue;
    }
    if (argument.startsWith("--file")) {
      const value = readValue("--file");
      if (!value || value.startsWith("--")) throw new Error("--file membutuhkan nama fixture *.json");
      options.selectedFile = assertSafeFileName(value);
      if (consumesNext) index += 1;
      continue;
    }
    if (argument.startsWith("--limit")) {
      const value = Number(readValue("--limit"));
      if (!Number.isInteger(value) || value < 1) throw new Error("--limit harus bilangan bulat > 0");
      options.limit = value;
      if (consumesNext) index += 1;
      continue;
    }
    if (argument.startsWith("--question")) {
      const value = readValue("--question")?.toUpperCase();
      if (!/^CHOUKAI_[A-Z_]+#[1-9]\d*$/.test(value ?? "")) {
        throw new Error("--question harus berbentuk CHOUKAI_TYPE#nomor");
      }
      options.questionKeys.add(value);
      if (consumesNext) index += 1;
      continue;
    }
    if (argument.startsWith("--concurrency")) {
      const value = Number(readValue("--concurrency"));
      if (!Number.isInteger(value) || value < 1 || value > 4) {
        throw new Error("--concurrency harus bilangan bulat 1-4");
      }
      options.concurrency = value;
      if (consumesNext) index += 1;
      continue;
    }
    if (argument.startsWith("--reasoning-effort")) {
      const value = readValue("--reasoning-effort")?.toLowerCase();
      if (!value || !["minimal", "low", "medium", "high"].includes(value)) {
        throw new Error("--reasoning-effort harus minimal|low|medium|high");
      }
      options.reasoningEffort = value;
      if (consumesNext) index += 1;
      continue;
    }
    throw new Error(`argumen tidak dikenal: ${argument}`);
  }

  return options;
}

function printHelp() {
  console.log(`Usage:
  npm run choukai:transcript:question-audio -- --file n4-2013-12.json [options]

Options:
  --limit <n>              Maksimal soal baru pada run ini
  --question <type#no>     Batasi soal tertentu; dapat diulang
  --concurrency <n>        Paralel request 1-4 (default 1)
  --reasoning-effort <v>   minimal|low|medium|high (default high)
  --overwrite              Transkripsikan ulang seluruh soal
  --help                   Tampilkan bantuan`);
}

async function readJson(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf-8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function writeJsonAtomic(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
  await fs.rename(temporary, filePath);
}

function audioFormat(contentType, url) {
  if (contentType === "audio/mpeg") return "mp3";
  if (["audio/wav", "audio/x-wav"].includes(contentType)) return "wav";
  const extension = new URL(url).pathname.split(".").pop()?.toLowerCase();
  return extension === "mp3" || extension === "wav" ? extension : null;
}

async function downloadAudio(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`audio gagal diunduh (${response.status}): ${url}`);
  const contentType = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  const format = audioFormat(contentType, url);
  if (!format) throw new Error(`format audio tidak didukung (${contentType ?? "tanpa content-type"}): ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length === 0) throw new Error(`audio kosong: ${url}`);
  return { data: bytes.toString("base64"), format, bytes: bytes.length };
}

function stripTranscript(value) {
  let text = value.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```[a-z]*\n?/i, "").replace(/```$/, "").trim();
  }
  return text.replace(/^TRANSKRIP\s*:\s*/i, "").trim();
}

function transcriptForFixture(value) {
  return value.replace(/^[０-９0-9]+番\s*\n?/, "").trim();
}

async function writeExtraction({ outputFile, seedFile, staging, allTasks }) {
  const extractionFile = path.join(path.dirname(outputFile), "extraction.json");
  const existing = await readJson(extractionFile);
  if (existing?.review?.status === "APPROVED") {
    throw new Error(`extraction sudah APPROVED dan tidak boleh ditimpa: ${extractionFile}`);
  }
  const byKey = new Map(staging.entries.map((entry) => [entry.key, entry]));
  const extraction = {
    version: 1,
    fixtureFile: seedFile.file,
    packageName: seedFile.pkg.name,
    jlptLevel: seedFile.pkg.jlptLevel,
    ai: {
      model: staging.ai.model,
      promptVersion: staging.ai.promptVersion,
    },
    generatedAt: staging.generatedAt,
    review: existing?.review ?? { status: "PENDING", reviewedAt: null },
    merged: {
      entries: allTasks.map((task) => {
        const entry = byKey.get(task.key);
        return {
          mondaiType: task.mondaiType,
          questionOrder: task.questionOrder,
          transcript: transcriptForFixture(entry.text),
          sourcePages: [],
          doubt: null,
        };
      }),
      conflicts: [],
      missing: [],
      unassigned: [],
    },
  };
  await writeJsonAtomic(extractionFile, extraction);
  return extractionFile;
}

async function transcribe({ client, model, reasoningEffort, task }) {
  const audio = await downloadAudio(task.audioUrl);
  const startedAt = Date.now();
  const completion = await client.chat.completions.create(
    {
      model,
      reasoning_effort: reasoningEffort,
      messages: [
        {
          role: "system",
          content:
            "Anda adalah transkriptor audio ujian JLPT. Tulis hanya transkrip bahasa Jepang yang terdengar, tanpa penjelasan, terjemahan, markdown, atau koreksi isi. Pertahankan pertanyaan, dialog, dan pilihan lisan bernomor. Gunakan tanda baca dan pergantian baris yang wajar. Jangan mengarang bagian yang tidak terdengar; tulis [聞き取れない] bila benar-benar tidak jelas.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Transkripsikan audio per soal ${task.key} dari ${task.packageName}.`,
            },
            { type: "input_audio", input_audio: { data: audio.data, format: audio.format } },
          ],
        },
      ],
    },
    { timeout: REQUEST_TIMEOUT_MS },
  );
  const text = stripTranscript(completion.choices?.[0]?.message?.content ?? "");
  if (!text) throw new Error("respons model tidak memiliki transkrip");
  return {
    text,
    bytes: audio.bytes,
    elapsedMs: Date.now() - startedAt,
    usage: {
      input: completion.usage?.prompt_tokens ?? 0,
      output: completion.usage?.completion_tokens ?? 0,
    },
  };
}

async function runPool(tasks, concurrency, worker) {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(concurrency, tasks.length) }, async () => {
    while (cursor < tasks.length) {
      const index = cursor++;
      await worker(tasks[index]);
    }
  });
  await Promise.all(runners);
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }
  if (!options.selectedFile) throw new Error("--file wajib diisi");

  const loaded = await loadAndValidateSeedFiles(options.selectedFile);
  if (loaded.errors.length > 0) {
    throw new Error(loaded.errors.map((error) => `${error.file}: ${error.message}`).join("; "));
  }
  const seedFile = loaded.seedFiles[0];
  if (!seedFile) throw new Error(`fixture tidak ditemukan: ${options.selectedFile}`);

  const envResult = envSchema.safeParse(process.env);
  if (!envResult.success) {
    const missing = envResult.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`environment belum lengkap: ${missing} (lihat .env.example)`);
  }
  const env = envResult.data;
  const model = env.CHOUKAI_AUDIO_CHAT_MODEL ?? DEFAULT_MODEL;
  const packageSlug = path.basename(seedFile.file, ".json");
  const outputFile = path.join(STAGING_ROOT, packageSlug, "question-audio.json");
  const existing = await readJson(outputFile);
  if (existing && (existing.fixtureFile !== seedFile.file || existing.ai?.model !== model)) {
    throw new Error(`staging lama tidak kompatibel; gunakan --overwrite setelah ditinjau: ${outputFile}`);
  }

  const allTasks = seedFile.pkg.testPackageItems
    .filter((item) => item.section === "CHOUKAI")
    .sort((left, right) => left.order - right.order)
    .flatMap((item) =>
      [...item.questions]
        .sort((left, right) => left.order - right.order)
        .map((question) => ({
          key: `${item.mondaiType}#${question.order}`,
          mondaiType: item.mondaiType,
          questionOrder: question.order,
          packageName: seedFile.pkg.name,
          audioUrl: question.questionAudio,
        })),
    );
  const withoutAudio = allTasks.filter((task) => !task.audioUrl);
  if (withoutAudio.length > 0) {
    throw new Error(`audio per soal belum tersedia: ${withoutAudio.map((task) => task.key).join(", ")}`);
  }

  const now = new Date().toISOString();
  const staging = existing ?? {
    version: 1,
    fixtureFile: seedFile.file,
    packageName: seedFile.pkg.name,
    jlptLevel: seedFile.pkg.jlptLevel,
    ai: { model, promptVersion: PROMPT_VERSION, reasoningEffort: options.reasoningEffort },
    generatedAt: now,
    updatedAt: now,
    entries: [],
  };
  const byKey = new Map(staging.entries.map((entry) => [entry.key, entry]));
  const selectedTasks = options.questionKeys.size > 0
    ? allTasks.filter((task) => options.questionKeys.has(task.key))
    : allTasks;
  for (const key of options.questionKeys) {
    if (!allTasks.some((task) => task.key === key)) throw new Error(`soal tidak ditemukan: ${key}`);
  }
  const pending = selectedTasks
    .filter((task) => options.overwrite || byKey.get(task.key)?.status !== "TRANSCRIBED")
    .slice(0, options.limit);
  const client = new OpenAI({
    baseURL: env.EXPLANATION_BASE_URL,
    apiKey: env.EXPLANATION_API_KEY,
    defaultHeaders: { "User-Agent": "nihongofy/1.0" },
  });
  let failed = 0;
  let saveChain = Promise.resolve();

  function persistStaging() {
    staging.entries = allTasks
      .map((candidate) => byKey.get(candidate.key))
      .filter(Boolean);
    staging.updatedAt = new Date().toISOString();
    saveChain = saveChain.then(() => writeJsonAtomic(outputFile, staging));
    return saveChain;
  }

  await runPool(pending, options.concurrency, async (task) => {
    try {
      const result = await transcribe({ client, model, reasoningEffort: options.reasoningEffort, task });
      byKey.set(task.key, {
        key: task.key,
        mondaiType: task.mondaiType,
        questionOrder: task.questionOrder,
        status: "TRANSCRIBED",
        audioUrl: task.audioUrl,
        audioBytes: result.bytes,
        text: result.text,
        elapsedMs: result.elapsedMs,
        usage: result.usage,
        error: null,
      });
      log(`OK ${task.key} - ${result.text.length} karakter, ${(result.elapsedMs / 1000).toFixed(1)}s`);
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      byKey.set(task.key, {
        key: task.key,
        mondaiType: task.mondaiType,
        questionOrder: task.questionOrder,
        status: "FAILED",
        audioUrl: task.audioUrl,
        text: null,
        error: message,
      });
      log(`FAIL ${task.key} - ${message}`);
    }
    await persistStaging();
  });

  const succeeded = staging.entries.filter((entry) => entry.status === "TRANSCRIBED").length;
  log(`DONE - ${succeeded}/${allTasks.length} soal berhasil; staging ${outputFile}`);
  if (succeeded === allTasks.length) {
    const extractionFile = await writeExtraction({ outputFile, seedFile, staging, allTasks });
    log(`extraction PENDING diperbarui: ${extractionFile}`);
  }
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("[choukai:transcript:question-audio] gagal", error);
  process.exitCode = 1;
});
