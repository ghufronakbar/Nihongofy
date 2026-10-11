// Import transkrip audio CHOUKAI yang sudah diaudit dari fixture ke database.
//
// Script ini hanya menyentuh QuestionAudioTranscript. Struktur soal, media,
// kunci jawaban, attempt, practice, report, dan pembahasan tidak diubah.
// Pasangan soal ditemukan lewat nama paket -> mondaiType -> order, sehingga ID
// Question tetap stabil pada paket yang sudah pernah dikerjakan pengguna.
import { PrismaClient } from "@prisma/client";
import {
  assertSafeFileName,
  JLPT_LEVELS,
  loadAndValidateSeedFiles,
  normalizeAudioTranscript,
} from "./test-package-fixture.mjs";

const prisma = new PrismaClient();
const TRANSACTION_TIMEOUT_MS = 120_000;

function log(message) {
  console.log(`[seed:question-transcript] ${message}`);
}

function parseArguments(argv) {
  const options = { selectedFile: null, level: null, validateOnly: false };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--validate-only") {
      options.validateOnly = true;
      continue;
    }

    if (argument === "--file" || argument.startsWith("--file=")) {
      const value = argument.startsWith("--file=")
        ? argument.slice("--file=".length)
        : argv[++index];
      if (!value || value.startsWith("--")) {
        throw new Error("--file membutuhkan nama file *.json");
      }
      options.selectedFile = assertSafeFileName(value);
      continue;
    }

    if (argument === "--level" || argument.startsWith("--level=")) {
      const value = argument.startsWith("--level=")
        ? argument.slice("--level=".length)
        : argv[++index];
      if (!value || value.startsWith("--")) throw new Error("--level membutuhkan nilai N1-N5");

      const level = value.toUpperCase();
      if (!JLPT_LEVELS.includes(level)) {
        throw new Error(`--level harus salah satu dari ${JLPT_LEVELS.join(", ")}`);
      }
      options.level = level;
      continue;
    }

    throw new Error(`argumen tidak dikenal: ${argument}`);
  }

  return options;
}

function isSameTranscript(stored, incoming) {
  if (!stored) return false;

  return (
    stored.text === incoming.text &&
    stored.source === incoming.source &&
    (stored.aiModel ?? null) === incoming.aiModel &&
    (stored.promptVersion ?? null) === incoming.promptVersion &&
    stored.generatedAt.getTime() === incoming.generatedAt.getTime() &&
    stored.reviewedAt.getTime() === incoming.reviewedAt.getTime()
  );
}

async function importTranscripts({ pkg }) {
  return prisma.$transaction(
    async (transaction) => {
      const lockKey = `seed:question-transcript:${pkg.name}`;
      await transaction.$queryRaw`
        SELECT 1 AS locked
        FROM pg_advisory_xact_lock(hashtext(${lockKey}))
      `;

      const testPackages = await transaction.testPackage.findMany({
        where: { name: pkg.name },
        take: 2,
        select: {
          testPackageItems: {
            select: {
              mondaiType: true,
              questions: {
                select: {
                  id: true,
                  order: true,
                  audioTranscript: {
                    select: {
                      text: true,
                      source: true,
                      aiModel: true,
                      promptVersion: true,
                      generatedAt: true,
                      reviewedAt: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (testPackages.length === 0) {
        return { status: "blocked", message: `package "${pkg.name}" belum ada di database` };
      }
      if (testPackages.length > 1) {
        return { status: "blocked", message: `lebih dari satu package memakai nama "${pkg.name}"` };
      }

      const storedItems = new Map(
        testPackages[0].testPackageItems.map((item) => [
          item.mondaiType,
          new Map(item.questions.map((question) => [question.order, question])),
        ]),
      );
      const result = {
        status: "ok",
        created: 0,
        updated: 0,
        unchanged: 0,
        skipped: 0,
        missing: [],
      };

      for (const item of pkg.testPackageItems) {
        if (item.section !== "CHOUKAI") continue;

        const storedQuestions = storedItems.get(item.mondaiType);

        for (const question of item.questions) {
          const transcript = normalizeAudioTranscript(question);
          if (!transcript) {
            result.skipped += 1;
            continue;
          }

          const storedQuestion = storedQuestions?.get(question.order);
          if (!storedQuestion) {
            result.missing.push(`${item.mondaiType}#${question.order}`);
            continue;
          }

          if (isSameTranscript(storedQuestion.audioTranscript, transcript)) {
            result.unchanged += 1;
            continue;
          }

          await transaction.questionAudioTranscript.upsert({
            where: { questionId: storedQuestion.id },
            create: { questionId: storedQuestion.id, ...transcript },
            update: transcript,
          });

          if (storedQuestion.audioTranscript) result.updated += 1;
          else result.created += 1;
        }
      }

      return result;
    },
    { maxWait: 10_000, timeout: TRANSACTION_TIMEOUT_MS },
  );
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const { checkedFiles, seedFiles, emptyFiles, errors: validationErrors } =
    await loadAndValidateSeedFiles(options.selectedFile);

  for (const file of emptyFiles) log(`SKIP file "${file}" - kosong`);

  if (validationErrors.length > 0) {
    log(`VALIDATION FAILED - ${validationErrors.length} error; database tidak diubah`);
    for (const error of validationErrors) log(`ERROR ${error.file} - ${error.message}`);
    process.exitCode = 1;
    return;
  }

  const selected = options.level
    ? seedFiles.filter((seedFile) => seedFile.pkg.jlptLevel === options.level)
    : seedFiles;

  log(
    `VALIDATION OK - ${selected.length} package dari ${checkedFiles} file` +
      (options.level ? ` (filter level ${options.level})` : ""),
  );
  if (options.validateOnly) return;

  const summary = {
    packagesTouched: 0,
    transcriptsCreated: 0,
    transcriptsUpdated: 0,
    transcriptsUnchanged: 0,
    questionsWithoutTranscript: 0,
    errors: [],
  };

  for (const seedFile of selected) {
    const { file, pkg } = seedFile;
    try {
      const result = await importTranscripts(seedFile);

      if (result.status === "blocked") {
        log(`ERROR package "${pkg.name}" (${file}) - ${result.message}`);
        summary.errors.push({ context: file, message: result.message });
        continue;
      }

      if (result.missing.length > 0) {
        const message =
          `${result.missing.length} soal fixture tidak ada di database: ` +
          result.missing.slice(0, 5).join(", ");
        log(`ERROR package "${pkg.name}" (${file}) - ${message}`);
        summary.errors.push({ context: file, message });
      }

      summary.packagesTouched += 1;
      summary.transcriptsCreated += result.created;
      summary.transcriptsUpdated += result.updated;
      summary.transcriptsUnchanged += result.unchanged;
      summary.questionsWithoutTranscript += result.skipped;

      log(
        `SYNC package "${pkg.name}" (${file}) - ${result.created} baru, ` +
          `${result.updated} diperbarui, ${result.unchanged} tetap, ` +
          `${result.skipped} soal CHOUKAI belum punya transkrip`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log(`ERROR package "${pkg.name}" (${file}) - ROLLED BACK: ${message}`);
      summary.errors.push({ context: file, message });
    }
  }

  log(
    `DONE - ${summary.packagesTouched} package, ${summary.transcriptsCreated} transkrip baru, ` +
      `${summary.transcriptsUpdated} diperbarui, ${summary.transcriptsUnchanged} tetap, ` +
      `${summary.questionsWithoutTranscript} soal CHOUKAI belum punya transkrip, ` +
      `${summary.errors.length} error`,
  );
  console.info(`[seed:question-transcript] summary ${JSON.stringify(summary)}`);

  if (summary.errors.length > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error("[seed:question-transcript] gagal", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
