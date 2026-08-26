import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const prisma = new PrismaClient();

const SEED_DATA_DIR = fileURLToPath(new URL("../src/test-package-data/", import.meta.url));
const TRANSACTION_TIMEOUT_MS = 120_000;

const JLPT_LEVELS = ["N1", "N2", "N3", "N4", "N5"];
const JLPT_SECTIONS = ["MOJI_GOI", "BUNPOU", "DOKKAI", "CHOUKAI"];
const SECTION_BY_MONDAI = {
  MOJI_GOI_READ_KANJI: "MOJI_GOI",
  MOJI_GOI_WRITE_KANJI: "MOJI_GOI",
  MOJI_GOI_WORD_FORMATION: "MOJI_GOI",
  MOJI_GOI_CONTEXT: "MOJI_GOI",
  MOJI_GOI_SYNONYM: "MOJI_GOI",
  MOJI_GOI_WORD_USAGE: "MOJI_GOI",
  BUNPOU_GRAMMAR: "BUNPOU",
  BUNPOU_SENTENCE_COMPOSITION: "BUNPOU",
  BUNPOU_TEXT_GRAMMAR: "BUNPOU",
  DOKKAI_SHORT_TEXT: "DOKKAI",
  DOKKAI_MEDIUM_TEXT: "DOKKAI",
  DOKKAI_LONG_TEXT: "DOKKAI",
  DOKKAI_INTEGRATED: "DOKKAI",
  DOKKAI_MAIN_IDEA: "DOKKAI",
  DOKKAI_INFORMATION_RETRIEVAL: "DOKKAI",
  CHOUKAI_TASK_BASED: "CHOUKAI",
  CHOUKAI_MAIN_POINT: "CHOUKAI",
  CHOUKAI_OUTLINE: "CHOUKAI",
  CHOUKAI_EXPRESSION: "CHOUKAI",
  CHOUKAI_QUICK_RESPONSE: "CHOUKAI",
  CHOUKAI_INTEGRATED: "CHOUKAI",
};
const MONDAI_TYPES = Object.keys(SECTION_BY_MONDAI);

const optionalNullableString = z.string().nullable().optional();

const questionChoiceSchema = z
  .object({
    codeAnswer: z.number().int().min(1).max(4),
    answerText: z.string(),
    answerImage: optionalNullableString,
  })
  .strict();

const questionSchema = z
  .object({
    order: z.number().int().positive(),
    questionText: z.string(),
    questionImage: optionalNullableString,
    questionAudio: optionalNullableString,
    questionAnswer: z.number().int().min(1).max(4),
    explanation: optionalNullableString,
    questionContextRef: optionalNullableString,
    questionChoices: z.array(questionChoiceSchema).length(4),
  })
  .strict();

const testPackageItemSchema = z
  .object({
    mondaiType: z.enum(MONDAI_TYPES),
    section: z.enum(JLPT_SECTIONS),
    session: z.number().int().positive(),
    order: z.number().int().positive(),
    instruction: optionalNullableString,
    questions: z.array(questionSchema).min(1),
  })
  .strict();

const questionContextSchema = z
  .object({
    id: z.string().min(1),
    storyText: optionalNullableString,
    storyImage: optionalNullableString,
    storyAudio: optionalNullableString,
    // Provenance metadata used by some extraction fixtures; not stored in DB.
    refs: z.array(z.string()).optional(),
  })
  .strict();

function expectedSession(jlptLevel, section) {
  if (jlptLevel === "N1" || jlptLevel === "N2") {
    return section === "CHOUKAI" ? 2 : 1;
  }

  if (section === "MOJI_GOI") return 1;
  if (section === "CHOUKAI") return 3;
  return 2;
}

function addValidationIssue(context, pathParts, message) {
  context.addIssue({ code: "custom", path: pathParts, message });
}

const seedTestPackageSchema = z
  .object({
    name: z.string().min(1),
    jlptLevel: z.enum(JLPT_LEVELS),
    questionContexts: z.array(questionContextSchema).default([]),
    testPackageItems: z.array(testPackageItemSchema).min(1),
  })
  .strict()
  .superRefine((pkg, context) => {
    const contextIndexes = new Map();
    const usedContextIds = new Set();

    pkg.questionContexts.forEach((questionContext, index) => {
      const previousIndex = contextIndexes.get(questionContext.id);
      if (previousIndex !== undefined) {
        addValidationIssue(
          context,
          ["questionContexts", index, "id"],
          `id duplikat dengan questionContexts[${previousIndex}]: ${questionContext.id}`,
        );
      } else {
        contextIndexes.set(questionContext.id, index);
      }

      const hasContent = [
        questionContext.storyText,
        questionContext.storyImage,
        questionContext.storyAudio,
      ].some((value) => typeof value === "string" && value.length > 0);

      if (!hasContent) {
        addValidationIssue(
          context,
          ["questionContexts", index],
          `context "${questionContext.id}" tidak memiliki text, image, atau audio`,
        );
      }
    });

    const mondaiIndexes = new Map();
    const itemOrderIndexes = new Map();

    pkg.testPackageItems.forEach((item, itemIndex) => {
      const previousMondaiIndex = mondaiIndexes.get(item.mondaiType);
      if (previousMondaiIndex !== undefined) {
        addValidationIssue(
          context,
          ["testPackageItems", itemIndex, "mondaiType"],
          `mondaiType duplikat dengan testPackageItems[${previousMondaiIndex}]`,
        );
      } else {
        mondaiIndexes.set(item.mondaiType, itemIndex);
      }

      const itemOrderKey = `${item.session}:${item.order}`;
      const previousOrderIndex = itemOrderIndexes.get(itemOrderKey);
      if (previousOrderIndex !== undefined) {
        addValidationIssue(
          context,
          ["testPackageItems", itemIndex, "order"],
          `order ${item.order} duplikat dalam session ${item.session} dengan testPackageItems[${previousOrderIndex}]`,
        );
      } else {
        itemOrderIndexes.set(itemOrderKey, itemIndex);
      }

      const requiredSection = SECTION_BY_MONDAI[item.mondaiType];
      if (item.section !== requiredSection) {
        addValidationIssue(
          context,
          ["testPackageItems", itemIndex, "section"],
          `${item.mondaiType} harus memakai section ${requiredSection}`,
        );
      }

      const requiredSession = expectedSession(pkg.jlptLevel, item.section);
      if (item.session !== requiredSession) {
        addValidationIssue(
          context,
          ["testPackageItems", itemIndex, "session"],
          `${pkg.jlptLevel}/${item.section} harus memakai session ${requiredSession}`,
        );
      }

      const questionOrderIndexes = new Map();
      item.questions.forEach((question, questionIndex) => {
        const previousQuestionIndex = questionOrderIndexes.get(question.order);
        if (previousQuestionIndex !== undefined) {
          addValidationIssue(
            context,
            ["testPackageItems", itemIndex, "questions", questionIndex, "order"],
            `order soal duplikat dengan questions[${previousQuestionIndex}]: ${question.order}`,
          );
        } else {
          questionOrderIndexes.set(question.order, questionIndex);
        }

        const choiceCodes = new Set();
        question.questionChoices.forEach((choice, choiceIndex) => {
          if (choiceCodes.has(choice.codeAnswer)) {
            addValidationIssue(
              context,
              [
                "testPackageItems",
                itemIndex,
                "questions",
                questionIndex,
                "questionChoices",
                choiceIndex,
                "codeAnswer",
              ],
              `codeAnswer duplikat: ${choice.codeAnswer}`,
            );
          }
          choiceCodes.add(choice.codeAnswer);
        });

        if (!choiceCodes.has(question.questionAnswer)) {
          addValidationIssue(
            context,
            ["testPackageItems", itemIndex, "questions", questionIndex, "questionAnswer"],
            `questionAnswer ${question.questionAnswer} tidak ada di questionChoices`,
          );
        }

        if (question.questionContextRef) {
          if (!contextIndexes.has(question.questionContextRef)) {
            addValidationIssue(
              context,
              [
                "testPackageItems",
                itemIndex,
                "questions",
                questionIndex,
                "questionContextRef",
              ],
              `context tidak ditemukan: ${question.questionContextRef}`,
            );
          } else {
            usedContextIds.add(question.questionContextRef);
          }
        }
      });
    });

    pkg.questionContexts.forEach((questionContext, index) => {
      if (!usedContextIds.has(questionContext.id)) {
        addValidationIssue(
          context,
          ["questionContexts", index, "id"],
          `context tidak direferensikan oleh question mana pun: ${questionContext.id}`,
        );
      }
    });
  });

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
    const isSafeFileName =
      path.basename(options.selectedFile) === options.selectedFile &&
      options.selectedFile.endsWith(".json");
    if (!isSafeFileName) {
      throw new Error("--file harus berupa nama file *.json tanpa path");
    }
  }

  if (options.replaceExisting && !options.selectedFile) {
    throw new Error("--replace-existing wajib dipakai bersama --file");
  }

  if (options.replaceExisting && options.validateOnly) {
    throw new Error("--replace-existing tidak dapat dipakai bersama --validate-only");
  }

  return options;
}

function formatZodIssue(issue) {
  const location = issue.path.length > 0 ? `$.${issue.path.join(".")}` : "$";
  return `${location}: ${issue.message}`;
}

async function loadAndValidateSeedFiles(selectedFile) {
  let entries;
  try {
    entries = await fs.readdir(SEED_DATA_DIR);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`folder tidak dapat dibaca: ${SEED_DATA_DIR} (${message})`);
  }

  const availableJsonFiles = entries.filter((name) => name.endsWith(".json")).sort();
  if (selectedFile && !availableJsonFiles.includes(selectedFile)) {
    throw new Error(`file tidak ditemukan di ${SEED_DATA_DIR}: ${selectedFile}`);
  }

  const jsonFiles = selectedFile ? [selectedFile] : availableJsonFiles;
  const seedFiles = [];
  const errors = [];

  for (const file of jsonFiles) {
    const raw = await fs.readFile(path.join(SEED_DATA_DIR, file), "utf-8");
    if (!raw.trim()) {
      log(`SKIP file "${file}" - kosong`);
      continue;
    }

    let json;
    try {
      json = JSON.parse(raw);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push({ file, message: `$: JSON tidak valid (${message})` });
      continue;
    }

    const result = seedTestPackageSchema.safeParse(json);
    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.push({ file, message: formatZodIssue(issue) });
      }
      continue;
    }

    seedFiles.push({ file, pkg: result.data });
  }

  const filesByPackageName = new Map();
  for (const { file, pkg } of seedFiles) {
    const previousFile = filesByPackageName.get(pkg.name);
    if (previousFile) {
      errors.push({
        file,
        message: `$.name: package name duplikat dengan ${previousFile}: ${pkg.name}`,
      });
    } else {
      filesByPackageName.set(pkg.name, file);
    }
  }

  return { checkedFiles: jsonFiles.length, seedFiles, errors };
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
          explanation: question.explanation ?? null,
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
  const { checkedFiles, seedFiles, errors: validationErrors } =
    await loadAndValidateSeedFiles(options.selectedFile);

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
