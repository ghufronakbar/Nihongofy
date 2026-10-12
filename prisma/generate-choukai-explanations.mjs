// Generate pembahasan CHOUKAI ke staging. Script ini tidak mengubah fixture
// atau database; hasil harus diaudit dan disetujui sebelum apply terpisah.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";
import { z } from "zod";
import {
  assertSafeFileName,
  loadAndValidateSeedFiles,
} from "./test-package-fixture.mjs";
import {
  buildInputSnapshot,
  buildQuestionImages,
  buildRetryPrompt,
  buildUserPrompt,
  hashInputSnapshot,
  parseExplanationReply,
  PROMPT_VERSION,
  SYSTEM_PROMPT,
  validateQuestionContext,
} from "./choukai-explanation-prompt.mjs";

const PROJECT_ROOT = fileURLToPath(new URL("../", import.meta.url));
const STAGING_ROOT = path.join(PROJECT_ROOT, "data/generated/choukai-explanations");
const DEFAULT_MODEL = "ag/gemini-3.8-flash";
const REQUEST_TIMEOUT_MS = 300_000;
const MAX_ATTEMPTS = 2;
const USER_AGENT = "nihongofy/1.0";

const envSchema = z.object({
  EXPLANATION_BASE_URL: z.url(),
  EXPLANATION_API_KEY: z.string().trim().min(1),
  CHOUKAI_EXPLANATION_MODEL: z
    .preprocess((value) => (value === "" ? undefined : value), z.string().trim().min(1).optional()),
});

function log(message) {
  console.log(`[choukai:explanation:generate] ${message}`);
}

function parseArguments(argv) {
  const options = {
    selectedFile: null,
    mondai: null,
    questionKeys: new Set(),
    perMondai: null,
    limit: Infinity,
    concurrency: 1,
    reasoningEffort: "high",
    model: null,
    includeAudio: false,
    overwrite: false,
    dryRun: false,
  };

  const readValue = (argument, prefix, index) =>
    argument.startsWith(`${prefix}=`) ? argument.slice(prefix.length + 1) : argv[index + 1];

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const consumesNext = !argument.includes("=");

    if (argument === "--include-audio") {
      options.includeAudio = true;
      continue;
    }
    if (argument === "--overwrite") {
      options.overwrite = true;
      continue;
    }
    if (argument === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (argument === "--help") {
      options.help = true;
      continue;
    }
    if (argument.startsWith("--file")) {
      const value = readValue(argument, "--file", index);
      if (!value || value.startsWith("--")) throw new Error("--file membutuhkan nama fixture *.json");
      options.selectedFile = assertSafeFileName(value);
      if (consumesNext) index += 1;
      continue;
    }
    if (argument.startsWith("--mondai")) {
      const value = readValue(argument, "--mondai", index)?.toUpperCase();
      if (!value?.startsWith("CHOUKAI_")) throw new Error("--mondai harus tipe CHOUKAI");
      options.mondai = value;
      if (consumesNext) index += 1;
      continue;
    }
    if (argument.startsWith("--question")) {
      const value = readValue(argument, "--question", index)?.toUpperCase();
      if (!/^CHOUKAI_[A-Z_]+#[1-9]\d*$/.test(value ?? "")) {
        throw new Error("--question harus berbentuk CHOUKAI_TYPE#nomor");
      }
      options.questionKeys.add(value);
      if (consumesNext) index += 1;
      continue;
    }
    if (argument.startsWith("--per-mondai")) {
      const value = Number(readValue(argument, "--per-mondai", index));
      if (!Number.isInteger(value) || value < 1) throw new Error("--per-mondai harus bilangan bulat > 0");
      options.perMondai = value;
      if (consumesNext) index += 1;
      continue;
    }
    if (argument.startsWith("--limit")) {
      const value = Number(readValue(argument, "--limit", index));
      if (!Number.isInteger(value) || value < 1) throw new Error("--limit harus bilangan bulat > 0");
      options.limit = value;
      if (consumesNext) index += 1;
      continue;
    }
    if (argument.startsWith("--concurrency")) {
      const value = Number(readValue(argument, "--concurrency", index));
      if (!Number.isInteger(value) || value < 1 || value > 4) {
        throw new Error("--concurrency harus bilangan bulat 1-4");
      }
      options.concurrency = value;
      if (consumesNext) index += 1;
      continue;
    }
    if (argument.startsWith("--reasoning-effort")) {
      const value = readValue(argument, "--reasoning-effort", index)?.toLowerCase();
      if (!value || !["minimal", "low", "medium", "high"].includes(value)) {
        throw new Error("--reasoning-effort harus minimal|low|medium|high");
      }
      options.reasoningEffort = value;
      if (consumesNext) index += 1;
      continue;
    }
    if (argument.startsWith("--model")) {
      const value = readValue(argument, "--model", index);
      if (!value || value.startsWith("--")) throw new Error("--model membutuhkan nama model");
      options.model = value;
      if (consumesNext) index += 1;
      continue;
    }
    throw new Error(`argumen tidak dikenal: ${argument}`);
  }

  return options;
}

function printHelp() {
  console.log(`Usage:
  npm run choukai:explanation:generate -- --file n5-2018-07.json [options]

Options:
  --mondai <type>          Batasi satu mondai CHOUKAI
  --question <type#no>     Batasi soal tertentu; dapat diulang
  --per-mondai <n>         Ambil n soal pertama dari tiap mondai terpilih
  --limit <n>              Batas total soal
  --concurrency <n>        Paralel request 1-4 (default 1)
  --reasoning-effort <v>   minimal|low|medium|high (default high)
  --model <name>           Override model (default ag/gemini-3.8-flash)
  --include-audio          Eskalasi: lampirkan audio sebagai bukti sekunder
  --overwrite              Generate ulang entry yang inputnya belum berubah
  --dry-run                Validasi payload/media tanpa memanggil model/menulis staging
  --help                   Tampilkan bantuan`);
}

async function readJson(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf-8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`tidak dapat membaca JSON ${filePath}: ${message}`);
  }
}

async function writeJsonAtomic(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
  await fs.rename(temporary, filePath);
}

function selectQuestions(pkg, options) {
  const contexts = new Map((pkg.questionContexts ?? []).map((context) => [context.id, context]));
  const tasks = [];
  const availableKeys = new Set();

  for (const item of pkg.testPackageItems) {
    if (item.section !== "CHOUKAI") continue;
    if (options.mondai && item.mondaiType !== options.mondai) continue;

    let selectedInMondai = 0;
    for (const question of item.questions) {
      const key = `${item.mondaiType}#${question.order}`;
      availableKeys.add(key);
      if (options.questionKeys.size > 0 && !options.questionKeys.has(key)) continue;
      if (options.perMondai !== null && selectedInMondai >= options.perMondai) continue;
      selectedInMondai += 1;
      const context = question.questionContextRef
        ? (contexts.get(question.questionContextRef) ?? null)
        : null;
      tasks.push({ key, item, question, context });
    }
  }

  for (const key of options.questionKeys) {
    if (!availableKeys.has(key)) throw new Error(`soal tidak ditemukan dalam scope fixture: ${key}`);
  }
  return tasks.slice(0, options.limit);
}

function mediaFormat(contentType, url, kind) {
  if (kind === "image") {
    if (contentType?.startsWith("image/")) return contentType;
    const extension = new URL(url).pathname.split(".").pop()?.toLowerCase();
    const byExtension = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
    return byExtension[extension] ?? null;
  }

  if (contentType === "audio/mpeg") return "mp3";
  if (["audio/wav", "audio/x-wav"].includes(contentType)) return "wav";
  const extension = new URL(url).pathname.split(".").pop()?.toLowerCase();
  return extension === "mp3" || extension === "wav" ? extension : null;
}

async function downloadMedia(url, kind) {
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`${kind} gagal diunduh (${response.status}) dari ${url}`);
  const contentType = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  const format = mediaFormat(contentType, url, kind);
  if (!format) throw new Error(`format ${kind} tidak didukung (${contentType ?? "tanpa content-type"}): ${url}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length === 0) throw new Error(`${kind} kosong: ${url}`);
  return { data: buffer.toString("base64"), format, bytes: buffer.length };
}

async function buildUserContent({ pkg, item, question, context, includeAudio }) {
  const images = buildQuestionImages({ question, context });
  const parts = [
    {
      type: "text",
      text: buildUserPrompt({ pkg, item, question, context, images, includeAudio }),
    },
  ];
  const media = { images: [], audio: null };

  for (const image of images) {
    const downloaded = await downloadMedia(image.url, "image");
    parts.push({
      type: "image_url",
      image_url: { url: `data:${downloaded.format};base64,${downloaded.data}` },
    });
    media.images.push({ label: image.label, url: image.url, bytes: downloaded.bytes });
  }

  if (includeAudio) {
    const audioUrl = question.questionAudio ?? context?.storyAudio;
    const downloaded = await downloadMedia(audioUrl, "audio");
    parts.push({ type: "input_audio", input_audio: { data: downloaded.data, format: downloaded.format } });
    media.audio = { url: audioUrl, bytes: downloaded.bytes, format: downloaded.format };
  }

  return { content: parts, media };
}

async function generateOne({ client, model, reasoningEffort, task, includeAudio }) {
  const { pkg, item, question, context } = task;
  const { content, media } = await buildUserContent({ pkg, item, question, context, includeAudio });
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content },
  ];
  let usage = { input: 0, output: 0 };
  let lastProblems = [];

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const completion = await client.chat.completions.create({
      model,
      messages,
      reasoning_effort: reasoningEffort,
    });
    const reply = completion.choices?.[0]?.message?.content ?? "";
    usage = {
      input: usage.input + (completion.usage?.prompt_tokens ?? 0),
      output: usage.output + (completion.usage?.completion_tokens ?? 0),
    };
    const parsed = parseExplanationReply(reply, question);
    if (parsed.explanation) {
      return { ...parsed, usage, attempts: attempt, media };
    }

    lastProblems = parsed.problems;
    if (attempt < MAX_ATTEMPTS) {
      messages.push(
        { role: "assistant", content: reply },
        { role: "user", content: buildRetryPrompt(lastProblems) },
      );
    }
  }
  return { problems: lastProblems, usage, attempts: MAX_ATTEMPTS, media };
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

function sortedEntries(entries, orderByKey) {
  return [...entries].sort((left, right) => orderByKey.get(left.key) - orderByKey.get(right.key));
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
  if (!seedFile) throw new Error(`fixture kosong atau tidak ditemukan: ${options.selectedFile}`);

  const envResult = envSchema.safeParse(process.env);
  if (!options.dryRun && !envResult.success) {
    const missing = envResult.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`environment belum lengkap: ${missing} (lihat .env.example)`);
  }
  const env = envResult.success ? envResult.data : null;
  const model = options.model ?? env?.CHOUKAI_EXPLANATION_MODEL ?? DEFAULT_MODEL;
  const pkg = seedFile.pkg;
  const selected = selectQuestions(pkg, options).map((task) => ({ ...task, pkg }));
  if (selected.length === 0) throw new Error("tidak ada soal CHOUKAI dalam scope");

  const prerequisiteProblems = selected.flatMap((task) =>
    validateQuestionContext({ ...task, includeAudio: options.includeAudio }).map(
      (problem) => `${task.key}: ${problem}`,
    ),
  );
  if (prerequisiteProblems.length > 0) {
    throw new Error(`prasyarat belum lengkap: ${prerequisiteProblems.join("; ")}`);
  }

  const packageSlug = path.basename(seedFile.file, ".json");
  const stagingFile = path.join(STAGING_ROOT, packageSlug, "explanations.json");
  const existing = (await readJson(stagingFile)) ?? null;
  const ai = {
    model,
    promptVersion: PROMPT_VERSION,
    reasoningEffort: options.reasoningEffort,
  };
  if (existing) {
    const identityMatches =
      existing.fixtureFile === seedFile.file &&
      existing.packageName === pkg.name &&
      existing.jlptLevel === pkg.jlptLevel &&
      JSON.stringify(existing.ai) === JSON.stringify(ai);
    if (!identityMatches) {
      throw new Error("staging lama memakai fixture/model/mode berbeda; pindahkan file lama atau samakan opsi");
    }
    if (existing.review?.status === "APPROVED") {
      throw new Error("staging sudah APPROVED; jangan generate ulang, gunakan apply atau arsipkan staging");
    }
  }

  const entryMap = new Map((existing?.entries ?? []).map((entry) => [entry.key, entry]));
  const allChoukaiKeys = pkg.testPackageItems
    .filter((item) => item.section === "CHOUKAI")
    .flatMap((item) => item.questions.map((question) => `${item.mondaiType}#${question.order}`));
  const orderByKey = new Map(allChoukaiKeys.map((key, index) => [key, index]));

  const runnable = [];
  for (const task of selected) {
    const input = buildInputSnapshot({ ...task, includeAudio: options.includeAudio });
    const inputHash = hashInputSnapshot(input);
    const previous = entryMap.get(task.key);
    if (!options.overwrite && previous?.status === "GENERATED" && previous.inputHash === inputHash) {
      log(`SKIP ${task.key} - staging valid sudah ada`);
      continue;
    }
    runnable.push({ ...task, input, inputHash });
  }

  if (options.dryRun) {
    for (const task of runnable) {
      const built = await buildUserContent({ ...task, includeAudio: options.includeAudio });
      log(
        `DRY-RUN ${task.key} - transcript ${task.input.transcript.length} karakter, ` +
          `${built.media.images.length} gambar (${built.media.images.map((image) => image.bytes).join(", ") || "-"} byte), ` +
          `audio ${built.media.audio ? `${built.media.audio.bytes} byte` : "tidak dikirim"}`,
      );
    }
    log(`dry-run selesai: ${runnable.length} payload tervalidasi, staging tidak ditulis`);
    return;
  }

  const client = new OpenAI({
    apiKey: env.EXPLANATION_API_KEY,
    baseURL: env.EXPLANATION_BASE_URL,
    timeout: REQUEST_TIMEOUT_MS,
    maxRetries: 2,
    defaultHeaders: { "User-Agent": USER_AGENT },
  });
  const staging = existing ?? {
    version: 1,
    fixtureFile: seedFile.file,
    packageName: pkg.name,
    jlptLevel: pkg.jlptLevel,
    ai,
    generatedAt: new Date().toISOString(),
    entries: [],
    review: { status: "PENDING", reviewedAt: null },
  };
  let generated = 0;
  let failed = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let writeChain = Promise.resolve();

  const persistStaging = () => {
    writeChain = writeChain.then(async () => {
      staging.entries = sortedEntries(entryMap.values(), orderByKey);
      staging.generatedAt = new Date().toISOString();
      await writeJsonAtomic(stagingFile, staging);
    });
    return writeChain;
  };

  await runPool(runnable, options.concurrency, async (task) => {
    const startedAt = Date.now();
    try {
      const result = await generateOne({
        client,
        model,
        reasoningEffort: options.reasoningEffort,
        task,
        includeAudio: options.includeAudio,
      });
      inputTokens += result.usage.input;
      outputTokens += result.usage.output;
      const entry = {
        key: task.key,
        mondaiType: task.item.mondaiType,
        questionOrder: task.question.order,
        status: result.explanation ? "GENERATED" : "FAILED",
        explanation: result.explanation ?? null,
        input: {
          transcriptReviewedAt: task.input.transcriptReviewedAt,
          imageUrls: task.input.imageUrls,
          audioIncluded: options.includeAudio,
          audioUrl: task.input.audioUrl,
        },
        inputHash: task.inputHash,
        generatedAt: new Date().toISOString(),
        usage: result.usage,
        attempts: result.attempts,
        problems: result.problems ?? [],
      };
      entryMap.set(task.key, entry);
      await persistStaging();

      const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
      if (result.explanation) {
        generated += 1;
        log(`OK ${task.key} - ${result.attempts} attempt, ${seconds}s`);
        if (result.answerKeyDoubt) {
          log(`DOUBT ${task.key} - ${result.explanation.answerKeyDoubtNote}`);
        }
      } else {
        failed += 1;
        log(`FAIL ${task.key} - ${result.problems.join("; ")}`);
      }
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      entryMap.set(task.key, {
        key: task.key,
        mondaiType: task.item.mondaiType,
        questionOrder: task.question.order,
        status: "FAILED",
        explanation: null,
        input: {
          transcriptReviewedAt: task.input.transcriptReviewedAt,
          imageUrls: task.input.imageUrls,
          audioIncluded: options.includeAudio,
          audioUrl: task.input.audioUrl,
        },
        inputHash: task.inputHash,
        generatedAt: new Date().toISOString(),
        usage: { input: 0, output: 0 },
        attempts: 0,
        problems: [message],
      });
      await persistStaging();
      log(`FAIL ${task.key} - ${message}`);
    }
  });

  await writeChain;

  log(
    `selesai: ${generated} generated, ${failed} gagal, ${selected.length - runnable.length} dilewati; ` +
      `token input ${inputTokens}, output ${outputTokens}; staging ${stagingFile}`,
  );
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("[choukai:explanation:generate] gagal", error);
  process.exitCode = 1;
});
