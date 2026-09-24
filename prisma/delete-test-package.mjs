// Menghapus satu paket tes dari database.
//
// Dibutuhkan karena seluruh script seed hanya membuat atau memperbarui: menghapus
// file JSON di src/test-package-data/ tidak mengeluarkan paketnya dari database,
// sehingga paket yang sudah ditinggalkan tetap tampil di aplikasi.
//
// Penghapusan bersifat permanen dan merambat (cascade) ke mondai, soal, pilihan,
// bacaan, komentar, attempt, dan jawaban latihan milik paket itu. Karena itu
// script ini meminta konfirmasi eksplisit, dan menolak paket yang sudah punya
// attempt kecuali dipaksa.
import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { assertSafeFileName, SEED_DATA_DIR } from "./test-package-fixture.mjs";

const prisma = new PrismaClient();

function log(message) {
  console.log(`[test-package:delete] ${message}`);
}

function parseArguments(argv) {
  const options = { name: null, file: null, confirm: false, force: false };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const consumesNext = !argument.includes("=");
    const readValue = (prefix) =>
      argument.startsWith(`${prefix}=`) ? argument.slice(prefix.length + 1) : argv[index + 1];

    if (argument === "--confirm") {
      options.confirm = true;
      continue;
    }
    if (argument === "--force") {
      options.force = true;
      continue;
    }
    if (argument.startsWith("--name")) {
      const value = readValue("--name");
      if (!value || value.startsWith("--")) throw new Error("--name membutuhkan nama package");
      options.name = value;
      if (consumesNext) index += 1;
      continue;
    }
    if (argument.startsWith("--file")) {
      const value = readValue("--file");
      if (!value || value.startsWith("--")) throw new Error("--file membutuhkan nama file *.json");
      options.file = assertSafeFileName(value);
      if (consumesNext) index += 1;
      continue;
    }

    throw new Error(`argumen tidak dikenal: ${argument}`);
  }

  if (!options.name && !options.file) {
    throw new Error("wajib memberi --name \"<nama package>\" atau --file <nama.json>");
  }

  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));

  let name = options.name;
  if (!name) {
    const raw = await fs.readFile(path.join(SEED_DATA_DIR, options.file), "utf-8");
    name = JSON.parse(raw).name;
  }

  const testPackage = await prisma.testPackage.findFirst({
    where: { name },
    select: {
      id: true,
      name: true,
      jlptLevel: true,
      _count: { select: { testPackageItems: true, questionContexts: true, attempts: true } },
    },
  });

  if (!testPackage) {
    log(`package "${name}" tidak ada di database; tidak ada yang dihapus`);
    return;
  }

  const questions = await prisma.question.count({
    where: { testPackageItem: { testPackageId: testPackage.id } },
  });
  const comments = await prisma.questionComment.count({
    where: { question: { testPackageItem: { testPackageId: testPackage.id } } },
  });

  log(
    `package "${testPackage.name}" (${testPackage.jlptLevel}, id=${testPackage.id}): ` +
      `${testPackage._count.testPackageItems} mondai, ${questions} soal, ` +
      `${testPackage._count.questionContexts} bacaan, ${comments} komentar, ` +
      `${testPackage._count.attempts} attempt`,
  );

  if (testPackage._count.attempts > 0 && !options.force) {
    log("DIBATALKAN - package ini punya attempt; tambahkan --force bila memang ingin menghapusnya");
    process.exitCode = 1;
    return;
  }

  if (!options.confirm) {
    log("DRY-RUN - tidak ada yang dihapus. Tambahkan --confirm untuk benar-benar menghapus.");
    return;
  }

  await prisma.testPackage.delete({ where: { id: testPackage.id } });
  log(`DIHAPUS - package id=${testPackage.id} beserta seluruh isinya`);
}

main()
  .catch((error) => {
    console.error("[test-package:delete] gagal", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
