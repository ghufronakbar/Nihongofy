import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

// `anonymize-account.ts` mengimpor "server-only", yang melempar di luar runtime
// Next. Jadi yang diperiksa adalah sumbernya, bukan modulnya.
const source = readFileSync(
  fileURLToPath(new URL("./anonymize-account.ts", import.meta.url)),
  "utf8",
);

function toPrismaClientProperty(modelName: string) {
  return modelName.charAt(0).toLowerCase() + modelName.slice(1);
}

describe("anonymizeAccount", () => {
  // Penjaga terpenting modul ini. Penghapusan akun dulu berupa hard delete baris
  // User, sehingga setiap relasi ikut terhapus otomatis lewat cascade. Sekarang
  // barisnya bertahan, jadi relasi personal yang baru ditambahkan ke User TIDAK
  // lagi ikut terhapus dengan sendirinya — kalau lupa ditangani di sini, data
  // pribadi tertinggal di akun yang dikira sudah dihapus.
  it("menangani setiap relasi pada model User", () => {
    const userModel = Prisma.dmmf.datamodel.models.find((model) => model.name === "User");
    expect(userModel).toBeDefined();

    const relatedModels = new Set(
      userModel!.fields.filter((field) => field.kind === "object").map((field) => field.type),
    );
    expect(relatedModels.size).toBeGreaterThan(0);

    const unhandled = [...relatedModels].filter(
      (modelName) => !source.includes(`tx.${toPrismaClientProperty(modelName)}.`),
    );

    expect(
      unhandled,
      `Relasi User berikut belum ditangani anonymizeAccount: ${unhandled.join(", ")}. ` +
        "Hapus datanya, atau pertahankan dengan alasan eksplisit seperti AdminAuditLog.",
    ).toEqual([]);
  });

  it("tidak pernah menghapus baris User", () => {
    expect(source).not.toMatch(/tx\.user\.delete/);
    expect(source).toContain("tx.user.update");
  });

  it("men-soft delete comment, bukan menghapusnya", () => {
    expect(source).not.toMatch(/tx\.questionComment\.delete/);
    expect(source).toContain("tx.questionComment.updateMany");
  });

  it("menghapus OAuthAccount supaya login Google tidak menghidupkan akun", () => {
    expect(source).toContain("tx.oAuthAccount.deleteMany");
  });
});
