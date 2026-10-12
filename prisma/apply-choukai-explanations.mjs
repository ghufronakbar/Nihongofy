// Terapkan pembahasan CHOUKAI yang sudah diaudit dari staging ke fixture lokal.
// Database tetap tidak disentuh; sinkronisasi DB memakai seed:question-explanation.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertSafeFileName,
  loadAndValidateSeedFiles,
  seedTestPackageSchema,
  SEED_DATA_DIR,
} from "./test-package-fixture.mjs";
import {
  buildInputSnapshot,
  hashInputSnapshot,
  PROMPT_VERSION,
} from "./choukai-explanation-prompt.mjs";

const PROJECT_ROOT = fileURLToPath(new URL("../", import.meta.url));
const STAGING_ROOT = path.join(PROJECT_ROOT, "data/generated/choukai-explanations");

function log(message) {
  console.log(`[choukai:explanation:apply] ${message}`);
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
  npm run choukai:explanation:apply -- --file n5-2018-07.json [options]

Options:
  --check       Validasi staging dan tampilkan rencana tanpa menulis fixture
  --overwrite   Ganti pembahasan fixture yang sudah ada bila berbeda
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

function questionIndex(pkg) {
  const contexts = new Map((pkg.questionContexts ?? []).map((context) => [context.id, context]));
  const index = new Map();
  for (const item of pkg.testPackageItems) {
    if (item.section !== "CHOUKAI") continue;
    for (const question of item.questions) {
      const key = `${item.mondaiType}#${question.order}`;
      const context = question.questionContextRef
        ? (contexts.get(question.questionContextRef) ?? null)
        : null;
      index.set(key, { item, question, context });
    }
  }
  return index;
}

function validateStaging(staging, { fixtureFile, pkg, questions }) {
  const problems = [];
  if (!staging || typeof staging !== "object" || Array.isArray(staging)) {
    return ["staging harus berupa objek JSON"];
  }
  if (staging.version !== 1) problems.push(`version staging tidak didukung: ${staging.version}`);
  if (staging.fixtureFile !== fixtureFile) problems.push("fixtureFile staging tidak cocok");
  if (staging.packageName !== pkg.name) problems.push("packageName staging tidak cocok");
  if (staging.jlptLevel !== pkg.jlptLevel) problems.push("jlptLevel staging tidak cocok");
  if (staging.ai?.promptVersion !== PROMPT_VERSION) {
    problems.push(`promptVersion harus ${PROMPT_VERSION}`);
  }
  if (!staging.ai?.model || !staging.ai?.reasoningEffort) {
    problems.push("metadata ai.model dan ai.reasoningEffort wajib ada");
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
  if (!Array.isArray(staging.entries) || staging.entries.length === 0) {
    problems.push("entries staging harus berisi minimal satu soal");
    return problems;
  }

  const seen = new Set();
  for (const [index, entry] of staging.entries.entries()) {
    const key = `${entry?.mondaiType}#${entry?.questionOrder}`;
    if (entry?.key !== key) problems.push(`entries.${index}.key tidak konsisten: ${entry?.key}`);
    if (seen.has(key)) problems.push(`entries.${index}: soal duplikat ${key}`);
    seen.add(key);
    const target = questions.get(key);
    if (!target) {
      problems.push(`entries.${index}: soal tidak dikenal ${key}`);
      continue;
    }
    if (entry.status !== "GENERATED") problems.push(`${key}: status harus GENERATED`);
    if (!entry.explanation || typeof entry.explanation !== "object") {
      problems.push(`${key}: explanation tidak tersedia`);
    }
    if (typeof entry.generatedAt !== "string" || Number.isNaN(Date.parse(entry.generatedAt))) {
      problems.push(`${key}: generatedAt tidak valid`);
    }
    if (!Array.isArray(entry.problems) || entry.problems.length > 0) {
      problems.push(`${key}: problems harus berupa array kosong`);
    }
    if (typeof entry.input?.audioIncluded !== "boolean") {
      problems.push(`${key}: input.audioIncluded harus boolean`);
    }
    const snapshot = buildInputSnapshot({
      pkg,
      ...target,
      includeAudio: Boolean(entry.input?.audioIncluded),
    });
    const currentHash = hashInputSnapshot(snapshot);
    if (entry.inputHash !== currentHash) {
      problems.push(`${key}: input fixture berubah sejak pembahasan dibuat`);
    }
  }
  return problems;
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
  await fs.writeFile(temporary, `${JSON.stringify(pkg, null, 2)}\n`, "utf-8");
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

  const fixturePath = path.join(SEED_DATA_DIR, seedFile.file);
  const rawPkg = await readJson(fixturePath);
  const packageSlug = path.basename(seedFile.file, ".json");
  const stagingFile = path.join(STAGING_ROOT, packageSlug, "explanations.json");
  const staging = await readJson(stagingFile);
  const questions = questionIndex(rawPkg);
  const problems = validateStaging(staging, {
    fixtureFile: seedFile.file,
    pkg: seedFile.pkg,
    questions,
  });
  if (problems.length > 0) {
    throw new Error(`staging belum siap diterapkan: ${problems.join("; ")}`);
  }

  let created = 0;
  let updated = 0;
  let unchanged = 0;
  for (const entry of staging.entries) {
    const key = `${entry.mondaiType}#${entry.questionOrder}`;
    const target = questions.get(key).question;
    const incoming = {
      ...entry.explanation,
      meta: {
        source: "AI",
        aiModel: staging.ai.model,
        promptVersion: staging.ai.promptVersion,
        generatedAt: new Date(entry.generatedAt ?? staging.generatedAt).toISOString(),
        reviewedAt: new Date(staging.review.reviewedAt).toISOString(),
      },
    };

    if (!target.explanation) {
      target.explanation = incoming;
      created += 1;
      continue;
    }
    if (JSON.stringify(target.explanation) === JSON.stringify(incoming)) {
      unchanged += 1;
      continue;
    }
    if (!options.overwrite) {
      throw new Error(`${key} sudah memiliki pembahasan berbeda; gunakan --overwrite setelah ditinjau`);
    }
    target.explanation = incoming;
    updated += 1;
  }

  const parsedFixture = seedTestPackageSchema.safeParse(rawPkg);
  if (!parsedFixture.success) {
    const fixtureProblems = parsedFixture.error.issues
      .slice(0, 10)
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`fixture tidak valid setelah penerapan: ${fixtureProblems}`);
  }

  log(
    `${seedFile.file}: ${created} baru, ${updated} diperbarui, ${unchanged} tetap` +
      (options.check ? " (check, file tidak ditulis)" : ""),
  );
  if (options.check) return;
  await writeFixtureAtomic(fixturePath, rawPkg);
  log(`fixture diperbarui: ${fixturePath}`);
}

main().catch((error) => {
  console.error("[choukai:explanation:apply] gagal", error);
  process.exitCode = 1;
});
