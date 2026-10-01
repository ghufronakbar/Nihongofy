import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  REPORT_CATEGORIES,
  REPORT_CATEGORIES_BY_TARGET,
  REPORT_CATEGORY_HINTS,
  REPORT_CATEGORY_LABELS,
  REPORT_TARGET_TYPES,
  REPORT_TARGET_TYPE_LABELS,
  isReportCategoryAllowed,
  reportCategoriesFor,
  type ReportCategoryValue,
  type ReportTargetTypeValue,
} from "./constants";
import { SubmitReportSchema } from "./schemas";

const VOCAB_CATEGORIES = [
  "READING_ERROR",
  "MEANING_ERROR",
  "EXAMPLE_ERROR",
  "TAG_ERROR",
] as const satisfies readonly ReportCategoryValue[];

// Satu contoh identitas per target. `satisfies Record` membuat target baru gagal
// dikompilasi di sini sampai contohnya ditambahkan, sehingga peta kategori dan
// skema submit selalu diuji untuk semua target.
const TARGET_SAMPLES = {
  GENERAL: {},
  QUESTION: { questionId: 7 },
  QUESTION_EXPLANATION: { questionId: 7 },
  ARTICLE: { articleId: 3 },
  COMMENT: { commentId: 5 },
  FLASHCARD_VOCAB: { vocabId: 12 },
} satisfies Record<ReportTargetTypeValue, Record<string, number>>;

function submission(
  targetType: ReportTargetTypeValue,
  category: ReportCategoryValue,
  extra: Record<string, unknown> = {},
) {
  return {
    targetType,
    ...TARGET_SAMPLES[targetType],
    category,
    message: "Arti kata ini tertukar dengan kata lain yang mirip bunyinya.",
    ...extra,
  };
}

function prismaEnumValues(name: string) {
  const enumType = Prisma.dmmf.datamodel.enums.find((candidate) => candidate.name === name);
  expect(enumType, `enum ${name} tidak ada di schema.prisma`).toBeDefined();
  return enumType!.values.map((value) => value.name);
}

describe("konstanta laporan mengikuti schema.prisma", () => {
  // Konstanta ini disalin manual dari enum Prisma supaya dapat dipakai komponen
  // client. Salinan yang tertinggal membuat target atau kategori baru ditolak zod
  // padahal database sudah menerimanya, atau sebaliknya.
  it("REPORT_TARGET_TYPES sama dengan enum ReportTargetType", () => {
    expect([...REPORT_TARGET_TYPES].sort()).toEqual(prismaEnumValues("ReportTargetType").sort());
  });

  it("REPORT_CATEGORIES sama dengan enum ReportCategory", () => {
    expect([...REPORT_CATEGORIES].sort()).toEqual(prismaEnumValues("ReportCategory").sort());
  });
});

describe("peta kategori per target", () => {
  it("setiap target punya daftar kategori tanpa duplikat", () => {
    for (const targetType of REPORT_TARGET_TYPES) {
      const categories = reportCategoriesFor(targetType);
      expect(categories.length, targetType).toBeGreaterThan(0);
      expect(new Set(categories).size, targetType).toBe(categories.length);
    }
  });

  it("setiap kategori dipakai minimal satu target", () => {
    const used = new Set(Object.values(REPORT_CATEGORIES_BY_TARGET).flat());
    expect(REPORT_CATEGORIES.filter((category) => !used.has(category))).toEqual([]);
  });

  it("OTHER terbuka di semua target", () => {
    for (const targetType of REPORT_TARGET_TYPES) {
      expect(isReportCategoryAllowed(targetType, "OTHER"), targetType).toBe(true);
    }
  });

  it("kartu flashcard memakai kategori konten kosakata, BUG, dan OTHER", () => {
    expect(reportCategoriesFor("FLASHCARD_VOCAB")).toEqual([...VOCAB_CATEGORIES, "BUG", "OTHER"]);
  });

  it("kartu flashcard tidak memakai CONTENT_ERROR yang serba-mencakup", () => {
    expect(isReportCategoryAllowed("FLASHCARD_VOCAB", "CONTENT_ERROR")).toBe(false);
  });

  it("kategori kosakata hanya berlaku untuk kartu flashcard", () => {
    for (const targetType of REPORT_TARGET_TYPES) {
      if (targetType === "FLASHCARD_VOCAB") continue;
      for (const category of VOCAB_CATEGORIES) {
        expect(isReportCategoryAllowed(targetType, category), `${targetType}/${category}`).toBe(
          false,
        );
      }
    }
  });

  it("setiap target dan kategori punya label, dan setiap kategori punya petunjuk", () => {
    for (const targetType of REPORT_TARGET_TYPES) {
      expect(REPORT_TARGET_TYPE_LABELS[targetType]?.trim(), targetType).toBeTruthy();
    }
    for (const category of REPORT_CATEGORIES) {
      expect(REPORT_CATEGORY_LABELS[category]?.trim(), category).toBeTruthy();
      expect(REPORT_CATEGORY_HINTS[category]?.trim(), category).toBeTruthy();
    }
  });
});

describe("SubmitReportSchema", () => {
  it("menerima tepat kategori yang diizinkan peta, untuk setiap target", () => {
    for (const targetType of REPORT_TARGET_TYPES) {
      for (const category of REPORT_CATEGORIES) {
        const allowed = isReportCategoryAllowed(targetType, category);
        const result = SubmitReportSchema.safeParse(submission(targetType, category));
        expect(result.success, `${targetType}/${category}`).toBe(allowed);
        if (!allowed) {
          expect(result.error?.issues[0]?.path, `${targetType}/${category}`).toEqual(["category"]);
        }
      }
    }
  });

  it("menerima laporan kartu flashcard yang lengkap", () => {
    const result = SubmitReportSchema.safeParse(submission("FLASHCARD_VOCAB", "READING_ERROR"));
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      targetType: "FLASHCARD_VOCAB",
      vocabId: 12,
      category: "READING_ERROR",
      turnstileToken: "",
      useAccountEmail: false,
    });
  });

  it("menolak laporan kartu tanpa vocabId", () => {
    const result = SubmitReportSchema.safeParse({
      targetType: "FLASHCARD_VOCAB",
      category: "MEANING_ERROR",
      message: "Arti kata ini tertukar dengan kata lain yang mirip bunyinya.",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["vocabId"]);
  });

  it.each([0, -1, 1.5, "12", null])("menolak vocabId %j", (vocabId) => {
    const result = SubmitReportSchema.safeParse(
      submission("FLASHCARD_VOCAB", "EXAMPLE_ERROR", { vocabId }),
    );
    expect(result.success).toBe(false);
  });

  it("tidak meneruskan FK target lain dari client", () => {
    // Laporan kartu yang menyelundupkan questionId: kuncinya dibuang zod, jadi
    // action tidak pernah menulisnya (CHECK constraint di database pun menolak).
    const result = SubmitReportSchema.safeParse(
      submission("FLASHCARD_VOCAB", "TAG_ERROR", { questionId: 7, articleId: 3, commentId: 5 }),
    );
    expect(result.success).toBe(true);
    expect(result.data).not.toHaveProperty("questionId");
    expect(result.data).not.toHaveProperty("articleId");
    expect(result.data).not.toHaveProperty("commentId");
  });

  it("tidak menerima vocabId pada target lain", () => {
    const result = SubmitReportSchema.safeParse(
      submission("QUESTION", "CONTENT_ERROR", { vocabId: 12 }),
    );
    expect(result.success).toBe(true);
    expect(result.data).not.toHaveProperty("vocabId");
  });

  it("menolak target yang tidak dikenal", () => {
    const result = SubmitReportSchema.safeParse({
      ...submission("FLASHCARD_VOCAB", "READING_ERROR"),
      targetType: "FLASHCARD_CARD",
    });
    expect(result.success).toBe(false);
  });
});
