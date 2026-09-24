// Import pembahasan soal dari fixture ke database.
//
// Dipisah dari seed-test-package.mjs karena jalur kerjanya berbeda: script itu
// membuat paket baru dan melewati paket yang strukturnya sudah cocok, jadi
// perubahan isi (termasuk pembahasan yang baru ditulis generator) tidak pernah
// ikut tersimpan. Satu-satunya cara memperbaruinya di sana adalah
// --replace-existing, yang menghapus lalu membuat ulang seluruh paket sehingga
// Question.id berubah dan comment/attempt/practice milik user ikut hilang.
//
// Script ini hanya menyentuh QuestionExplanation dan QuestionExplanationChoice,
// dicocokkan lewat (nama paket -> mondaiType -> order soal). Struktur soal tidak
// pernah diubah, jadi aman dijalankan pada paket yang sudah dikerjakan user.
import { PrismaClient } from "@prisma/client";
import {
  assertSafeFileName,
  JLPT_LEVELS,
  loadAndValidateSeedFiles,
  normalizeExplanation,
} from "./test-package-fixture.mjs";

const prisma = new PrismaClient();

const TRANSACTION_TIMEOUT_MS = 120_000;

function log(message) {
  console.log(`[seed:question-explanation] ${message}`);
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
      const value = argument.startsWith("--file=") ? argument.slice("--file=".length) : argv[++index];
      if (!value || value.startsWith("--")) throw new Error("--file membutuhkan nama file *.json");
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

// Perbandingan isi supaya rerun tidak menulis ulang baris yang sudah sama.
// Tanpa ini setiap rerun akan menyentuh ribuan baris dan mengubah updatedAt
// tanpa alasan.
function isSameExplanation(stored, incoming) {
  if (!stored) return false;

  const sameScalar =
    stored.summary === incoming.summary &&
    (stored.detail ?? null) === incoming.detail &&
    (stored.translation ?? null) === incoming.translation &&
    stored.answerKeyDoubt === incoming.answerKeyDoubt &&
    (stored.answerKeyDoubtNote ?? null) === incoming.answerKeyDoubtNote &&
    stored.source === incoming.source &&
    (stored.aiModel ?? null) === incoming.aiModel &&
    (stored.promptVersion ?? null) === incoming.promptVersion &&
    (stored.reviewedAt?.getTime() ?? null) === (incoming.reviewedAt?.getTime() ?? null);

  if (!sameScalar) return false;

  const storedKeyPoints = stored.keyPoints ?? [];
  if (storedKeyPoints.length !== incoming.keyPoints.length) return false;
  if (storedKeyPoints.some((point, index) => point !== incoming.keyPoints[index])) return false;

  const incomingChoices = incoming.choices ?? [];
  if (stored.choices.length !== incomingChoices.length) return false;

  const storedByCode = new Map(stored.choices.map((choice) => [choice.codeAnswer, choice]));
  return incomingChoices.every((choice) => {
    const storedChoice = storedByCode.get(choice.codeAnswer);
    return (
      storedChoice &&
      storedChoice.reason === choice.reason &&
      storedChoice.isCorrect === choice.isCorrect
    );
  });
}

async function importExplanations({ pkg }) {
  return prisma.$transaction(
    async (transaction) => {
      const lockKey = `seed:question-explanation:${pkg.name}`;
      await transaction.$queryRaw`
        SELECT 1 AS locked
        FROM pg_advisory_xact_lock(hashtext(${lockKey}))
      `;

      const testPackages = await transaction.testPackage.findMany({
        where: { name: pkg.name },
        take: 2,
        select: {
          id: true,
          testPackageItems: {
            select: {
              mondaiType: true,
              questions: {
                select: {
                  id: true,
                  order: true,
                  explanation: {
                    select: {
                      id: true,
                      summary: true,
                      detail: true,
                      translation: true,
                      keyPoints: true,
                      answerKeyDoubt: true,
                      answerKeyDoubtNote: true,
                      source: true,
                      aiModel: true,
                      promptVersion: true,
                      reviewedAt: true,
                      choices: {
                        select: { codeAnswer: true, isCorrect: true, reason: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (testPackages.length === 0) {
        return {
          status: "blocked",
          message: `package "${pkg.name}" belum ada di database; jalankan npm run seed:test-package dulu`,
        };
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

      const result = { status: "ok", created: 0, updated: 0, unchanged: 0, skipped: 0, missing: [] };

      for (const item of pkg.testPackageItems) {
        const storedQuestions = storedItems.get(item.mondaiType);

        for (const question of item.questions) {
          const explanation = normalizeExplanation(question);
          if (!explanation) {
            result.skipped += 1;
            continue;
          }

          const storedQuestion = storedQuestions?.get(question.order);
          if (!storedQuestion) {
            result.missing.push(`${item.mondaiType}#${question.order}`);
            continue;
          }

          if (isSameExplanation(storedQuestion.explanation, explanation)) {
            result.unchanged += 1;
            continue;
          }

          const { choices, generatedAt, ...columns } = explanation;
          const data = { ...columns, ...(generatedAt ? { generatedAt } : {}) };

          const saved = await transaction.questionExplanation.upsert({
            where: { questionId: storedQuestion.id },
            create: { questionId: storedQuestion.id, ...data },
            update: data,
            select: { id: true },
          });

          // Alasan per pilihan ditulis ulang utuh: jumlah dan isinya ditentukan
          // fixture, dan menambal per baris hanya menyisakan baris usang bila
          // sebuah pilihan hilang dari fixture.
          await transaction.questionExplanationChoice.deleteMany({
            where: { explanationId: saved.id },
          });
          if (choices && choices.length > 0) {
            await transaction.questionExplanationChoice.createMany({
              data: choices.map((choice) => ({ explanationId: saved.id, ...choice })),
            });
          }

          if (storedQuestion.explanation) result.updated += 1;
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
    log(
      `VALIDATION FAILED - ${validationErrors.length} error dari ${checkedFiles} file; database tidak diubah`,
    );
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
    explanationsCreated: 0,
    explanationsUpdated: 0,
    explanationsUnchanged: 0,
    questionsWithoutExplanation: 0,
    errors: [],
  };

  for (const seedFile of selected) {
    const { file, pkg } = seedFile;
    try {
      const result = await importExplanations(seedFile);

      if (result.status === "blocked") {
        log(`ERROR package "${pkg.name}" (${file}) - ${result.message}`);
        summary.errors.push({ context: file, message: result.message });
        continue;
      }

      if (result.missing.length > 0) {
        const message =
          `${result.missing.length} soal fixture tidak ada di database: ` +
          `${result.missing.slice(0, 5).join(", ")}`;
        log(`ERROR package "${pkg.name}" (${file}) - ${message}`);
        summary.errors.push({ context: file, message });
      }

      summary.packagesTouched += 1;
      summary.explanationsCreated += result.created;
      summary.explanationsUpdated += result.updated;
      summary.explanationsUnchanged += result.unchanged;
      summary.questionsWithoutExplanation += result.skipped;

      log(
        `SYNC package "${pkg.name}" (${file}) - ${result.created} baru, ${result.updated} diperbarui, ` +
          `${result.unchanged} tetap, ${result.skipped} soal belum punya pembahasan`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log(`ERROR package "${pkg.name}" (${file}) - ROLLED BACK: ${message}`);
      summary.errors.push({ context: file, message });
    }
  }

  log(
    `DONE - ${summary.packagesTouched} package, ${summary.explanationsCreated} pembahasan baru, ` +
      `${summary.explanationsUpdated} diperbarui, ${summary.explanationsUnchanged} tetap, ` +
      `${summary.questionsWithoutExplanation} soal belum punya pembahasan, ${summary.errors.length} error`,
  );
  console.info(`[seed:question-explanation] summary ${JSON.stringify(summary)}`);

  if (summary.errors.length > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error("[seed:question-explanation] gagal", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
