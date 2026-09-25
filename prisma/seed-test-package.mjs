import { PrismaClient } from "@prisma/client";
import {
  assertSafeFileName,
  loadAndValidateSeedFiles,
} from "./test-package-fixture.mjs";
import { importTestPackage } from "./import-test-package.mjs";

const prisma = new PrismaClient();

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
      const result = await importTestPackage(prisma, seedFile, options.replaceExisting);

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
