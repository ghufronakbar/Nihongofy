import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSeedAccessError } from "@/lib/seed-auth";
import type { SeedTestPackage } from "./types";

// Import route for real bank-soal data scraped by another tool. Each JSON
// file in src/test-package-data/ is one SeedTestPackage (shape documented in
// docs/seed.md) — one file per package because a single paket's JSON can get
// very large. Unlike the Fase 5.1 demo seed route, this handles real (larger,
// less trusted) data: development-only with a dedicated bearer secret, and each
// Question is its own transaction so a single malformed record doesn't roll
// back everything already imported.
export const dynamic = "force-dynamic";

const SEED_DATA_DIR = path.join(process.cwd(), "src/test-package-data");

function log(message: string) {
  console.log(`[seed:test-package] ${message}`);
}

async function loadSeedFiles(): Promise<{ file: string; pkg: SeedTestPackage }[]> {
  let entries: string[];
  try {
    entries = await fs.readdir(SEED_DATA_DIR);
  } catch {
    log(`ERROR — folder tidak ditemukan: ${SEED_DATA_DIR}`);
    return [];
  }

  const jsonFiles = entries.filter((name) => name.endsWith(".json")).sort();
  const results: { file: string; pkg: SeedTestPackage }[] = [];

  for (const file of jsonFiles) {
    const raw = await fs.readFile(path.join(SEED_DATA_DIR, file), "utf-8");

    if (!raw.trim()) {
      log(`SKIP file "${file}" — kosong`);
      continue;
    }

    try {
      const pkg = JSON.parse(raw) as SeedTestPackage;
      results.push({ file, pkg });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log(`ERROR file "${file}" — JSON tidak valid: ${message}`);
    }
  }

  return results;
}

export async function GET(request: Request) {
  const accessError = getSeedAccessError(request);
  if (accessError) return accessError;

  const summary = {
    packagesSeeded: [] as string[],
    packagesSkipped: [] as string[],
    filesWithErrors: [] as string[],
    questionsSeeded: 0,
    errors: [] as { context: string; message: string }[],
  };

  const seedFiles = await loadSeedFiles();
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
    const contextIdMap = new Map<string, number>();

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

        let questionContextId: number | null = null;
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

  return NextResponse.json(summary);
}
