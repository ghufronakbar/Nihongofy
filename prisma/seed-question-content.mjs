// Sinkronisasi isi soal dari fixture ke database, di tempat.
//
// Dibutuhkan karena `seed:test-package` bersifat create-only: paket yang
// strukturnya sudah cocok akan di-SKIP, sehingga perbaikan teks soal, pilihan,
// atau kunci jawaban tidak pernah mendarat. Satu-satunya jalur lain di sana
// adalah --replace-existing, yang menghapus lalu membuat ulang paket sehingga
// Question.id berubah dan comment/attempt/practice milik user ikut hilang —
// dan tetap ditolak bila paket sudah punya attempt.
//
// Script ini hanya melakukan UPDATE pada baris yang sudah ada. Struktur paket
// tidak pernah disentuh: jumlah item, soal, dan pilihan harus sudah cocok, dan
// bila tidak cocok paket itu dilaporkan sebagai error, bukan diperbaiki diam-diam.
//
// Bila kunci jawaban berubah, `AttemptAnswer.isCorrect` milik attempt lama ikut
// dihitung ulang — kalau tidak, riwayat dan analitik akan memakai penilaian
// berdasarkan kunci yang sudah tidak berlaku.
import { PrismaClient } from "@prisma/client";
import {
  assertSafeFileName,
  JLPT_LEVELS,
  loadAndValidateSeedFiles,
} from "./test-package-fixture.mjs";

const prisma = new PrismaClient();
const TRANSACTION_TIMEOUT_MS = 120_000;

function log(message) {
  console.log(`[seed:question-content] ${message}`);
}

function parseArguments(argv) {
  const options = { selectedFile: null, level: null, validateOnly: false, mediaOnly: false };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const consumesNext = !argument.includes("=");
    const readValue = (prefix) =>
      argument.startsWith(`${prefix}=`) ? argument.slice(prefix.length + 1) : argv[index + 1];

    if (argument === "--validate-only") {
      options.validateOnly = true;
      continue;
    }

    if (argument === "--media-only") {
      options.mediaOnly = true;
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

function changedFields(stored, incoming) {
  const changes = {};
  for (const [field, value] of Object.entries(incoming)) {
    if ((stored[field] ?? null) !== value) changes[field] = value;
  }
  return changes;
}

async function countLegacyMediaUrls(packageNames) {
  const legacyUrl = "https://res.cloudinary.com/";
  const packageFilter = { name: { in: packageNames } };
  const [contexts, questions, choices] = await Promise.all([
    prisma.questionContext.count({
      where: {
        testPackage: packageFilter,
        OR: [
          { storyImage: { contains: legacyUrl } },
          { storyAudio: { contains: legacyUrl } },
        ],
      },
    }),
    prisma.question.count({
      where: {
        testPackageItem: { testPackage: packageFilter },
        OR: [
          { questionImage: { contains: legacyUrl } },
          { questionAudio: { contains: legacyUrl } },
        ],
      },
    }),
    prisma.questionChoice.count({
      where: {
        question: { testPackageItem: { testPackage: packageFilter } },
        answerImage: { contains: legacyUrl },
      },
    }),
  ]);

  return { contexts, questions, choices, total: contexts + questions + choices };
}

async function syncPackage({ pkg, mediaOnly = false }) {
  return prisma.$transaction(
    async (transaction) => {
      const lockKey = `seed:question-content:${pkg.name}`;
      await transaction.$queryRaw`
        SELECT 1 AS locked
        FROM pg_advisory_xact_lock(hashtext(${lockKey}))
      `;

      const testPackages = await transaction.testPackage.findMany({
        where: { name: pkg.name },
        take: 2,
        select: {
          id: true,
          questionContexts: {
            select: { id: true, storyText: true, storyImage: true, storyAudio: true },
          },
          testPackageItems: {
            select: {
              id: true,
              mondaiType: true,
              instruction: true,
              questions: {
                select: {
                  id: true,
                  order: true,
                  questionContextId: true,
                  questionText: true,
                  questionImage: true,
                  questionAudio: true,
                  questionAnswer: true,
                  questionChoices: {
                    select: { id: true, codeAnswer: true, answerText: true, answerImage: true },
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
        testPackages[0].testPackageItems.map((item) => [item.mondaiType, item]),
      );
      const result = {
        status: "ok",
        questions: 0,
        choices: 0,
        items: 0,
        contexts: 0,
        contextLinks: 0,
        answerKeys: [],
        rescored: 0,
      };

      // QuestionContext tidak menyimpan id lokal fixture, jadi pasangannya
      // ditemukan lewat soal yang merujuknya: bila seluruh soal dengan
      // questionContextRef yang sama menunjuk satu baris context di database,
      // pasangan itu tidak ambigu.
      const contextCandidates = new Map();

      for (const item of pkg.testPackageItems) {
        const storedItem = storedItems.get(item.mondaiType);
        if (!storedItem) {
          return {
            status: "blocked",
            message: `mondai ${item.mondaiType} belum ada di database; jalankan seed:test-package dulu`,
          };
        }

        if (!mediaOnly && (storedItem.instruction ?? null) !== (item.instruction ?? null)) {
          await transaction.testPackageItem.update({
            where: { id: storedItem.id },
            data: { instruction: item.instruction ?? null },
          });
          result.items += 1;
        }

        const storedQuestions = new Map(storedItem.questions.map((q) => [q.order, q]));

        for (const question of item.questions) {
          const stored = storedQuestions.get(question.order);
          if (!stored) {
            return {
              status: "blocked",
              message: `soal ${item.mondaiType}#${question.order} belum ada di database`,
            };
          }

          const changes = changedFields(
            stored,
            mediaOnly
              ? {
                  questionImage: question.questionImage ?? null,
                  questionAudio: question.questionAudio ?? null,
                }
              : {
                  questionText: question.questionText,
                  questionImage: question.questionImage ?? null,
                  questionAudio: question.questionAudio ?? null,
                  questionAnswer: question.questionAnswer,
                },
          );

          if (Object.keys(changes).length > 0) {
            await transaction.question.update({ where: { id: stored.id }, data: changes });
            result.questions += 1;

            if (changes.questionAnswer !== undefined) {
              result.answerKeys.push(
                `${item.mondaiType}#${question.order}: ${stored.questionAnswer} -> ${changes.questionAnswer}`,
              );

              // Penilaian tersimpan ikut dihitung ulang terhadap kunci baru.
              const rescored = await transaction.$executeRaw`
                UPDATE "AttemptAnswer"
                SET "isCorrect" = ("selectedAnswer" = ${changes.questionAnswer}),
                    "updatedAt" = NOW()
                WHERE "questionId" = ${stored.id}
                  AND "isCorrect" IS DISTINCT FROM ("selectedAnswer" = ${changes.questionAnswer})
              `;
              const rescoredPractice = await transaction.$executeRaw`
                UPDATE "PracticeAnswer"
                SET "isCorrect" = ("selectedAnswer" = ${changes.questionAnswer}),
                    "updatedAt" = NOW()
                WHERE "questionId" = ${stored.id}
                  AND "answeredAt" IS NOT NULL
                  AND "isCorrect" IS DISTINCT FROM ("selectedAnswer" = ${changes.questionAnswer})
              `;
              result.rescored += rescored + rescoredPractice;
            }
          }

          if (question.questionContextRef && stored.questionContextId) {
            const found = contextCandidates.get(question.questionContextRef) ?? new Set();
            found.add(stored.questionContextId);
            contextCandidates.set(question.questionContextRef, found);
          }

          const storedChoices = new Map(stored.questionChoices.map((c) => [c.codeAnswer, c]));
          for (const choice of question.questionChoices) {
            const storedChoice = storedChoices.get(choice.codeAnswer);
            if (!storedChoice) {
              return {
                status: "blocked",
                message: `pilihan ${choice.codeAnswer} pada ${item.mondaiType}#${question.order} belum ada di database`,
              };
            }

            const choiceChanges = changedFields(
              storedChoice,
              mediaOnly
                ? { answerImage: choice.answerImage ?? null }
                : {
                    answerText: choice.answerText,
                    answerImage: choice.answerImage ?? null,
                  },
            );
            if (Object.keys(choiceChanges).length > 0) {
              await transaction.questionChoice.update({
                where: { id: storedChoice.id },
                data: choiceChanges,
              });
              result.choices += 1;
            }
          }
        }
      }

      // Tautan soal ke bacaan ikut disinkronkan: soal yang di fixture sudah
      // dihubungkan tetapi di database masih lepas akan dirender tanpa bacaannya.
      // Pasangan ref -> id diambil dari soal lain yang sudah menunjuk context itu.
      const contextIdByRef = new Map();
      for (const [ref, candidates] of contextCandidates) {
        if (candidates.size === 1) contextIdByRef.set(ref, [...candidates][0]);
      }

      if (!mediaOnly) {
        for (const item of pkg.testPackageItems) {
          const storedItem = storedItems.get(item.mondaiType);
          const storedQuestions = new Map(storedItem.questions.map((q) => [q.order, q]));

          for (const question of item.questions) {
            const stored = storedQuestions.get(question.order);
            const desired = question.questionContextRef
              ? (contextIdByRef.get(question.questionContextRef) ?? null)
              : null;

            // Ref yang tidak dapat dipetakan dilewati, bukan ditulis sebagai null:
            // menghapus tautan yang benar lebih merugikan daripada membiarkannya.
            if (question.questionContextRef && desired === null) continue;
            if ((stored.questionContextId ?? null) === desired) continue;

            await transaction.question.update({
              where: { id: stored.id },
              data: { questionContextId: desired },
            });
            result.contextLinks += 1;
          }
        }
      }

      const storedContexts = new Map(
        testPackages[0].questionContexts.map((context) => [context.id, context]),
      );

      for (const context of pkg.questionContexts ?? []) {
        const candidates = contextCandidates.get(context.id);
        if (!candidates || candidates.size !== 1) continue;

        const storedContext = storedContexts.get([...candidates][0]);
        if (!storedContext) continue;

        const changes = changedFields(
          storedContext,
          mediaOnly
            ? {
                storyImage: context.storyImage ?? null,
                storyAudio: context.storyAudio ?? null,
              }
            : {
                storyText: context.storyText ?? null,
                storyImage: context.storyImage ?? null,
                storyAudio: context.storyAudio ?? null,
              },
        );
        if (Object.keys(changes).length === 0) continue;

        await transaction.questionContext.update({ where: { id: storedContext.id }, data: changes });
        result.contexts += 1;
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
      (options.mediaOnly ? " (media-only)" : ""),
  );
  if (options.validateOnly) return;

  const summary = {
    questions: 0,
    choices: 0,
    items: 0,
    contexts: 0,
    contextLinks: 0,
    rescored: 0,
    answerKeys: [],
    errors: [],
  };

  for (const seedFile of selected) {
    const { file, pkg } = seedFile;
    try {
      const result = await syncPackage({ ...seedFile, mediaOnly: options.mediaOnly });

      if (result.status === "blocked") {
        log(`ERROR package "${pkg.name}" (${file}) - ${result.message}`);
        summary.errors.push({ context: file, message: result.message });
        continue;
      }

      const touched =
        result.questions + result.choices + result.items + result.contexts + result.contextLinks;
      if (touched === 0) continue;

      summary.questions += result.questions;
      summary.choices += result.choices;
      summary.items += result.items;
      summary.contexts += result.contexts;
      summary.contextLinks += result.contextLinks;
      summary.rescored += result.rescored;
      summary.answerKeys.push(...result.answerKeys.map((entry) => `${file} ${entry}`));

      log(
        `SYNC package "${pkg.name}" (${file}) - ${result.questions} soal, ${result.choices} pilihan, ` +
          `${result.items} instruksi, ${result.contexts} bacaan, ${result.contextLinks} tautan bacaan diperbarui`,
      );
      for (const entry of result.answerKeys) log(`  kunci berubah ${entry}`);
      if (result.rescored > 0) log(`  ${result.rescored} jawaban tersimpan dinilai ulang`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log(`ERROR package "${pkg.name}" (${file}) - ROLLED BACK: ${message}`);
      summary.errors.push({ context: file, message });
    }
  }

  if (options.mediaOnly && selected.length > 0) {
    const legacy = await countLegacyMediaUrls(selected.map(({ pkg }) => pkg.name));
    log(
      `VERIFY Cloudinary tersisa - ${legacy.contexts} context, ${legacy.questions} soal, ` +
        `${legacy.choices} pilihan`,
    );
    if (legacy.total > 0) {
      summary.errors.push({
        context: "database",
        message: `${legacy.total} baris media masih memakai Cloudinary`,
      });
    }
  }

  log(
    `DONE - ${summary.questions} soal, ${summary.choices} pilihan, ${summary.items} instruksi, ` +
      `${summary.contexts} bacaan, ${summary.contextLinks} tautan bacaan, ` +
      `${summary.answerKeys.length} kunci berubah, ${summary.rescored} jawaban dinilai ulang, ` +
      `${summary.errors.length} error`,
  );

  if (summary.errors.length > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error("[seed:question-content] gagal", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
