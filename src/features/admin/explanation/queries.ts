import "server-only";

import type { JlptSection, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ExplanationQueueFilter } from "./schemas";

// Tidak di-cache: antrean ini dipakai untuk memutuskan apa yang dikerjakan
// berikutnya, jadi harus selalu mencerminkan keadaan sekarang.

// Empat kategori antrean. `missing` beroperasi pada Question (belum punya baris
// pembahasan sama sekali), tiga sisanya pada QuestionExplanation.
function whereForFilter(filter: ExplanationQueueFilter): Prisma.QuestionWhereInput {
  switch (filter) {
    case "missing":
      return { explanation: { is: null } };
    case "unreviewed":
      return { explanation: { is: { source: "AI", reviewedAt: null } } };
    case "doubt":
      return { explanation: { is: { answerKeyDoubt: true } } };
    case "reviewed":
      return { explanation: { is: { reviewedAt: { not: null } } } };
  }
}

export async function getExplanationCounts() {
  const [total, missing, unreviewed, doubt, reviewed] = await Promise.all([
    prisma.question.count(),
    prisma.question.count({ where: whereForFilter("missing") }),
    prisma.question.count({ where: whereForFilter("unreviewed") }),
    prisma.question.count({ where: whereForFilter("doubt") }),
    prisma.question.count({ where: whereForFilter("reviewed") }),
  ]);
  return { total, missing, unreviewed, doubt, reviewed };
}

// Soal tanpa pembahasan dikelompokkan per section. Penting karena generator
// melewati CHOUKAI secara bawaan: fixture hanya menyimpan URL audio tanpa
// transkrip, jadi model tidak punya bahan dan hanya akan mengarang. Sisa
// CHOUKAI karena itu bukan antrean yang bisa dikerjakan, melainkan tertahan
// oleh transkripsi audio.
export async function getMissingBySection() {
  const [rows, items] = await Promise.all([
    prisma.question.groupBy({
      by: ["testPackageItemId"],
      where: { explanation: { is: null } },
      _count: { _all: true },
    }),
    prisma.testPackageItem.findMany({ select: { id: true, section: true } }),
  ]);

  const sectionByItem = new Map(items.map((item) => [item.id, item.section]));
  const tally = new Map<JlptSection, number>();
  for (const row of rows) {
    const section = sectionByItem.get(row.testPackageItemId);
    if (!section) continue;
    tally.set(section, (tally.get(section) ?? 0) + row._count._all);
  }

  const choukai = tally.get("CHOUKAI") ?? 0;
  const other = [...tally.entries()].filter(([section]) => section !== "CHOUKAI");
  return {
    choukai,
    other,
    otherTotal: other.reduce((sum, [, count]) => sum + count, 0),
  };
}

const QUEUE_PAGE_SIZE = 50;

export async function listExplanationQueue(filter: ExplanationQueueFilter, packageId?: number) {
  const where: Prisma.QuestionWhereInput = { ...whereForFilter(filter) };
  if (packageId) where.testPackageItem = { testPackageId: packageId };

  const [rows, matching] = await Promise.all([
    prisma.question.findMany({
      where,
      // Urutan naratif paket, bukan id: operator mengerjakan satu mondai sampai
      // selesai, bukan melompat antar-paket.
      orderBy: [
        { testPackageItem: { testPackageId: "asc" } },
        { testPackageItem: { session: "asc" } },
        { testPackageItem: { order: "asc" } },
        { order: "asc" },
      ],
      take: QUEUE_PAGE_SIZE,
      select: {
        id: true,
        order: true,
        questionText: true,
        questionAnswer: true,
        explanation: {
          select: {
            source: true,
            reviewedAt: true,
            answerKeyDoubt: true,
            answerKeyDoubtNote: true,
            summary: true,
          },
        },
        testPackageItem: {
          select: {
            mondaiType: true,
            session: true,
            testPackage: { select: { id: true, name: true, jlptLevel: true } },
          },
        },
      },
    }),
    prisma.question.count({ where }),
  ]);

  return { rows, matching, truncated: matching > rows.length, pageSize: QUEUE_PAGE_SIZE };
}

// Ringkasan per paket. Generator pembahasan dijalankan per file fixture, jadi
// operator perlu tahu paket mana yang paling banyak menyisakan pekerjaan.
export async function listPackageExplanationCoverage() {
  const [packages, items, explained] = await Promise.all([
    prisma.testPackage.findMany({
      orderBy: [{ jlptLevel: "asc" }, { name: "desc" }],
      select: { id: true, name: true, jlptLevel: true },
    }),
    prisma.testPackageItem.findMany({
      select: { id: true, testPackageId: true, _count: { select: { questions: true } } },
    }),
    prisma.question.groupBy({
      by: ["testPackageItemId"],
      where: { explanation: { isNot: null } },
      _count: { _all: true },
    }),
  ]);

  const totalByPackage = new Map<number, number>();
  const packageByItem = new Map<number, number>();
  for (const item of items) {
    packageByItem.set(item.id, item.testPackageId);
    totalByPackage.set(
      item.testPackageId,
      (totalByPackage.get(item.testPackageId) ?? 0) + item._count.questions,
    );
  }

  const explainedByPackage = new Map<number, number>();
  for (const row of explained) {
    const packageId = packageByItem.get(row.testPackageItemId);
    if (!packageId) continue;
    explainedByPackage.set(
      packageId,
      (explainedByPackage.get(packageId) ?? 0) + row._count._all,
    );
  }

  return packages
    .map((row) => {
      const total = totalByPackage.get(row.id) ?? 0;
      const withExplanation = explainedByPackage.get(row.id) ?? 0;
      return { ...row, total, withExplanation, missing: total - withExplanation };
    })
    .filter((row) => row.total > 0);
}

export async function getExplanationEditorData(questionId: number) {
  return prisma.question.findUnique({
    where: { id: questionId },
    select: {
      id: true,
      order: true,
      questionText: true,
      questionAnswer: true,
      questionImage: true,
      questionAudio: true,
      questionChoices: {
        orderBy: { codeAnswer: "asc" },
        select: { codeAnswer: true, answerText: true, answerImage: true },
      },
      questionContext: { select: { storyText: true, storyAudio: true, storyImage: true } },
      explanation: {
        select: {
          summary: true,
          detail: true,
          translation: true,
          keyPoints: true,
          answerKeyDoubt: true,
          answerKeyDoubtNote: true,
          source: true,
          aiModel: true,
          promptVersion: true,
          generatedAt: true,
          reviewedAt: true,
          updatedAt: true,
          choices: {
            orderBy: { codeAnswer: "asc" },
            select: { codeAnswer: true, isCorrect: true, reason: true },
          },
        },
      },
      testPackageItem: {
        select: {
          mondaiType: true,
          section: true,
          session: true,
          instruction: true,
          testPackage: { select: { id: true, name: true, jlptLevel: true } },
        },
      },
    },
  });
}

// Navigasi "berikutnya" di dalam antrean yang sedang dikerjakan, supaya operator
// tidak perlu kembali ke daftar setiap menyelesaikan satu soal.
export async function getNextInQueue(
  filter: ExplanationQueueFilter,
  currentQuestionId: number,
) {
  const next = await prisma.question.findFirst({
    where: { ...whereForFilter(filter), id: { gt: currentQuestionId } },
    orderBy: { id: "asc" },
    select: { id: true },
  });
  return next?.id ?? null;
}
