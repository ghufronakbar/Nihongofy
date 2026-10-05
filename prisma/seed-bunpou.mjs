// Validate Bunpou fixtures and upsert the publishable catalog, comparisons, and
// question links (Phase B1).
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
  readGapSources,
  readTextSources,
  toBunpouRow,
  validateCatalog,
} from "./bunpou-data.mjs";
import { buildCatalogIndex, linkFileProblems, questionId, readAllLinkFiles } from "./bunpou-links.mjs";
import { loadAndValidateSeedFiles } from "./test-package-fixture.mjs";

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
  const gapSources = await readGapSources();
  const comparisons = await readComparisons();
  const validation = validateCatalog(pointFiles, manifest, taxonomy, textSources, gapSources);
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

  const linkPackages = await collectLinks(pointFiles, publishedKeys, errors, warnings);

  return {
    rows,
    comparisonRows,
    linkPackages,
    errors,
    warnings,
    pendingByLevel,
    doubtByLevel,
    totalComparisons: comparisons.comparisons.length,
    activeLevels,
  };
}

// Tautan soal per paket. Hanya tautan ke point yang terbit yang ditulis;
// soal tanpa key (confidence null) tidak punya baris.
async function collectLinks(pointFiles, publishedKeys, errors, warnings) {
  const linkFiles = await readAllLinkFiles();
  if (linkFiles.size === 0) return [];
  const { seedFiles, errors: fixtureErrors } = await loadAndValidateSeedFiles(null);
  const packages = new Map(seedFiles.map(({ file, pkg }) => [file.slice(0, -".json".length), pkg]));
  const index = buildCatalogIndex(pointFiles);

  const linkPackages = [];
  for (const [name, file] of linkFiles) {
    const where = `question-links/${name}.json`;
    const pkg = packages.get(name);
    if (!pkg) {
      const fixtureError = fixtureErrors.find((error) => error.file === `${name}.json`);
      errors.push(`${where}: fixture paket ${fixtureError ? `tidak valid (${fixtureError.message})` : "tidak ditemukan"}`);
      continue;
    }
    for (const problem of linkFileProblems(file, pkg, index)) errors.push(`${where}: ${problem}`);

    const questions = [];
    const unpublished = new Set();
    for (const record of file.questions) {
      if (!record.confidence) continue;
      const links = [];
      for (const pattern of record.patterns) {
        if (!pattern.key || links.some((link) => link.key === pattern.key)) continue;
        if (!publishedKeys.has(pattern.key)) {
          unpublished.add(pattern.key);
          continue;
        }
        links.push({ key: pattern.key, role: pattern.role === "tested" ? "TESTED" : "DISTRACTOR", order: links.length });
      }
      if (links.length === 0) continue;
      questions.push({
        id: questionId(record.mondaiType, record.order),
        confidence: record.confidence.toUpperCase(),
        ai: record.ai,
        links,
      });
    }
    if (unpublished.size > 0) {
      warnings.push(`${where}: tautan ke point belum terbit dilewati: ${[...unpublished].join(", ")}`);
    }
    linkPackages.push({ file: name, name: pkg.name, questions });
  }
  return linkPackages;
}

// Tautan setiap paket diganti utuh, jadi tautan yang hilang dari fixture ikut
// terhapus. Paket yang belum ada di database dilewati, bukan gagal.
async function writeLinks(tx, linkPackages, pointIds) {
  const summary = { links: 0, packages: 0, skipped: [], missing: [] };
  for (const linkPackage of linkPackages) {
    const stored = await tx.testPackage.findMany({
      where: { name: linkPackage.name },
      take: 2,
      select: {
        testPackageItems: { select: { mondaiType: true, questions: { select: { id: true, order: true } } } },
      },
    });
    if (stored.length !== 1) {
      summary.skipped.push(`${linkPackage.file} (${stored.length === 0 ? "belum ada di database" : "nama ganda"})`);
      continue;
    }
    const questionIds = new Map(
      stored[0].testPackageItems.flatMap((item) =>
        item.questions.map((question) => [questionId(item.mondaiType, question.order), question.id]),
      ),
    );
    await tx.questionBunpouLink.deleteMany({ where: { questionId: { in: [...questionIds.values()] } } });

    const data = [];
    for (const question of linkPackage.questions) {
      const id = questionIds.get(question.id);
      if (!id) {
        summary.missing.push(`${linkPackage.file} ${question.id}`);
        continue;
      }
      for (const link of question.links) {
        data.push({
          questionId: id,
          pointId: pointIds.get(link.key),
          role: link.role,
          confidence: question.confidence,
          order: link.order,
          aiModel: question.ai.model,
          promptVersion: question.ai.promptVersion,
          generatedAt: new Date(question.ai.generatedAt),
        });
      }
    }
    if (data.length > 0) await tx.questionBunpouLink.createMany({ data });
    summary.links += data.length;
    summary.packages += 1;
  }
  return summary;
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
  const linkCount = collected.linkPackages.reduce(
    (sum, linkPackage) => sum + linkPackage.questions.reduce((total, question) => total + question.links.length, 0),
    0,
  );
  log(`${linkCount} tautan soal siap dari ${collected.linkPackages.length} paket`);

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
  let linkSummary = null;
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

        linkSummary = await writeLinks(tx, collected.linkPackages, pointIds);
      },
      { timeout: 120_000 },
    );

    log(
      `selesai: ${collected.rows.length} point dan ${collected.comparisonRows.length} comparison terbit, ` +
        `${linkSummary.links} tautan soal dari ${linkSummary.packages} paket`,
    );
    for (const skipped of linkSummary.skipped) log(`  tautan dilewati: ${skipped}`);
    for (const missing of linkSummary.missing.slice(0, 40)) log(`  soal tidak ditemukan: ${missing}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("[seed:bunpou] gagal", error);
  process.exitCode = 1;
});
