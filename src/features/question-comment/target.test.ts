import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  CommentTargetSchema,
  discussionPageHref,
  discussionThreadHref,
  targetColumns,
  targetOf,
  targetWhere,
  type CommentTarget,
} from "./target";

const TARGETS: CommentTarget[] = [
  { type: "question", questionId: 7 },
  { type: "vocab", vocabId: 12 },
  { type: "bunpou", bunpouPointId: 4 },
];

describe("CommentTarget", () => {
  it("kolom target dan targetOf saling membalik, dengan tepat satu kolom terisi", () => {
    for (const target of TARGETS) {
      const columns = targetColumns(target);
      expect(Object.values(columns).filter((value) => value !== null)).toHaveLength(1);
      expect(targetOf(columns)).toEqual(target);
    }
  });

  it("targetOf mengembalikan null bila tidak ada kolom target", () => {
    expect(targetOf({ questionId: null, vocabId: null, bunpouPointId: null })).toBeNull();
  });

  it("filter Prisma hanya menyebut kolom target itu sendiri", () => {
    expect(targetWhere({ type: "bunpou", bunpouPointId: 4 })).toEqual({ bunpouPointId: 4 });
  });

  it("skema menolak id pola yang tidak valid", () => {
    expect(CommentTargetSchema.safeParse({ type: "bunpou", bunpouPointId: 0 }).success).toBe(false);
    expect(CommentTargetSchema.safeParse({ type: "bunpou", vocabId: 4 }).success).toBe(false);
  });
});

describe("tautan diskusi", () => {
  it("diskusi pola lewat pengalih id → key", () => {
    expect(discussionPageHref({ type: "bunpou", bunpouPointId: 4 })).toBe("/bunpou/discussion/4");
    expect(
      discussionThreadHref({ id: 30, questionId: null, vocabId: null, bunpouPointId: 4 }, 31),
    ).toBe("/bunpou/discussion/4?comment=31");
  });

  it("tautan soal dan kata tidak berubah", () => {
    expect(discussionThreadHref({ id: 30, questionId: 7, vocabId: null, bunpouPointId: null })).toBe(
      "/discussion/30",
    );
    expect(
      discussionThreadHref({ id: 30, questionId: null, vocabId: 12, bunpouPointId: null }, 31),
    ).toBe("/flashcard/discussion/12#comment-31");
  });
});

// CHECK "tepat satu target" hanya ada di SQL migration; Prisma tidak dapat
// mengekspresikannya. Tes ini memastikan setiap kolom target di schema disebut
// definisi CHECK yang berlaku, sehingga target berikutnya tidak terlewat.
describe("QuestionComment_target_check", () => {
  const migrationsDir = fileURLToPath(new URL("../../../prisma/migrations/", import.meta.url));
  const sql = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .map((name) => readFileSync(`${migrationsDir}${name}/migration.sql`, "utf8").replace(/--[^\n]*/g, ""))
    .join("\n");

  it("menyebut semua kolom target dari schema.prisma", () => {
    const marker = 'ADD CONSTRAINT "QuestionComment_target_check"';
    const start = sql.lastIndexOf(marker);
    expect(start).toBeGreaterThanOrEqual(0);
    const check = sql.slice(start, sql.indexOf(";", start));

    const model = Prisma.dmmf.datamodel.models.find((candidate) => candidate.name === "QuestionComment");
    const targetFields = (model?.fields ?? []).filter(
      (field) =>
        field.kind === "object" &&
        ["Question", "FlashcardVocab", "BunpouPoint"].includes(field.type),
    );
    const columns = targetFields.flatMap((field) => field.relationFromFields ?? []);
    expect(columns).toEqual(expect.arrayContaining(["questionId", "vocabId", "bunpouPointId"]));
    for (const column of columns) expect(check, column).toContain(`"${column}"`);
    expect(check).toMatch(/num_nonnulls\([^)]*\) = 1/);
  });
});
