// Daftar soal yang ditandai generator sebagai "kunci jawaban meragukan".
//
// Membaca fixture, bukan database, supaya laporan tetap bisa dilihat sebelum
// pembahasan diimpor. Penanda ini berarti model menolak mengarang pembenaran
// untuk kunci yang tampak keliru — hampir selalu menunjuk cacat data hasil
// ekstraksi (pilihan kembar, potongan kalimat salah salin, atau gambar yang
// belum ada), jadi keluarannya adalah daftar periksa, bukan daftar kegagalan.
import fs from "node:fs/promises";
import path from "node:path";
import { assertSafeFileName, JLPT_LEVELS, SEED_DATA_DIR } from "./test-package-fixture.mjs";

function log(message) {
  console.log(`[explanation:doubts] ${message}`);
}

function parseArguments(argv) {
  const options = { selectedFile: null, level: null, showChoices: true };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const consumesNext = !argument.includes("=");
    const readValue = (prefix) =>
      argument.startsWith(`${prefix}=`) ? argument.slice(prefix.length + 1) : argv[index + 1];

    if (argument === "--no-choices") {
      options.showChoices = false;
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
  const files = (options.selectedFile ? [options.selectedFile] : entries.filter((n) => n.endsWith(".json"))).sort();

  let scanned = 0;
  let explained = 0;
  let flagged = 0;

  for (const file of files) {
    const raw = await fs.readFile(path.join(SEED_DATA_DIR, file), "utf-8");
    if (!raw.trim()) continue;

    const pkg = JSON.parse(raw);
    if (options.level && pkg.jlptLevel !== options.level) continue;
    scanned += 1;

    for (const item of pkg.testPackageItems) {
      for (const question of item.questions) {
        const explanation = question.explanation;
        if (!explanation || typeof explanation === "string") continue;
        explained += 1;
        if (!explanation.answerKeyDoubt) continue;

        flagged += 1;
        console.log("");
        log(`${file} ${item.mondaiType}#${question.order} - kunci ${question.questionAnswer}`);
        if (question.questionText) log(`  soal    : ${question.questionText}`);
        if (options.showChoices) {
          for (const choice of [...question.questionChoices].sort((a, b) => a.codeAnswer - b.codeAnswer)) {
            const marker = choice.codeAnswer === question.questionAnswer ? "*" : " ";
            log(`  ${marker}${choice.codeAnswer}. ${choice.answerText || "(tanpa teks)"}`);
          }
        }
        log(`  alasan  : ${explanation.answerKeyDoubtNote ?? "(tidak dicatat)"}`);
      }
    }
  }

  console.log("");
  log(`DONE - ${flagged} soal ditandai ragu dari ${explained} pembahasan di ${scanned} paket`);
}

main().catch((error) => {
  console.error("[explanation:doubts] gagal", error);
  process.exitCode = 1;
});
