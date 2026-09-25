// Helper filesystem untuk script CLI: membaca folder fixture dan memvalidasi
// seluruh file di dalamnya. Kontraknya sendiri ada di test-package-contract.mjs,
// yang sengaja bebas dari `node:*` supaya dapat ikut ter-bundle ke aplikasi.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { seedTestPackageSchema, formatZodIssue } from "./test-package-contract.mjs";

export * from "./test-package-contract.mjs";

export const SEED_DATA_DIR = fileURLToPath(new URL("../src/test-package-data/", import.meta.url));

// Nama file dibatasi ke basename *.json supaya argumen --file tidak bisa
// dipakai membaca file di luar folder fixture.
export function assertSafeFileName(fileName) {
  const isSafeFileName = path.basename(fileName) === fileName && fileName.endsWith(".json");
  if (!isSafeFileName) {
    throw new Error("--file harus berupa nama file *.json tanpa path");
  }
  return fileName;
}

export async function loadAndValidateSeedFiles(selectedFile) {
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
  const emptyFiles = [];
  const errors = [];

  for (const file of jsonFiles) {
    const raw = await fs.readFile(path.join(SEED_DATA_DIR, file), "utf-8");
    if (!raw.trim()) {
      emptyFiles.push(file);
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

  return { checkedFiles: jsonFiles.length, seedFiles, emptyFiles, errors };
}
