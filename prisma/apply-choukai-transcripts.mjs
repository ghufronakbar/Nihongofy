// Terapkan hasil OCR yang sudah diaudit dari staging ke fixture lokal.
// Script ini tidak menyentuh database; setelah fixture ditinjau, gunakan
// seed:question-transcript untuk sinkronisasi in-place ke database.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertSafeFileName,
  loadAndValidateSeedFiles,
  seedTestPackageSchema,
  SEED_DATA_DIR,
} from "./test-package-fixture.mjs";

const PROJECT_ROOT = fileURLToPath(new URL("../", import.meta.url));
const STAGING_ROOT = path.join(PROJECT_ROOT, "data/generated/choukai-transcripts");

function log(message) {
  console.log(`[choukai:transcript:apply] ${message}`);
}

function parseArguments(argv) {
  const options = { selectedFile: null, check: false, overwrite: false };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--check") {
      options.check = true;
      continue;
    }
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
    throw new Error(`argumen tidak dikenal: ${argument}`);
  }

  return options;
}

function printHelp() {
  console.log(`Usage:
  npm run choukai:transcript:apply -- --file n5-2018-07.json [options]

Options:
  --check       Validasi staging dan tampilkan rencana tanpa menulis fixture
  --overwrite   Ganti audioTranscript yang sudah ada bila isinya berbeda
  --help        Tampilkan bantuan`);
}

async function readJson(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf-8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`tidak dapat membaca JSON ${filePath}: ${message}`);
  }
}

function expectedQuestions(pkg) {
  return pkg.testPackageItems
    .filter((item) => item.section === "CHOUKAI")
    .flatMap((item) =>
      item.questions.map((question) => ({
        key: `${item.mondaiType}#${question.order}`,
        item,
        question,
      })),
    );
}

function validateStaging(staging, { fixtureFile, pkg, expected }) {
  const problems = [];
  if (!staging || typeof staging !== "object" || Array.isArray(staging)) {
    return ["staging harus berupa objek JSON"];
  }
  if (staging.fixtureFile !== fixtureFile) {
    problems.push(`fixtureFile staging ${JSON.stringify(staging.fixtureFile)} tidak cocok dengan ${fixtureFile}`);
  }
  if (staging.packageName !== pkg.name) {
    problems.push(`packageName staging tidak cocok dengan fixture: ${staging.packageName}`);
  }
  if (staging.jlptLevel !== pkg.jlptLevel) {
    problems.push(`jlptLevel staging tidak cocok dengan fixture: ${staging.jlptLevel}`);
  }
  if (staging.review?.status !== "APPROVED") {
    problems.push("review.status harus APPROVED setelah audit manusia");
  }
  if (
    typeof staging.review?.reviewedAt !== "string" ||
    Number.isNaN(Date.parse(staging.review.reviewedAt))
  ) {
    problems.push("review.reviewedAt harus timestamp ISO-8601 yang valid");
  }
  if (typeof staging.generatedAt !== "string" || Number.isNaN(Date.parse(staging.generatedAt))) {
    problems.push("generatedAt staging tidak valid");
  }
  if (!staging.ai?.model || !staging.ai?.promptVersion) {
    problems.push("metadata ai.model dan ai.promptVersion wajib ada");
  }

  const merged = staging.merged;
  if (!merged || typeof merged !== "object" || Array.isArray(merged)) {
    problems.push("merged tidak ada atau bukan objek");
    return problems;
  }
  for (const field of ["conflicts", "missing", "unassigned"]) {
    if (!Array.isArray(merged[field])) problems.push(`merged.${field} harus array`);
    else if (merged[field].length > 0) problems.push(`merged.${field} harus kosong sebelum approval`);
  }
  if (!Array.isArray(merged.entries)) {
    problems.push("merged.entries harus array");
    return problems;
  }

  const expectedKeys = new Set(expected.map((entry) => entry.key));
  const seen = new Set();
  for (const [index, entry] of merged.entries.entries()) {
    const key = `${entry?.mondaiType}#${entry?.questionOrder}`;
    if (!expectedKeys.has(key)) problems.push(`merged.entries.${index}: soal tidak dikenal ${key}`);
    if (seen.has(key)) problems.push(`merged.entries.${index}: soal duplikat ${key}`);
    seen.add(key);
    if (typeof entry?.transcript !== "string" || !entry.transcript.trim()) {
      problems.push(`merged.entries.${index}: transcript kosong`);
    }
  }
  for (const key of expectedKeys) {
    if (!seen.has(key)) problems.push(`transkrip belum ada: ${key}`);
  }

  return problems;
}

function transcriptValue(staging, entry) {
  return {
    text: entry.transcript.trim(),
    meta: {
      source: "AI",
      aiModel: staging.ai.model,
      promptVersion: staging.ai.promptVersion,
      generatedAt: new Date(staging.generatedAt).toISOString(),
      reviewedAt: new Date(staging.review.reviewedAt).toISOString(),
    },
  };
}

async function writeFixtureAtomic(filePath, pkg) {
  const parsed = seedTestPackageSchema.safeParse(pkg);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .slice(0, 10)
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`fixture tidak valid setelah penerapan: ${problems}`);
  }

  const temporary = `${filePath}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(parsed.data, null, 2)}\n`, "utf-8");
  await fs.rename(temporary, filePath);
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
  const packageSlug = path.basename(fixtureFile, ".json");
  const stagingFile = path.join(STAGING_ROOT, packageSlug, "extraction.json");
  const staging = await readJson(stagingFile);
  const expected = expectedQuestions(pkg);
  const problems = validateStaging(staging, { fixtureFile, pkg, expected });
  if (problems.length > 0) {
    throw new Error(`staging belum siap diterapkan: ${problems.join("; ")}`);
  }

  const entriesByKey = new Map(
    staging.merged.entries.map((entry) => [
      `${entry.mondaiType}#${entry.questionOrder}`,
      entry,
    ]),
  );
  let created = 0;
  let updated = 0;
  let unchanged = 0;

  for (const { key, question } of expected) {
    const incoming = transcriptValue(staging, entriesByKey.get(key));
    if (!question.audioTranscript) {
      question.audioTranscript = incoming;
      created += 1;
      continue;
    }
    if (JSON.stringify(question.audioTranscript) === JSON.stringify(incoming)) {
      unchanged += 1;
      continue;
    }
    if (!options.overwrite) {
      throw new Error(`${key} sudah memiliki audioTranscript berbeda; gunakan --overwrite setelah ditinjau`);
    }
    question.audioTranscript = incoming;
    updated += 1;
  }

  log(
    `${fixtureFile}: ${created} baru, ${updated} diperbarui, ${unchanged} tetap` +
      (options.check ? " (check, file tidak ditulis)" : ""),
  );
  if (options.check) return;

  await writeFixtureAtomic(path.join(SEED_DATA_DIR, fixtureFile), pkg);
  log(`fixture diperbarui: ${path.join(SEED_DATA_DIR, fixtureFile)}`);
}

main().catch((error) => {
  console.error("[choukai:transcript:apply] gagal", error);
  process.exitCode = 1;
});
