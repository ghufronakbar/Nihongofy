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

/**
 * Cara anonymizeAccount menangani satu relasi `User`:
 * - `dihapus`: baris milik user dihapus (`deleteMany`).
 * - `dikosongkan`: baris dipertahankan, FK ke user di-set null (`updateMany`).
 * - `dianonimkan`: baris dan FK-nya dipertahankan, isi pribadinya diganti (`updateMany`).
 * - `dibiarkan`: tidak disentuh sama sekali; alasannya wajib ditulis.
 */
type Handling =
  | { kind: "dihapus" }
  // FK di baris User itu sendiri (self-relation) dikosongkan oleh `tx.user.update`.
  | { kind: "dikosongkan" }
  | { kind: "dianonimkan"; apa: string }
  | { kind: "dibiarkan"; alasan: string };

// Daftar eksplisit relasi `User` yang sudah ditangani anonymizeAccount, per nama
// field relasi (bukan per model: Report punya tiga relasi ke User dengan
// penanganan berbeda). Menambah relasi ke User tanpa menambah barisnya di sini
// membuat tes gagal — itu disengaja.
const HANDLED_USER_RELATIONS: Record<string, Handling> = {
  questionComments: {
    kind: "dianonimkan",
    apa: "di-soft delete (deletedAt, deletedById = diri sendiri) karena balasan orang lain menempel pada root",
  },
  deletedComments: {
    kind: "dibiarkan",
    alasan:
      "deletedById pada catatan orang lain adalah atribusi takedown admin: penentu boleh-tidaknya " +
      "entri dipulihkan. Nama yang tampil ikut anonim karena dibaca dari baris User.",
  },
  adminAuditLogs: { kind: "dianonimkan", apa: "snapshot actorName diganti; baris log dipertahankan" },
  attempts: { kind: "dihapus" },
  kanaProgresses: { kind: "dihapus" },
  flashcardCollection: { kind: "dihapus" },
  flashcardSubscriptions: { kind: "dihapus" },
  flashcardCards: { kind: "dihapus" },
  flashcardRevlogs: { kind: "dihapus" },
  practiceSessions: { kind: "dihapus" },
  articleInteractions: { kind: "dihapus" },
  authTokens: { kind: "dihapus" },
  oauthAccounts: { kind: "dihapus" },
  conversationSessions: { kind: "dihapus" },
  conversationQuotas: { kind: "dihapus" },
  questionCommentVotes: { kind: "dihapus" },
  reports: { kind: "dikosongkan" },
  handledReports: {
    kind: "dibiarkan",
    alasan:
      "handledById adalah jejak admin yang menindak laporan orang lain, setara AdminAuditLog; " +
      "nama yang tampil ikut anonim karena dibaca dari baris User.",
  },
  reportReplies: {
    kind: "dibiarkan",
    alasan:
      "repliedById adalah jejak admin yang membalas laporan orang lain lewat email, setara " +
      "AdminAuditLog; nama yang tampil ikut anonim karena dibaca dari baris User.",
  },
  // Suspend posting milik akun ini: kolomnya di baris User sendiri.
  postingSuspendedBy: { kind: "dikosongkan" },
  postingSuspensionsIssued: {
    kind: "dibiarkan",
    alasan:
      "postingSuspendedById pada akun orang lain adalah jejak admin yang men-suspend, setara " +
      "AdminAuditLog; suspend-nya tetap berlaku setelah admin itu pergi.",
  },
};

const userModel = Prisma.dmmf.datamodel.models.find((model) => model.name === "User");
const userRelations = (userModel?.fields ?? []).filter((field) => field.kind === "object");

function toPrismaClientProperty(modelName: string) {
  return modelName.charAt(0).toLowerCase() + modelName.slice(1);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Kolom FK relasi ini. `ownRow` berarti FK-nya ada di baris User milik akun ini
 * sendiri (sisi pemilik self-relation), bukan di baris model seberang.
 */
function foreignKeyOf(relation: Prisma.DMMF.Field) {
  if (relation.relationFromFields?.length) {
    expect(relation.relationFromFields, `FK relasi User.${relation.name}`).toHaveLength(1);
    return { column: relation.relationFromFields[0]!, ownRow: true };
  }
  const model = Prisma.dmmf.datamodel.models.find((candidate) => candidate.name === relation.type);
  const backReference = model?.fields.find(
    (field) =>
      field.relationName === relation.relationName &&
      field.type === "User" &&
      (field.relationFromFields?.length ?? 0) > 0,
  );
  const columns = backReference?.relationFromFields ?? [];
  expect(columns, `FK relasi User.${relation.name}`).toHaveLength(1);
  return { column: columns[0]!, ownRow: false };
}

/** Setiap pemanggilan `tx.<model>.<method>(...)` di sumber, sampai `});` penutupnya. */
function callsOf(modelName: string, method: "deleteMany" | "updateMany" | "update") {
  const opening = `tx.${toPrismaClientProperty(modelName)}.${method}(`;
  const calls: string[] = [];
  for (let start = source.indexOf(opening); start >= 0; start = source.indexOf(opening, start + 1)) {
    calls.push(source.slice(start, source.indexOf("});", start)));
  }
  return calls;
}

/** `where` yang membatasi ke user ini: `{ userId }` atau `{ reporterId: userId }`. */
function scopesToUser(call: string, foreignKey: string) {
  const key = escapeRegExp(foreignKey);
  return new RegExp(`where:\\s*\\{[^}]*\\b(${key}\\s*[,}]|${key}:\\s*userId\\b)`).test(call);
}

describe("anonymizeAccount", () => {
  it("relasi User dikenali dari schema.prisma", () => {
    expect(userRelations.length).toBeGreaterThan(0);
  });

  // Penjaga terpenting modul ini. Penghapusan akun dulu berupa hard delete baris
  // User, sehingga setiap relasi ikut terhapus otomatis lewat cascade. Sekarang
  // barisnya bertahan, jadi relasi personal yang baru ditambahkan ke User TIDAK
  // lagi ikut terhapus dengan sendirinya — kalau lupa ditangani di sana, data
  // pribadi tertinggal di akun yang dikira sudah dihapus.
  it("setiap relasi User sudah terdaftar beserta cara penanganannya", () => {
    const unlisted = userRelations
      .filter((relation) => !(relation.name in HANDLED_USER_RELATIONS))
      .map((relation) => `User.${relation.name} (${relation.type})`);

    expect(
      unlisted,
      `Relasi User berikut belum ditangani anonymizeAccount: ${unlisted.join(", ")}. ` +
        "Tambahkan penanganannya di src/features/auth/lib/anonymize-account.ts — hapus datanya, " +
        "kosongkan FK-nya, atau anonimkan isinya — lalu daftarkan relasinya di " +
        "HANDLED_USER_RELATIONS pada tes ini. Bila memang sengaja dibiarkan, tulis alasannya.",
    ).toEqual([]);
  });

  it("daftar tidak menyimpan relasi yang sudah tidak ada di schema", () => {
    const known = new Set(userRelations.map((relation) => relation.name));
    expect(Object.keys(HANDLED_USER_RELATIONS).filter((name) => !known.has(name))).toEqual([]);
  });

  it.each(userRelations.map((relation) => [relation.name, relation] as const))(
    "penanganan User.%s sesuai daftar",
    (name, relation) => {
      const handling = HANDLED_USER_RELATIONS[name];
      if (!handling) return; // dilaporkan tes daftar di atas
      const { column: foreignKey, ownRow } = foreignKeyOf(relation);
      const where = `tx.${toPrismaClientProperty(relation.type)} dengan where ${foreignKey}`;
      const nullsForeignKey = (call: string) =>
        new RegExp(`data:\\s*\\{[^}]*\\b${escapeRegExp(foreignKey)}:\\s*null`).test(call);

      if (ownRow) {
        // FK di baris User sendiri hanya dapat dikosongkan lewat update baris itu.
        expect(handling.kind, `User.${name}`).toMatch(/^(dikosongkan|dibiarkan)$/);
        if (handling.kind === "dikosongkan") {
          expect(
            callsOf("User", "update").some(
              (call) => /where:\s*\{\s*id:\s*userId\s*\}/.test(call) && nullsForeignKey(call),
            ),
            `tx.user.update yang meng-null-kan ${foreignKey}`,
          ).toBe(true);
        }
        return;
      }

      switch (handling.kind) {
        case "dihapus":
          expect(
            callsOf(relation.type, "deleteMany").some((call) => scopesToUser(call, foreignKey)),
            `deleteMany ${where}`,
          ).toBe(true);
          break;
        case "dikosongkan":
          expect(
            callsOf(relation.type, "updateMany").some(
              (call) => scopesToUser(call, foreignKey) && nullsForeignKey(call),
            ),
            `updateMany ${where} yang meng-null-kan ${foreignKey}`,
          ).toBe(true);
          break;
        case "dianonimkan":
          expect(handling.apa.length).toBeGreaterThan(0);
          expect(
            callsOf(relation.type, "updateMany").some((call) => scopesToUser(call, foreignKey)),
            `updateMany ${where}`,
          ).toBe(true);
          break;
        case "dibiarkan":
          expect(handling.alasan.length, `alasan User.${name} dibiarkan`).toBeGreaterThan(40);
          break;
      }
    },
  );

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

  // Kolom skalar, bukan relasi, jadi tidak tertangkap daftar di atas: alasan
  // suspend ditulis admin tentang orang ini.
  it("mengosongkan penanda suspend posting milik akun", () => {
    const [update] = callsOf("User", "update");
    expect(update).toMatch(/postingSuspendedAt:\s*null/);
    expect(update).toMatch(/postingSuspendedReason:\s*null/);
  });
});
