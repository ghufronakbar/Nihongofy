// Transkripsikan audio per-mondai sebagai sumber audit independen untuk hasil OCR PDF.
// Hasil hanya ditulis ke staging gitignored dan tidak mengubah fixture/database.
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { assertSafeFileName, loadAndValidateSeedFiles } from "./test-package-fixture.mjs";

const execFileAsync = promisify(execFile);
const PROJECT_ROOT = fileURLToPath(new URL("../", import.meta.url));
const AUDIO_ROOT = path.join(PROJECT_ROOT, "data/audio");
const STAGING_ROOT = path.join(PROJECT_ROOT, "data/generated/choukai-transcripts");
const REQUEST_TIMEOUT_MS = 300_000;
const MAX_ATTEMPTS = 4;
const DEFAULT_RETRY_DELAY_MS = 45_000;
const PROMPT_VERSION = "choukai-audio-audit-v1";

const optionalEnvString = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().min(1).optional(),
);

const envSchema = z.object({
  EXPLANATION_BASE_URL: z.url(),
  EXPLANATION_API_KEY: z.string().trim().min(1),
  CHOUKAI_AUDIO_TRANSCRIPTION_MODEL: optionalEnvString,
});

function log(message) {
  console.log(`[choukai:transcript:audio-audit] ${message}`);
}

function parseArguments(argv) {
  const options = { selectedFile: null, limit: Infinity, overwrite: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--overwrite") {
      options.overwrite = true;
      continue;
    }
    if (argument === "--help") {
      options.help = true;
      continue;
    }
    if (argument === "--file" || argument.startsWith("--file=")) {
      const value = argument.startsWith("--file=")
        ? argument.slice("--file=".length)
        : argv[++index];
      if (!value || value.startsWith("--")) throw new Error("--file membutuhkan nama fixture *.json");
      options.selectedFile = assertSafeFileName(value);
      continue;
    }
    if (argument === "--limit" || argument.startsWith("--limit=")) {
      const raw = argument.startsWith("--limit=")
        ? argument.slice("--limit=".length)
        : argv[++index];
      const value = Number(raw);
      if (!Number.isInteger(value) || value < 1) throw new Error("--limit harus bilangan bulat > 0");
      options.limit = value;
      continue;
    }
    throw new Error(`argumen tidak dikenal: ${argument}`);
  }
  return options;
}

function printHelp() {
  console.log(`Usage:
  npm run choukai:transcript:audio-audit -- --file n5-2018-07.json [options]

Options:
  --limit <n>  Maksimal audio per-mondai baru pada run ini
  --overwrite  Transkripsikan ulang seluruh audio
  --help       Tampilkan bantuan`);
}

async function sha256File(filePath) {
  const hash = createHash("sha256");
  hash.update(await fs.readFile(filePath));
  return hash.digest("hex");
}

async function durationSeconds(filePath) {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=nw=1:nk=1",
    filePath,
  ]);
  const value = Number(stdout.trim());
  if (!Number.isFinite(value) || value <= 0) throw new Error(`durasi audio tidak valid: ${filePath}`);
  return value;
}

async function readJson(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf-8"));
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
}

async function writeJsonAtomic(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
  await fs.rename(temporary, filePath);
}

async function transcribe({ baseUrl, apiKey, model, filePath }) {
  const bytes = await fs.readFile(filePath);
  const startedAt = Date.now();
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const form = new FormData();
    form.append("file", new Blob([bytes], { type: "audio/mpeg" }), path.basename(filePath));
    form.append("model", model);

    let response;
    try {
      response = await fetch(`${baseUrl.replace(/\/$/, "")}/audio/transcriptions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      if (attempt === MAX_ATTEMPTS) throw error;
      const message = error instanceof Error ? error.message : String(error);
      log(`network error ${JSON.stringify(message)}; retry ${attempt + 1}/${MAX_ATTEMPTS} setelah ${DEFAULT_RETRY_DELAY_MS} ms`);
      await new Promise((resolve) => setTimeout(resolve, DEFAULT_RETRY_DELAY_MS));
      continue;
    }
    const body = await response.text();
    if (response.ok) {
      let parsed;
      try {
        parsed = JSON.parse(body);
      } catch {
        throw new Error("respons transkripsi bukan JSON valid");
      }
      if (typeof parsed.text !== "string" || !parsed.text.trim()) {
        throw new Error("respons transkripsi tidak memiliki text");
      }
      return {
        text: parsed.text.trim(),
        elapsedMs: Date.now() - startedAt,
        attempts: attempt,
      };
    }

    const retryable = [429, 502, 503, 504].includes(response.status);
    if (!retryable || attempt === MAX_ATTEMPTS) {
      throw new Error(`HTTP ${response.status}: ${body.slice(0, 1000)}`);
    }
    const retryAfterSeconds = Number(response.headers.get("retry-after"));
    const bodyDelaySeconds = Number(body.match(/reset after\s+(\d+)s/i)?.[1]);
    const delaySeconds = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
      ? retryAfterSeconds
      : Number.isFinite(bodyDelaySeconds) && bodyDelaySeconds > 0
        ? bodyDelaySeconds
        : DEFAULT_RETRY_DELAY_MS / 1000;
    const delayMs = Math.max(10_000, delaySeconds * 1000);
    log(`HTTP ${response.status}; retry ${attempt + 1}/${MAX_ATTEMPTS} setelah ${delayMs} ms`);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error("transkripsi gagal tanpa respons akhir");
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
  const model = env.CHOUKAI_AUDIO_TRANSCRIPTION_MODEL ?? "gemini/gemini-3.8-flash";
  const packageSlug = path.basename(seedFile.file, ".json");
  const outputFile = path.join(STAGING_ROOT, packageSlug, "audio-audit.json");
  const existing = options.overwrite ? null : await readJson(outputFile);
  if (existing && (existing.fixtureFile !== seedFile.file || existing.ai?.model !== model)) {
    throw new Error(`staging lama tidak kompatibel; gunakan --overwrite setelah ditinjau: ${outputFile}`);
  }

  const items = seedFile.pkg.testPackageItems
    .filter((item) => item.section === "CHOUKAI")
    .sort((left, right) => left.order - right.order);
  const now = new Date().toISOString();
  const staging = existing ?? {
    version: 1,
    fixtureFile: seedFile.file,
    packageName: seedFile.pkg.name,
    jlptLevel: seedFile.pkg.jlptLevel,
    ai: { model, promptVersion: PROMPT_VERSION },
    generatedAt: now,
    updatedAt: now,
    clips: [],
  };
  const byMondai = new Map(staging.clips.map((clip) => [clip.mondaiType, clip]));
  let processed = 0;
  let failed = 0;

  for (const item of items) {
    if (byMondai.get(item.mondaiType)?.status === "TRANSCRIBED") {
      log(`SKIP ${item.mondaiType} - sudah berhasil`);
      continue;
    }
    if (processed >= options.limit) break;
    processed += 1;

    const fileName = `${packageSlug}-${String(item.order).padStart(2, "0")}.mp3`;
    const filePath = path.join(AUDIO_ROOT, packageSlug, fileName);
    const source = {
      path: path.relative(PROJECT_ROOT, filePath),
      sha256: await sha256File(filePath),
      durationSeconds: await durationSeconds(filePath),
    };
    try {
      const result = await transcribe({
        baseUrl: env.EXPLANATION_BASE_URL,
        apiKey: env.EXPLANATION_API_KEY,
        model,
        filePath,
      });
      byMondai.set(item.mondaiType, {
        mondaiType: item.mondaiType,
        itemOrder: item.order,
        questionCount: item.questions.length,
        status: "TRANSCRIBED",
        source,
        elapsedMs: result.elapsedMs,
        attempts: result.attempts,
        text: result.text,
        error: null,
      });
      log(`${item.mondaiType}: OK ${result.text.length} karakter dalam ${result.elapsedMs} ms`);
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      byMondai.set(item.mondaiType, {
        mondaiType: item.mondaiType,
        itemOrder: item.order,
        questionCount: item.questions.length,
        status: "FAILED",
        source,
        elapsedMs: null,
        attempts: MAX_ATTEMPTS,
        text: null,
        error: message,
      });
      log(`${item.mondaiType}: FAIL ${message}`);
    }

    staging.clips = [...byMondai.values()].sort((left, right) => left.itemOrder - right.itemOrder);
    staging.updatedAt = new Date().toISOString();
    await writeJsonAtomic(outputFile, staging);
  }

  const succeeded = staging.clips.filter((clip) => clip.status === "TRANSCRIBED").length;
  log(`DONE - ${succeeded}/${items.length} audio berhasil; staging ${outputFile}`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("[choukai:transcript:audio-audit] gagal", error);
  process.exitCode = 1;
});
