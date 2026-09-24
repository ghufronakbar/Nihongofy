// Pemeriksa mutu data fixture bank soal.
//
// Berbeda dari `seed:test-package:check` yang hanya memvalidasi bentuk (tipe,
// enum, relasi), script ini memeriksa isinya: cacat yang membuat soal tidak
// dapat dikerjakan walaupun JSON-nya sah. Semua pemeriksaan di sini
// deterministik — tidak memanggil model sama sekali — sehingga temuannya pasti,
// bukan pendapat. Penilaian yang butuh pertimbangan ada di
// `npm run explanation:doubts`.
import fs from "node:fs/promises";
import path from "node:path";
import { assertSafeFileName, JLPT_LEVELS, SEED_DATA_DIR } from "./test-package-fixture.mjs";
import { checkPackage } from "./fixture-checks.mjs";

function log(message) {
  console.log(`[fixture:lint] ${message}`);
}

function parseArguments(argv) {
  const options = { selectedFile: null, level: null, showWarnings: true };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const consumesNext = !argument.includes("=");
    const readValue = (prefix) =>
      argument.startsWith(`${prefix}=`) ? argument.slice(prefix.length + 1) : argv[index + 1];

    if (argument === "--errors-only") {
      options.showWarnings = false;
      continue;
    }

    if (argument.startsWith("--file")) {
      const value = readValue("--file");
      if (!value || value.startsWith("--")) throw new Error("--file membutuhkan nama file *.json");
      options.selectedFile = assertSafeFileName(value);
      if (consumesNext) index += 1;
      continue;
    }

    if (argument.startsWith("--level")) {
      const value = readValue("--level")?.toUpperCase();
      if (!value || !JLPT_LEVELS.includes(value)) {
        throw new Error(`--level harus salah satu dari ${JLPT_LEVELS.join(", ")}`);
      }
      options.level = value;
      if (consumesNext) index += 1;
      continue;
    }

    throw new Error(`argumen tidak dikenal: ${argument}`);
  }

  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const entries = await fs.readdir(SEED_DATA_DIR);
  const files = (
    options.selectedFile ? [options.selectedFile] : entries.filter((name) => name.endsWith(".json"))
  ).sort();

  let errors = 0;
  let warnings = 0;
  let scannedFiles = 0;
  let scannedQuestions = 0;

  for (const file of files) {
    const raw = await fs.readFile(path.join(SEED_DATA_DIR, file), "utf-8");
    if (!raw.trim()) continue;

    const pkg = JSON.parse(raw);
    if (options.level && pkg.jlptLevel !== options.level) continue;
    scannedFiles += 1;

    const lines = [];
    for (const defect of checkPackage(pkg)) {
      if (defect.level === "error") errors += 1;
      else warnings += 1;
      if (defect.level === "warning" && !options.showWarnings) continue;

      const where =
        defect.scope === "context"
          ? `context ${defect.contextId}`
          : `${defect.mondaiType}#${defect.order}`;
      lines.push(`  ${defect.level} ${where}: ${defect.message}`);
    }
    scannedQuestions += pkg.testPackageItems.reduce((total, item) => total + item.questions.length, 0);

    if (lines.length > 0) {
      log(`${file} (${pkg.name})`);
      for (const line of lines) console.log(`[fixture:lint] ${line}`);
    }
  }

  log(
    `DONE - ${errors} error, ${warnings} warning dari ${scannedQuestions} soal di ${scannedFiles} paket`,
  );
  if (errors > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("[fixture:lint] gagal", error);
  process.exitCode = 1;
});
