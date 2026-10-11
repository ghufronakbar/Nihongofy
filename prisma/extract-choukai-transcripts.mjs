// OCR transkrip CHOUKAI dari PDF/PNG ke staging lokal yang diabaikan Git.
// Script ini tidak pernah mengubah fixture atau database. Hanya hasil yang
// sudah diaudit manusia yang kelak diterapkan lewat pipeline terpisah.
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";
import { z } from "zod";
import {
  assertSafeFileName,
  loadAndValidateSeedFiles,
} from "./test-package-fixture.mjs";
import {
  buildRetryPrompt,
  buildUserPrompt,
  parseExtractionReply,
  PROMPT_VERSION,
  SYSTEM_PROMPT,
} from "./choukai-transcript-prompt.mjs";

const execFileAsync = promisify(execFile);
const PROJECT_ROOT = fileURLToPath(new URL("../", import.meta.url));
const SOURCE_ROOT = path.join(PROJECT_ROOT, "data/sources/choukai-transcripts");
const STAGING_ROOT = path.join(PROJECT_ROOT, "data/generated/choukai-transcripts");
const REQUEST_TIMEOUT_MS = 300_000;
const SDK_MAX_RETRIES = 2;
const MAX_ATTEMPTS = 3;
const RENDER_DPI = 250;
const USER_AGENT = "nihongofy/1.0";
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

const optionalEnvString = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().min(1).optional(),
);

const envSchema = z.object({
  EXPLANATION_BASE_URL: z.url(),
  EXPLANATION_API_KEY: z.string().trim().min(1),
  CHOUKAI_TRANSCRIPT_MODEL: optionalEnvString,
});

function log(message) {
  console.log(`[choukai:transcript:extract] ${message}`);
}

function parseArguments(argv) {
  const options = {
    selectedFile: null,
    source: null,
    batchSize: 4,
    limit: Infinity,
    overwrite: false,
    dryRun: false,
    reasoningEffort: "high",
  };

  const readValue = (argument, name, index) =>
    argument.startsWith(`${name}=`) ? argument.slice(name.length + 1) : argv[index + 1];

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const consumesNext = !argument.includes("=");

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
    if (argument.startsWith("--source")) {
      const value = readValue(argument, "--source", index);
      if (!value || value.startsWith("--")) throw new Error("--source membutuhkan path PDF/gambar/folder");
      options.source = value;
      if (consumesNext) index += 1;
      continue;
    }
    if (argument.startsWith("--batch-size")) {
      const value = Number(readValue(argument, "--batch-size", index));
      if (!Number.isInteger(value) || value < 2 || value > 8) {
        throw new Error("--batch-size harus bilangan bulat 2-8");
      }
      options.batchSize = value;
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
    if (argument.startsWith("--reasoning-effort")) {
      const value = readValue(argument, "--reasoning-effort", index)?.toLowerCase();
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
  npm run choukai:transcript:extract -- --file n5-2018-07.json [options]

Options:
  --source <path>             PDF, gambar, atau folder gambar di data/sources/choukai-transcripts
  --batch-size <2-8>          Jumlah halaman per request; satu halaman overlap (default 4)
  --limit <n>                 Maksimal batch baru pada run ini
  --reasoning-effort <level>  minimal|low|medium|high (default high)
  --dry-run                   Render dan tampilkan rencana tanpa memanggil model/menulis staging
  --overwrite                 Buat ulang staging untuk sumber ini
  --help                      Tampilkan bantuan`);
}

function naturalCompare(left, right) {
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
}

async function sha256File(filePath) {
  const hash = createHash("sha256");
  hash.update(await fs.readFile(filePath));
  return hash.digest("hex");
}

async function sha256ImageSet(files) {
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(path.basename(file));
    hash.update("\0");
    hash.update(await fs.readFile(file));
    hash.update("\0");
  }
  return hash.digest("hex");
}

function mimeType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  return "image/jpeg";
}

async function fileToDataUrl(filePath) {
  return `data:${mimeType(filePath)};base64,${(await fs.readFile(filePath)).toString("base64")}`;
}

function isInside(parent, target) {
  const relative = path.relative(parent, target);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function resolveSource(options, pkg, fixtureFile) {
  const packageSlug = path.basename(fixtureFile, ".json");
  const defaultPath = path.join(SOURCE_ROOT, pkg.jlptLevel, packageSlug);
  const requested = options.source
    ? path.resolve(PROJECT_ROOT, options.source)
    : defaultPath;

  let realSourceRoot;
  try {
    realSourceRoot = await fs.realpath(SOURCE_ROOT);
  } catch {
    throw new Error(`folder sumber belum ada: ${SOURCE_ROOT}`);
  }

  let sourcePath;
  try {
    sourcePath = await fs.realpath(requested);
  } catch {
    throw new Error(`sumber tidak ditemukan: ${requested}`);
  }
  if (!isInside(realSourceRoot, sourcePath)) {
    throw new Error(`--source harus berada di dalam ${SOURCE_ROOT}`);
  }

  const stat = await fs.stat(sourcePath);
  if (stat.isFile()) {
    const extension = path.extname(sourcePath).toLowerCase();
    if (extension === ".pdf") return { kind: "pdf", sourcePath, packageSlug };
    if (IMAGE_EXTENSIONS.has(extension)) {
      return { kind: "images", sourcePath, imageFiles: [sourcePath], packageSlug };
    }
    throw new Error(`format sumber tidak didukung: ${sourcePath}`);
  }
  if (!stat.isDirectory()) throw new Error(`sumber bukan file atau folder: ${sourcePath}`);

  const entries = (await fs.readdir(sourcePath, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && !entry.name.startsWith("."))
    .map((entry) => path.join(sourcePath, entry.name));
  const pdfs = entries.filter((file) => path.extname(file).toLowerCase() === ".pdf");
  const images = entries
    .filter((file) => IMAGE_EXTENSIONS.has(path.extname(file).toLowerCase()))
    .sort(naturalCompare);

  if (pdfs.length === 1 && images.length === 0) {
    return { kind: "pdf", sourcePath: pdfs[0], packageSlug };
  }
  if (pdfs.length === 0 && images.length > 0) {
    return { kind: "images", sourcePath, imageFiles: images, packageSlug };
  }
  if (pdfs.length === 0 && images.length === 0) {
    throw new Error(`folder tidak memiliki PDF/PNG/JPG/WEBP: ${sourcePath}`);
  }
  throw new Error("gunakan tepat satu PDF atau satu folder berisi gambar saja, jangan dicampur");
}

async function preparePages(source) {
  if (source.kind === "images") {
    const pages = await Promise.all(
      source.imageFiles.map(async (filePath, index) => ({
        page: index + 1,
        filePath,
        fileName: path.basename(filePath),
        sha256: await sha256File(filePath),
      })),
    );
    return {
      pages,
      sourceSha256: await sha256ImageSet(source.imageFiles),
      cleanup: async () => {},
    };
  }

  const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "nihongofy-choukai-ocr-"));
  const prefix = path.join(temporaryDirectory, "page");
  try {
    await execFileAsync("pdftoppm", ["-png", "-r", String(RENDER_DPI), source.sourcePath, prefix]);
    const rendered = (await fs.readdir(temporaryDirectory))
      .filter((name) => name.startsWith("page-") && name.endsWith(".png"))
      .sort(naturalCompare)
      .map((name) => path.join(temporaryDirectory, name));
    if (rendered.length === 0) throw new Error("pdftoppm tidak menghasilkan halaman PNG");

    const pages = await Promise.all(
      rendered.map(async (filePath, index) => ({
        page: index + 1,
        filePath,
        fileName: path.basename(filePath),
        sha256: await sha256File(filePath),
      })),
    );
    return {
      pages,
      sourceSha256: await sha256File(source.sourcePath),
      cleanup: () => fs.rm(temporaryDirectory, { recursive: true, force: true }),
    };
  } catch (error) {
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
    throw error;
  }
}

function buildBatches(pages, batchSize) {
  const batches = [];
  let start = 0;
  while (start < pages.length) {
    const end = Math.min(start + batchSize, pages.length);
    const batchPages = pages.slice(start, end);
    batches.push({
      key: `${batchPages[0].page}-${batchPages.at(-1).page}`,
      pages: batchPages,
    });
    if (end === pages.length) break;
    start = end - 1;
  }
  return batches;
}

function expectedChoukai(pkg) {
  return pkg.testPackageItems
    .filter((item) => item.section === "CHOUKAI")
    .map((item) => ({ mondaiType: item.mondaiType, questionCount: item.questions.length }));
}

function mergeExtraction(expected, batches) {
  const byKey = new Map();
  const conflicts = [];
  const unassigned = [];

  for (const batch of batches.filter((entry) => entry.status === "EXTRACTED")) {
    unassigned.push(...batch.unassigned.map((entry) => ({ ...entry, batch: batch.key })));
    for (const entry of batch.entries) {
      const key = `${entry.mondaiType}#${entry.questionOrder}`;
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, { ...entry });
        continue;
      }

      const left = existing.transcript.trim();
      const right = entry.transcript.trim();
      if (left === right || left.includes(right) || right.includes(left)) {
        if (right.length > left.length) existing.transcript = entry.transcript;
        existing.sourcePages = [...new Set([...existing.sourcePages, ...entry.sourcePages])].sort(
          (a, b) => a - b,
        );
        existing.doubt = [existing.doubt, entry.doubt].filter(Boolean).join("; ") || null;
        continue;
      }

      conflicts.push({ key, variants: [existing, entry] });
    }
  }

  const entries = [...byKey.values()].sort((left, right) => {
    const mondaiOrder = expected.findIndex((item) => item.mondaiType === left.mondaiType) -
      expected.findIndex((item) => item.mondaiType === right.mondaiType);
    return mondaiOrder || left.questionOrder - right.questionOrder;
  });
  const expectedKeys = expected.flatMap((item) =>
    Array.from({ length: item.questionCount }, (_, index) => `${item.mondaiType}#${index + 1}`),
  );
  const missing = expectedKeys.filter((key) => !byKey.has(key));

  return { entries, conflicts, missing, unassigned };
}

async function writeJsonAtomic(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
  await fs.rename(temporary, filePath);
}

async function readExisting(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf-8"));
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
}

function createClient(env) {
  return new OpenAI({
    apiKey: env.EXPLANATION_API_KEY,
    baseURL: env.EXPLANATION_BASE_URL,
    timeout: REQUEST_TIMEOUT_MS,
    maxRetries: SDK_MAX_RETRIES,
    defaultHeaders: { "User-Agent": USER_AGENT },
  });
}

async function extractBatch({ client, model, reasoningEffort, pkg, expected, batch }) {
  const pageNumbers = batch.pages.map((page) => page.page);
  const content = [{ type: "text", text: buildUserPrompt({ pkg, expected, pageNumbers }) }];
  for (const page of batch.pages) {
    content.push(
      { type: "text", text: `HALAMAN ${page.page}` },
      { type: "image_url", image_url: { url: await fileToDataUrl(page.filePath) } },
    );
  }

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content },
  ];
  const expectedByMondai = new Map(expected.map((item) => [item.mondaiType, item.questionCount]));
  const allowedPages = new Set(pageNumbers);
  const usage = { input: 0, output: 0 };
  let lastProblems = [];
  let lastReply = "";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const completion = await client.chat.completions.create({
      model,
      messages,
      reasoning_effort: reasoningEffort,
    });
    const reply = completion.choices?.[0]?.message?.content ?? "";
    lastReply = reply;
    usage.input += completion.usage?.prompt_tokens ?? 0;
    usage.output += completion.usage?.completion_tokens ?? 0;

    const parsed = parseExtractionReply(reply, { expectedByMondai, allowedPages });
    if (parsed.value) return { value: parsed.value, attempts: attempt, usage };

    lastProblems = parsed.problems;
    if (attempt < MAX_ATTEMPTS) {
      messages.push(
        { role: "assistant", content: reply },
        { role: "user", content: buildRetryPrompt(lastProblems) },
      );
    }
  }

  return { problems: lastProblems, rawReply: lastReply, attempts: MAX_ATTEMPTS, usage };
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
  const { file: fixtureFile, pkg } = seedFile;
  const expected = expectedChoukai(pkg);
  if (expected.length === 0) throw new Error(`fixture tidak memiliki section CHOUKAI: ${fixtureFile}`);

  const source = await resolveSource(options, pkg, fixtureFile);
  const prepared = await preparePages(source);
  try {
    const batches = buildBatches(prepared.pages, options.batchSize);
    const sourceRelativePath = path.relative(SOURCE_ROOT, source.sourcePath);
    const stagingFile = path.join(STAGING_ROOT, source.packageSlug, "extraction.json");

    log(
      `${pkg.name}: ${prepared.pages.length} halaman, ${batches.length} batch, sumber ${sourceRelativePath}`,
    );
    if (options.dryRun) {
      log(`DRY-RUN batch: ${batches.map((batch) => batch.key).join(", ")}`);
      log(`DRY-RUN prompt (${PROMPT_VERSION}):\n${buildUserPrompt({
        pkg,
        expected,
        pageNumbers: batches[0].pages.map((page) => page.page),
      })}`);
      return;
    }

    const envResult = envSchema.safeParse(process.env);
    if (!envResult.success) {
      const missing = envResult.error.issues.map((issue) => issue.path.join(".")).join(", ");
      throw new Error(`environment belum lengkap: ${missing} (lihat .env.example)`);
    }
    const env = envResult.data;
    const model = env.CHOUKAI_TRANSCRIPT_MODEL ?? "ag/gemini-3.8-flash";
    const client = createClient(env);
    const existing = options.overwrite ? null : await readExisting(stagingFile);

    if (existing) {
      if (existing.review?.status === "APPROVED") {
        throw new Error(
          `staging sudah APPROVED dan dikunci dari ekstraksi ulang; gunakan --overwrite hanya bila audit memang akan dibuang: ${stagingFile}`,
        );
      }
      const incompatible =
        existing.fixtureFile !== fixtureFile ||
        existing.source?.sha256 !== prepared.sourceSha256 ||
        existing.ai?.model !== model ||
        existing.ai?.promptVersion !== PROMPT_VERSION ||
        existing.ai?.reasoningEffort !== options.reasoningEffort;
      if (incompatible) {
        throw new Error(`staging lama tidak cocok; tinjau lalu jalankan ulang dengan --overwrite: ${stagingFile}`);
      }
    }

    const now = new Date().toISOString();
    const staging = existing ?? {
      version: 1,
      fixtureFile,
      packageName: pkg.name,
      jlptLevel: pkg.jlptLevel,
      source: {
        kind: source.kind,
        path: sourceRelativePath,
        sha256: prepared.sourceSha256,
        pageCount: prepared.pages.length,
        renderDpi: source.kind === "pdf" ? RENDER_DPI : null,
        pages: prepared.pages.map((page) => ({
          page: page.page,
          fileName: page.fileName,
          sha256: page.sha256,
        })),
      },
      ai: { model, promptVersion: PROMPT_VERSION, reasoningEffort: options.reasoningEffort },
      generatedAt: now,
      updatedAt: now,
      batches: [],
      merged: { entries: [], conflicts: [], missing: [], unassigned: [] },
      review: { status: "PENDING", reviewedAt: null },
    };

    const byBatchKey = new Map(staging.batches.map((batch) => [batch.key, batch]));
    let processed = 0;
    let failed = 0;

    for (const batch of batches) {
      if (byBatchKey.get(batch.key)?.status === "EXTRACTED") {
        log(`SKIP batch ${batch.key} - sudah berhasil`);
        continue;
      }
      if (processed >= options.limit) break;
      processed += 1;

      try {
        const result = await extractBatch({
          client,
          model,
          reasoningEffort: options.reasoningEffort,
          pkg,
          expected,
          batch,
        });
        const record = result.value
          ? {
              key: batch.key,
              pages: batch.pages.map((page) => page.page),
              status: "EXTRACTED",
              attempts: result.attempts,
              usage: result.usage,
              entries: result.value.entries,
              unassigned: result.value.unassigned,
              problems: [],
            }
          : {
              key: batch.key,
              pages: batch.pages.map((page) => page.page),
              status: "FAILED",
              attempts: result.attempts,
              usage: result.usage,
              entries: [],
              unassigned: [],
              problems: result.problems,
              rawReply: result.rawReply,
            };
        byBatchKey.set(batch.key, record);
        if (!result.value) failed += 1;
        log(
          result.value
            ? `OK batch ${batch.key}: ${result.value.entries.length} soal, ${result.value.unassigned.length} belum terpetakan`
            : `FAIL batch ${batch.key}: ${result.problems.join("; ")}`,
        );
      } catch (error) {
        failed += 1;
        const message = error instanceof Error ? error.message : String(error);
        byBatchKey.set(batch.key, {
          key: batch.key,
          pages: batch.pages.map((page) => page.page),
          status: "FAILED",
          attempts: 0,
          usage: { input: 0, output: 0 },
          entries: [],
          unassigned: [],
          problems: [message],
        });
        log(`FAIL batch ${batch.key}: ${message}`);
      }

      staging.batches = [...byBatchKey.values()].sort((left, right) =>
        naturalCompare(left.key, right.key),
      );
      staging.merged = mergeExtraction(expected, staging.batches);
      staging.review = { status: "PENDING", reviewedAt: null };
      staging.updatedAt = new Date().toISOString();
      await writeJsonAtomic(stagingFile, staging);
    }

    staging.batches = [...byBatchKey.values()].sort((left, right) => naturalCompare(left.key, right.key));
    staging.merged = mergeExtraction(expected, staging.batches);
    staging.updatedAt = new Date().toISOString();
    await writeJsonAtomic(stagingFile, staging);

    const extractedCount = staging.batches.filter((batch) => batch.status === "EXTRACTED").length;
    const failedCount = staging.batches.filter((batch) => batch.status === "FAILED").length;
    const completeRun =
      options.limit === Infinity &&
      staging.batches.length === batches.length &&
      extractedCount + failedCount === batches.length;
    log(
      `DONE - ${extractedCount}/${batches.length} batch berhasil, ${staging.merged.entries.length} soal terpetakan, ` +
        `${staging.merged.missing.length} belum ditemukan, ${staging.merged.conflicts.length} konflik, ` +
        `${staging.merged.unassigned.length} blok belum terpetakan; staging ${stagingFile}`,
    );

    if (
      failed > 0 ||
      (completeRun && failedCount > 0) ||
      (completeRun &&
        (staging.merged.missing.length > 0 ||
          staging.merged.conflicts.length > 0 ||
          staging.merged.unassigned.length > 0))
    ) {
      process.exitCode = 1;
    }
  } finally {
    await prepared.cleanup();
  }
}

main().catch((error) => {
  console.error("[choukai:transcript:extract] gagal", error);
  process.exitCode = 1;
});
