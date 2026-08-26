import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SEED_DATA_DIR = fileURLToPath(new URL("../src/test-package-data/", import.meta.url));

function log(message) {
  console.log(`[seed:test-package] ${message}`);
}

async function loadSeedFiles() {
  let entries;
  try {
    entries = await fs.readdir(SEED_DATA_DIR);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`folder tidak dapat dibaca: ${SEED_DATA_DIR} (${message})`);
  }

  const jsonFiles = entries.filter((name) => name.endsWith(".json")).sort();
  const seedFiles = [];
  const fileErrors = [];

  for (const file of jsonFiles) {
    const raw = await fs.readFile(path.join(SEED_DATA_DIR, file), "utf-8");

    if (!raw.trim()) {
      log(`SKIP file "${file}" — kosong`);
      continue;
    }

    try {
      seedFiles.push({ file, pkg: JSON.parse(raw) });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log(`ERROR file "${file}" — JSON tidak valid: ${message}`);
      fileErrors.push({ file, message });
    }
  }

  return { seedFiles, fileErrors };
}

async function main() {
  const summary = {
    packagesSeeded: [],
    packagesSkipped: [],
    filesWithErrors: [],
    questionsSeeded: 0,
    errors: [],
  };

  const { seedFiles, fileErrors } = await loadSeedFiles();
  for (const { file, message } of fileErrors) {
    summary.filesWithErrors.push(file);
    summary.errors.push({ context: file, message });
  }

  log(`START — ${seedFiles.length} file(s) di ${SEED_DATA_DIR}`);

  for (const { file, pkg } of seedFiles) {
    if (!pkg.name || !pkg.jlptLevel || !Array.isArray(pkg.testPackageItems)) {
      const message = `file "${file}" tidak sesuai schema SeedTestPackage (name/jlptLevel/testPackageItems hilang)`;
      log(`ERROR ${message}`);
      summary.filesWithErrors.push(file);
      summary.errors.push({ context: file, message });
      continue;
    }

    const existing = await prisma.testPackage.findFirst({
      where: { name: pkg.name },
      select: { id: true },
    });

    if (existing) {
      log(`SKIP package "${pkg.name}" (${file}) — sudah ada (id=${existing.id})`);
      summary.packagesSkipped.push(pkg.name);
      continue;
    }

    log(`CREATE package "${pkg.name}" (${file}, ${pkg.jlptLevel})`);
    const testPackage = await prisma.testPackage.create({
      data: { name: pkg.name, jlptLevel: pkg.jlptLevel },
      select: { id: true },
    });

    // Local ref id (from the JSON file) -> real DB id, so questions can point
    // at the right shared QuestionContext.
    const contextIdMap = new Map();

    for (const ctx of pkg.questionContexts ?? []) {
      const created = await prisma.questionContext.create({
        data: {
          testPackageId: testPackage.id,
          storyText: ctx.storyText ?? null,
          storyImage: ctx.storyImage ?? null,
          storyAudio: ctx.storyAudio ?? null,
        },
        select: { id: true },
      });
      contextIdMap.set(ctx.id, created.id);
      log(`  CREATE context "${ctx.id}" -> id ${created.id}`);
    }

    for (const item of pkg.testPackageItems) {
      const testPackageItem = await prisma.testPackageItem.create({
        data: {
          testPackageId: testPackage.id,
          mondaiType: item.mondaiType,
          section: item.section,
          session: item.session,
          order: item.order,
          instruction: item.instruction ?? null,
        },
        select: { id: true },
      });
      log(`  CREATE item ${item.mondaiType} (sesi ${item.session}, order ${item.order})`);

      for (const question of item.questions) {
        const questionLabel = `${pkg.name} / ${item.mondaiType} / soal #${question.order}`;

        let questionContextId = null;
        if (question.questionContextRef) {
          const resolved = contextIdMap.get(question.questionContextRef);
          if (!resolved) {
            const message = `questionContextRef "${question.questionContextRef}" tidak ditemukan di questionContexts`;
            log(`    ERROR ${questionLabel}: ${message}`);
            summary.errors.push({ context: questionLabel, message });
            continue;
          }
          questionContextId = resolved;
        }

        // One transaction per question: a bad record only fails itself, not
        // the questions already committed before it.
        try {
          await prisma.$transaction(async (tx) => {
            await tx.question.create({
              data: {
                testPackageItemId: testPackageItem.id,
                order: question.order,
                questionText: question.questionText,
                questionImage: question.questionImage ?? null,
                questionAudio: question.questionAudio ?? null,
                questionAnswer: question.questionAnswer,
                explanation: question.explanation ?? null,
                questionContextId,
                questionChoices: {
                  create: question.questionChoices.map((choice) => ({
                    codeAnswer: choice.codeAnswer,
                    answerText: choice.answerText,
                    answerImage: choice.answerImage ?? null,
                  })),
                },
              },
            });
          });
          summary.questionsSeeded += 1;
          log(`    CREATE ${questionLabel} — OK`);
        } catch (error) {
          // Per docs/database.md: constraint violations during import are a
          // signal of extraction error — report loudly, never skip silently.
          const message = error instanceof Error ? error.message : String(error);
          log(`    ERROR ${questionLabel}: ${message}`);
          summary.errors.push({ context: questionLabel, message });
        }
      }
    }

    summary.packagesSeeded.push(pkg.name);
  }

  log(
    `DONE — seeded ${summary.packagesSeeded.length} package(s), skipped ${summary.packagesSkipped.length}, ${summary.questionsSeeded} soal, ${summary.errors.length} error`,
  );

  console.info(`[seed:test-package] summary ${JSON.stringify(summary)}`);

  if (summary.errors.length > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error("[seed:test-package] gagal", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
