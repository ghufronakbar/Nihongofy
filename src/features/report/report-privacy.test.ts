import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Kedua modul mengimpor kode server (prisma, "server-only"), jadi yang diperiksa
// sumbernya, mengikuti pola `anonymize-account.test.ts`.
const read = (path: string) =>
  readFileSync(fileURLToPath(new URL(path, new URL("../../../", import.meta.url))), "utf8");

const anonymizeSource = read("src/features/auth/lib/anonymize-account.ts");
const exportSource = read("src/app/api/account/export/route.ts");

/** Opsi relasi `reports` di ekspor akun, dipisah antara argumen dan isi select. */
function exportReports() {
  // Isi select laporan datar (`kolom: true`), jadi `[^}]*` cukup.
  const match = /reports: \{([\s\S]*?)select: \{([^}]*)\}/.exec(exportSource);
  expect(match, "ekspor akun tidak memuat laporan").not.toBeNull();
  return { args: match![1]!, select: match![2]! };
}

describe("laporan pada penghapusan akun", () => {
  it("identitas pelapor dikosongkan untuk semua jenis target, laporannya dipertahankan", () => {
    const block = /tx\.report\.updateMany\(\{([\s\S]*?)\}\);/.exec(anonymizeSource)?.[1] ?? "";
    expect(block).toContain("where: { reporterId: userId }");
    expect(block).toContain("reporterId: null");
    expect(block).toContain("replyEmail: null");
    // Tanpa filter jenis target: laporan kartu flashcard ikut dibersihkan.
    expect(block).not.toContain("targetType");
    expect(anonymizeSource).not.toMatch(/tx\.report\.delete/);
  });
});

describe("laporan pada ekspor akun", () => {
  it("memuat laporan untuk semua jenis target, termasuk kartu flashcard", () => {
    const { args, select } = exportReports();
    expect(args).not.toContain("where:");
    const columns = ["targetType", "category", "message", "questionId", "articleId", "commentId"];
    for (const column of [...columns, "vocabId"]) {
      expect(select, column).toContain(`${column}: true`);
    }
  });

  it("tidak memuat catatan internal maupun penanganan admin", () => {
    const { select } = exportReports();
    for (const column of ["adminNote", "handledBy", "repliedBy", "status"]) {
      expect(select, column).not.toContain(column);
    }
  });
});
