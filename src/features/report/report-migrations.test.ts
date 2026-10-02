import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

// CHECK constraint dan partial unique index tabel Report hanya ada di SQL
// migration; Prisma tidak dapat mengekspresikannya (docs/database.md), jadi
// `prisma validate` tidak akan menangkap target baru yang lupa ditangani di sana.
// Tes ini membaca migration tulis-tangan dan mencocokkannya dengan FK target di
// schema.prisma, sehingga target berikutnya ikut terjaga tanpa mengubah tes.

const MIGRATIONS_DIR = fileURLToPath(new URL("../../../prisma/migrations/", import.meta.url));

/** Komentar dibuang: komentar migration sering menyebut nama constraint. */
function stripComments(sql: string) {
  return sql.replace(/--[^\n]*/g, "");
}

const migrations = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()
  .map((name) => ({
    name,
    sql: stripComments(readFileSync(`${MIGRATIONS_DIR}${name}/migration.sql`, "utf8")),
  }));

const reportModel = Prisma.dmmf.datamodel.models.find((model) => model.name === "Report");
// Semua relasi Report selain ke User (pelapor, penanganan, balasan) adalah target.
const targetRelations = (reportModel?.fields ?? []).filter(
  (field) => field.kind === "object" && field.type !== "User",
);
const targetColumns = targetRelations.flatMap((field) => field.relationFromFields ?? []);

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Definisi `Report_target_columns_check` yang berlaku: yang terakhir ditambahkan. */
function latestTargetCheck() {
  const marker = 'ADD CONSTRAINT "Report_target_columns_check"';
  const migration = migrations.filter((candidate) => candidate.sql.includes(marker)).at(-1);
  expect(migration, "Report_target_columns_check tidak ditemukan").toBeDefined();
  const start = migration!.sql.lastIndexOf(marker);
  return migration!.sql.slice(start, migration!.sql.indexOf(";", start));
}

describe("FK target laporan", () => {
  it("dikenali dari schema.prisma, termasuk kartu flashcard", () => {
    expect(targetColumns).toEqual(
      expect.arrayContaining([
        "questionId",
        "articleId",
        "commentId",
        "vocabId",
        "bunpouPointId",
        "bunpouComparisonId",
      ]),
    );
  });

  // Laporan tidak boleh ikut terhapus bersama targetnya (Cascade), dan juga tidak
  // boleh menahan penghapusannya (Restrict). Lihat docs/module/report.md.
  it("seluruhnya ON DELETE SET NULL di schema dan di migration", () => {
    for (const field of targetRelations) {
      expect(field.relationOnDelete, field.name).toBe("SetNull");
    }
    const sql = migrations.map((migration) => migration.sql).join("\n");
    for (const column of targetColumns) {
      const fk = new RegExp(
        `ADD CONSTRAINT "Report_${column}_fkey"\\s+FOREIGN KEY \\("${column}"\\)[^;]*ON DELETE SET NULL`,
      );
      expect(sql, column).toMatch(fk);
    }
  });

  it("setiap kolom target disebut CHECK target↔FK yang berlaku", () => {
    const check = latestTargetCheck();
    for (const column of targetColumns) {
      expect(check, column).toContain(`"${column}" IS NULL`);
    }
  });

  it("laporan kartu hanya boleh membawa vocabId", () => {
    expect(latestTargetCheck()).toMatch(
      /\("targetType" = 'FLASHCARD_VOCAB' OR "vocabId" IS NULL\)/,
    );
  });

  it("laporan bunpou hanya boleh membawa FK pola atau perbandingannya", () => {
    const check = latestTargetCheck();
    expect(check).toMatch(/\("targetType" = 'BUNPOU_POINT' OR "bunpouPointId" IS NULL\)/);
    expect(check).toMatch(
      /\("targetType" = 'BUNPOU_COMPARISON' OR "bunpouComparisonId" IS NULL\)/,
    );
  });

  it("setiap kolom target punya partial unique index anti-banjir per pelapor", () => {
    const sql = migrations.map((migration) => migration.sql).join("\n");
    for (const column of targetColumns) {
      const name = escapeRegExp(column);
      const index = new RegExp(
        `CREATE UNIQUE INDEX "[^"]+"\\s+ON "Report"\\("reporterId",[^)]*"${name}"\\)\\s+` +
          `WHERE "status" = 'OPEN' AND "reporterId" IS NOT NULL AND "${name}" IS NOT NULL`,
      );
      expect(sql, column).toMatch(index);
    }
  });
});

describe("migration enum", () => {
  // PostgreSQL menolak memakai nilai enum di transaksi yang menambahkannya
  // (SQLSTATE 55P04), dan `prisma migrate deploy` menjalankan satu file sebagai
  // satu transaksi. Migration yang melanggar ini gagal di production dan
  // meninggalkan status migrasi gagal (P3018) yang harus di-resolve manual.
  it("nilai yang ditambahkan ADD VALUE tidak dipakai di file yang sama", () => {
    for (const migration of migrations) {
      const added = [...migration.sql.matchAll(/ALTER TYPE "[^"]+" ADD VALUE '([^']+)'/g)].map(
        (match) => match[1]!,
      );
      if (added.length === 0) continue;
      const rest = migration.sql.replace(/ALTER TYPE "[^"]+" ADD VALUE '[^']+'[^;]*;/g, "");
      for (const value of added) {
        expect(rest, `${migration.name}: '${value}'`).not.toContain(`'${value}'`);
      }
    }
  });

  it.each(["FLASHCARD_VOCAB", "BUNPOU_POINT", "BUNPOU_COMPARISON"])(
    "nilai enum laporan %s ditambahkan sebelum dipakai",
    (value) => {
      const addedAt = migrations.findIndex((migration) =>
        migration.sql.includes(`ALTER TYPE "ReportTargetType" ADD VALUE '${value}'`),
      );
      const usedAt = migrations.findIndex((migration) =>
        new RegExp(`"targetType" = '${value}'`).test(migration.sql),
      );
      expect(addedAt).toBeGreaterThanOrEqual(0);
      expect(usedAt).toBeGreaterThan(addedAt);
    },
  );
});
