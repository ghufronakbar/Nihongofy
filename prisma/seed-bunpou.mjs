// Validate Bunpou fixtures and upsert the publishable Phase A catalog.
//
//   npm run seed:bunpou:check
//   npm run seed:bunpou

import { PrismaClient } from "@prisma/client";
import {
  LEVELS,
  comparisonProblems,
  loadTaxonomy,
  pointPublicationFlags,
  readAllPointFiles,
  readComparisons,
  readManifest,
  readTextSources,
  toBunpouRow,
  validateCatalog,
} from "./bunpou-data.mjs";

const validateOnly = process.argv.includes("--validate-only");
const CHUNK_SIZE = 300;

function log(message) {
  console.log(`[seed:bunpou] ${message}`);
}

const UPSERT_POINTS = `
INSERT INTO "BunpouPoint" (
  "key", "level", "order", "kind", "sectionKey", "family",
  "title", "titlePlain", "titleReading", "titleRomaji", "meaningId", "meaningEn", "searchText",
  "content", "tags", "source", "extract", "review", "aiModel", "promptVersion", "generatedAt",
  "retiredAt", "updatedAt"
)
SELECT
  x."key", x."level"::"JlptLevel", x."order", x."kind"::"BunpouKind", x."sectionKey", x."family",
  x."title", x."titlePlain", x."titleReading", x."titleRomaji", x."meaningId", x."meaningEn",
  x."searchText", x."content", x."tags", x."source", x."extract", x."review", x."aiModel", x."promptVersion",
  (x."generatedAt"::timestamptz AT TIME ZONE 'UTC'), NULL, (now() AT TIME ZONE 'UTC')
FROM jsonb_to_recordset($1::jsonb) AS x(
  "key" text, "level" text, "order" int, "kind" text, "sectionKey" text, "family" text,
  "title" text, "titlePlain" text, "titleReading" text, "titleRomaji" text,
  "meaningId" text, "meaningEn" text, "searchText" text, "content" jsonb, "tags" text[],
  "source" jsonb, "extract" jsonb, "review" jsonb, "aiModel" text, "promptVersion" text, "generatedAt" text
)
ON CONFLICT ("key") DO UPDATE SET
  "level" = EXCLUDED."level",
  "order" = EXCLUDED."order",
  "kind" = EXCLUDED."kind",
  "sectionKey" = EXCLUDED."sectionKey",
  "family" = EXCLUDED."family",
  "title" = EXCLUDED."title",
  "titlePlain" = EXCLUDED."titlePlain",
  "titleReading" = EXCLUDED."titleReading",
  "titleRomaji" = EXCLUDED."titleRomaji",
  "meaningId" = EXCLUDED."meaningId",
  "meaningEn" = EXCLUDED."meaningEn",
  "searchText" = EXCLUDED."searchText",
  "content" = EXCLUDED."content",
  "tags" = EXCLUDED."tags",
  "source" = EXCLUDED."source",
  "extract" = EXCLUDED."extract",
  "review" = EXCLUDED."review",
  "aiModel" = EXCLUDED."aiModel",
  "promptVersion" = EXCLUDED."promptVersion",
  "generatedAt" = EXCLUDED."generatedAt",
  "retiredAt" = NULL,
  "updatedAt" = EXCLUDED."updatedAt"
`;

const RETIRE_MISSING_POINTS = `
UPDATE "BunpouPoint"
SET "retiredAt" = (now() AT TIME ZONE 'UTC'), "updatedAt" = (now() AT TIME ZONE 'UTC')
WHERE "retiredAt" IS NULL
  AND "level"::text = ANY($2::text[])
  AND NOT ("key" = ANY($1::text[]))
`;

async function collect() {
  const taxonomy = await loadTaxonomy();
  const pointFiles = await readAllPointFiles();
  const manifest = await readManifest();
  const textSources = await readTextSources();
  const comparisons = await readComparisons();
  const validation = validateCatalog(pointFiles, manifest, taxonomy, textSources);
  const errors = [...validation.errors];
  const warnings = [...validation.warnings];
  const rows = [];
  const pendingByLevel = new Map();
  const doubtByLevel = new Map();
  const importedTextReferences = new Set(
    [...pointFiles.values()].flatMap((file) =>
      file.points.flatMap((point) =>
        point.source.references.map((reference) => `${reference.sourceKey}:${reference.itemKey}`),
      ),
    ),
  );
  const completeTextSources = textSources.filter((source) => {
    const missing = source.days
      .flatMap((day) => day.items)
      .filter((item) => !importedTextReferences.has(`${source.key}:${item.key}`));
    if (missing.length > 0) {
      warnings.push(`${source.key}: ${missing.length} item source text belum diimpor; retirement ${source.level} ditahan`);
      return false;
    }
    return true;
  });
  const activeLevels = [
    ...new Set([
      ...manifest.decks.map((deck) => deck.level),
      ...completeTextSources.map((source) => source.level),
    ]),
  ];

  for (const level of LEVELS) {
    let pending = 0;
    let doubts = 0;
    for (const point of pointFiles.get(level).points) {
      const state = pointPublicationFlags(point);
      if (state.pending) pending += 1;
      if (state.doubt) doubts += 1;
      if (!state.ready) continue;
      rows.push(toBunpouRow(level, point));
    }
    pendingByLevel.set(level, pending);
    doubtByLevel.set(level, doubts);
  }

  const publishedKeys = new Set(rows.map((row) => row.key));
  const comparisonRows = [];
  const comparisonKeys = new Set();
  for (const comparison of comparisons.comparisons) {
    const where = `comparison ${comparison.key}`;
    if (comparisonKeys.has(comparison.key)) errors.push(`${where}: key ganda`);
    comparisonKeys.add(comparison.key);
    for (const problem of comparisonProblems(comparison, validation.pointsByKey)) {
      errors.push(`${where}: ${problem}`);
    }
    if (!comparison.content || !comparison.ai || !comparison.reviewedAt || comparison.ai.doubt) continue;
    const unpublished = comparison.points.filter((key) => !publishedKeys.has(key));
    if (unpublished.length > 0) {
      warnings.push(`${where}: dilewati karena point belum terbit: ${unpublished.join(", ")}`);
      continue;
    }
    comparisonRows.push({
      key: comparison.key,
      title: comparison.title,
      content: comparison.content,
      aiModel: comparison.ai.model,
      promptVersion: comparison.ai.promptVersion,
      generatedAt: comparison.ai.generatedAt,
      reviewedAt: comparison.reviewedAt,
      points: comparison.points,
    });
  }

  return {
    rows,
    comparisonRows,
    errors,
    warnings,
    pendingByLevel,
    doubtByLevel,
    totalComparisons: comparisons.comparisons.length,
    activeLevels,
  };
}

async function main() {
  const collected = await collect();
  for (const level of LEVELS) {
    const published = collected.rows.filter((row) => row.level === level).length;
    log(
      `${level}: ${published} siap terbit, ${collected.pendingByLevel.get(level)} pending, ` +
        `${collected.doubtByLevel.get(level)} doubt`,
    );
  }
  log(
    `${collected.comparisonRows.length}/${collected.totalComparisons} comparison siap terbit`,
  );

  if (collected.warnings.length > 0) {
    log(`${collected.warnings.length} peringatan:`);
    for (const warning of collected.warnings.slice(0, 40)) log(`  WARN ${warning}`);
  }
  if (collected.errors.length > 0) {
    console.error(`[seed:bunpou] ${collected.errors.length} error validasi:`);
    for (const error of collected.errors.slice(0, 80)) console.error(`  - ${error}`);
    if (collected.errors.length > 80) {
      console.error(`  ... dan ${collected.errors.length - 80} lainnya`);
    }
    process.exitCode = 1;
    return;
  }

  if (validateOnly) {
    log(`valid: ${collected.rows.length} point siap terbit (database tidak disentuh)`);
    return;
  }

  const prisma = new PrismaClient();
  try {
    await prisma.$transaction(
      async (tx) => {
        // Free the positive learning-order namespace before upsert so two
        // existing points can safely exchange order under the unique index.
        await tx.$executeRawUnsafe(
          'UPDATE "BunpouPoint" SET "order" = -"id" WHERE "order" > 0 AND "level"::text = ANY($1::text[])',
          collected.activeLevels,
        );

        for (let index = 0; index < collected.rows.length; index += CHUNK_SIZE) {
          await tx.$executeRawUnsafe(
            UPSERT_POINTS,
            JSON.stringify(collected.rows.slice(index, index + CHUNK_SIZE)),
          );
        }
        await tx.$executeRawUnsafe(
          RETIRE_MISSING_POINTS,
          collected.rows.map((row) => row.key),
          collected.activeLevels,
        );

        const pointIds = new Map(
          (
            await tx.bunpouPoint.findMany({
              where: { key: { in: collected.rows.map((row) => row.key) } },
              select: { id: true, key: true },
            })
          ).map((point) => [point.key, point.id]),
        );

        for (const comparison of collected.comparisonRows) {
          const stored = await tx.bunpouComparison.upsert({
            where: { key: comparison.key },
            update: {
              title: comparison.title,
              content: comparison.content,
              aiModel: comparison.aiModel,
              promptVersion: comparison.promptVersion,
              generatedAt: new Date(comparison.generatedAt),
              reviewedAt: new Date(comparison.reviewedAt),
              retiredAt: null,
            },
            create: {
              key: comparison.key,
              title: comparison.title,
              content: comparison.content,
              aiModel: comparison.aiModel,
              promptVersion: comparison.promptVersion,
              generatedAt: new Date(comparison.generatedAt),
              reviewedAt: new Date(comparison.reviewedAt),
            },
            select: { id: true },
          });
          await tx.bunpouComparisonPoint.deleteMany({ where: { comparisonId: stored.id } });
          await tx.bunpouComparisonPoint.createMany({
            data: comparison.points.map((key, order) => ({
              comparisonId: stored.id,
              pointId: pointIds.get(key),
              order,
            })),
          });
        }

        await tx.bunpouComparison.updateMany({
          where: {
            key: { notIn: collected.comparisonRows.map((comparison) => comparison.key) },
            retiredAt: null,
          },
          data: { retiredAt: new Date() },
        });
      },
      { timeout: 120_000 },
    );

    log(
      `selesai: ${collected.rows.length} point dan ${collected.comparisonRows.length} comparison terbit`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("[seed:bunpou] gagal", error);
  process.exitCode = 1;
});
