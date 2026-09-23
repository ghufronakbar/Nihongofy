import { PrismaClient } from "@prisma/client";
import {
  assertSafeFileName,
  loadAndValidateSeedFiles,
  normalizeExplanation,
} from "./test-package-fixture.mjs";

const prisma = new PrismaClient();

const TRANSACTION_TIMEOUT_MS = 120_000;


function log(message) {
  console.log(`[seed:test-package] ${message}`);
}

function parseArguments(argv) {
  const options = {
    selectedFile: null,
    validateOnly: false,
    replaceExisting: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--validate-only") {
      options.validateOnly = true;
      continue;
    }

    if (argument === "--replace-existing") {
      options.replaceExisting = true;
      continue;
    }

    if (argument === "--file") {
      const fileName = argv[index + 1];
      if (!fileName || fileName.startsWith("--")) {
        throw new Error("--file membutuhkan nama file *.json");
      }
      options.selectedFile = fileName;
      index += 1;
      continue;
    }

    if (argument.startsWith("--file=")) {
      options.selectedFile = argument.slice("--file=".length);
      if (!options.selectedFile) {
        throw new Error("--file membutuhkan nama file *.json");
      }
      continue;
    }

    throw new Error(`argumen tidak dikenal: ${argument}`);
  }

  if (options.selectedFile) {
    assertSafeFileName(options.selectedFile);
  }

  if (options.replaceExisting && !options.selectedFile) {
    throw new Error("--replace-existing wajib dipakai bersama --file");
  }

  if (options.replaceExisting && options.validateOnly) {
    throw new Error("--replace-existing tidak dapat dipakai bersama --validate-only");
  }

  return options;
}



function expectedPackageShape(pkg) {
  return {
    jlptLevel: pkg.jlptLevel,
    contexts: pkg.questionContexts.length,
    items: new Map(
      pkg.testPackageItems.map((item) => [
        item.mondaiType,
        {
          section: item.section,
          session: item.session,
          order: item.order,
          questions: item.questions.length,
        },
      ]),
    ),
  };
}

function existingPackageMismatches(existing, pkg) {
  const expected = expectedPackageShape(pkg);
  const mismatches = [];

  if (existing.jlptLevel !== expected.jlptLevel) {
    mismatches.push(`jlptLevel DB=${existing.jlptLevel}, fixture=${expected.jlptLevel}`);
  }

  if (existing._count.questionContexts !== expected.contexts) {
    mismatches.push(
      `contexts DB=${existing._count.questionContexts}, fixture=${expected.contexts}`,
    );
  }

  if (existing.testPackageItems.length !== expected.items.size) {
    mismatches.push(
      `items DB=${existing.testPackageItems.length}, fixture=${expected.items.size}`,
    );
  }

  const storedItems = new Map(
    existing.testPackageItems.map((item) => [item.mondaiType, item]),
  );

  for (const [mondaiType, expectedItem] of expected.items) {
    const storedItem = storedItems.get(mondaiType);
    if (!storedItem) {
      mismatches.push(`item ${mondaiType} belum ada`);
      continue;
    }

    for (const field of ["section", "session", "order"]) {
      if (storedItem[field] !== expectedItem[field]) {
        mismatches.push(
          `${mondaiType}.${field} DB=${storedItem[field]}, fixture=${expectedItem[field]}`,
        );
      }
    }

    if (storedItem._count.questions !== expectedItem.questions) {
      mismatches.push(
        `${mondaiType}.questions DB=${storedItem._count.questions}, fixture=${expectedItem.questions}`,
      );
    }
  }

  return mismatches;
}

// Bentuk nested-create untuk relasi 1:1 QuestionExplanation. Mengembalikan
// undefined bila soal memang belum punya pembahasan, supaya tidak ada baris
// kosong yang dibuat.
function explanationCreateInput(question) {
  const explanation = normalizeExplanation(question);
  if (!explanation) return undefined;

  const { choices, generatedAt, ...columns } = explanation;
  return {
    create: {
      ...columns,
      ...(generatedAt ? { generatedAt } : {}),
      ...(choices ? { choices: { create: choices } } : {}),
    },
  };
}

async function importPackage({ file, pkg }, replaceExisting) {
  return prisma.$transaction(
    async (transaction) => {
      const lockKey = `seed:test-package:${pkg.name}`;
      await transaction.$queryRaw`
        SELECT 1 AS locked
        FROM pg_advisory_xact_lock(hashtext(${lockKey}))
      `;

      const existingPackages = await transaction.testPackage.findMany({
        where: { name: pkg.name },
        take: 2,
        select: {
          id: true,
          jlptLevel: true,
          _count: { select: { questionContexts: true, attempts: true } },
          testPackageItems: {
            select: {
              mondaiType: true,
              section: true,
              session: true,
              order: true,
              _count: { select: { questions: true } },
            },
          },
        },
      });

      if (existingPackages.length > 1) {
        return {
          status: "blocked",
          message: `lebih dari satu package memakai nama "${pkg.name}"`,
        };
      }

      const existing = existingPackages[0];
      let replacedId = null;

      if (existing && !replaceExisting) {
        const mismatches = existingPackageMismatches(existing, pkg);
        if (mismatches.length === 0) {
          return { status: "skipped", id: existing.id };
        }

        return {
          status: "blocked",
          message:
            `package existing id=${existing.id} tidak lengkap/sesuai fixture: ` +
            `${mismatches.slice(0, 5).join("; ")}. ` +
            `Periksa lalu jalankan ulang dengan --file ${file} --replace-existing bila aman.`,
        };
      }

      if (existing && replaceExisting) {
        if (existing._count.attempts > 0) {
          return {
            status: "blocked",
            message:
              `package existing id=${existing.id} memiliki ${existing._count.attempts} attempt; ` +
              "replacement ditolak agar data user tidak terhapus",
          };
        }

        replacedId = existing.id;
        await transaction.testPackage.delete({ where: { id: existing.id } });
      }

      const testPackage = await transaction.testPackage.create({
        data: { name: pkg.name, jlptLevel: pkg.jlptLevel },
        select: { id: true },
      });

      const events = [];
      const contextIdMap = new Map();

      for (const questionContext of pkg.questionContexts) {
        const created = await transaction.questionContext.create({
          data: {
            testPackageId: testPackage.id,
            storyText: questionContext.storyText ?? null,
            storyImage: questionContext.storyImage ?? null,
            storyAudio: questionContext.storyAudio ?? null,
          },
          select: { id: true },
        });
        contextIdMap.set(questionContext.id, created.id);
        events.push(`CREATE context "${questionContext.id}" -> id ${created.id}`);
      }

      for (const item of pkg.testPackageItems) {
        const questions = item.questions.map((question) => ({
          order: question.order,
          questionText: question.questionText,
          questionImage: question.questionImage ?? null,
          questionAudio: question.questionAudio ?? null,
          questionAnswer: question.questionAnswer,
          explanation: explanationCreateInput(question),
          questionContextId: question.questionContextRef
            ? contextIdMap.get(question.questionContextRef)
            : null,
          questionChoices: {
            create: question.questionChoices.map((choice) => ({
              codeAnswer: choice.codeAnswer,
              answerText: choice.answerText,
              answerImage: choice.answerImage ?? null,
            })),
          },
        }));

        await transaction.testPackageItem.create({
          data: {
            testPackageId: testPackage.id,
            mondaiType: item.mondaiType,
            section: item.section,
            session: item.session,
            order: item.order,
            instruction: item.instruction ?? null,
            questions: { create: questions },
          },
        });

        events.push(
          `CREATE item ${item.mondaiType} (sesi ${item.session}, order ${item.order}, ${questions.length} soal)`,
        );
      }

      return {
        status: replacedId ? "replaced" : "seeded",
        id: testPackage.id,
        replacedId,
        questionsSeeded: pkg.testPackageItems.reduce(
          (total, item) => total + item.questions.length,
          0,
        ),
        events,
      };
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
    for (const error of validationErrors) {
      log(`ERROR ${error.file} - ${error.message}`);
    }
    process.exitCode = 1;
    return;
  }

  log(`VALIDATION OK - ${seedFiles.length} package dari ${checkedFiles} file`);
  if (options.validateOnly) return;

  const summary = {
    packagesSeeded: [],
    packagesReplaced: [],
    packagesSkipped: [],
    packagesBlocked: [],
    questionsSeeded: 0,
    errors: [],
  };

  for (const seedFile of seedFiles) {
    const { file, pkg } = seedFile;
    try {
      const result = await importPackage(seedFile, options.replaceExisting);

      if (result.status === "skipped") {
        log(`SKIP package "${pkg.name}" (${file}) - sudah lengkap (id=${result.id})`);
        summary.packagesSkipped.push(pkg.name);
        continue;
      }

      if (result.status === "blocked") {
        log(`ERROR package "${pkg.name}" (${file}) - ${result.message}`);
        summary.packagesBlocked.push(pkg.name);
        summary.errors.push({ context: file, message: result.message });
        continue;
      }

      const action = result.status === "replaced" ? "REPLACE" : "CREATE";
      log(
        `${action} package "${pkg.name}" (${file}, ${pkg.jlptLevel}, id=${result.id}) - COMMITTED`,
      );
      for (const event of result.events) log(`  ${event}`);

      if (result.status === "replaced") {
        summary.packagesReplaced.push(pkg.name);
      } else {
        summary.packagesSeeded.push(pkg.name);
      }
      summary.questionsSeeded += result.questionsSeeded;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log(`ERROR package "${pkg.name}" (${file}) - ROLLED BACK: ${message}`);
      summary.errors.push({ context: file, message });
    }
  }

  log(
    `DONE - seeded ${summary.packagesSeeded.length}, replaced ${summary.packagesReplaced.length}, ` +
      `skipped ${summary.packagesSkipped.length}, blocked ${summary.packagesBlocked.length}, ` +
      `${summary.questionsSeeded} soal, ${summary.errors.length} error`,
  );
  console.info(`[seed:test-package] summary ${JSON.stringify(summary)}`);

  if (summary.errors.length > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error("[seed:test-package] gagal", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
