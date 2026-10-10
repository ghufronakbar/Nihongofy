import "server-only";

import type { JlptLevel, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Tidak di-cache. Layar ini dibuka justru untuk memeriksa keadaan bank soal
// setelah import atau perbaikan, jadi angka yang tertinggal satu revalidasi
// lebih berbahaya daripada biaya query-nya.

export async function listAdminTestPackages(filter: { level?: JlptLevel; query?: string }) {
  const where: Prisma.TestPackageWhereInput = {};
  if (filter.level) where.jlptLevel = filter.level;
  if (filter.query) where.name = { contains: filter.query, mode: "insensitive" };

  const packages = await prisma.testPackage.findMany({
    where,
    orderBy: [{ jlptLevel: "asc" }, { name: "desc" }],
    select: {
      id: true,
      name: true,
      jlptLevel: true,
      updatedAt: true,
      _count: { select: { testPackageItems: true, questionContexts: true, attempts: true } },
      testPackageItems: { select: { session: true, _count: { select: { questions: true } } } },
    },
  });

  const ids = packages.map((row) => row.id);

  // Cakupan pembahasan per paket. Dihitung sekali untuk semua paket, bukan
  // per baris, supaya daftar tidak menghasilkan satu query per paket.
  const explained = ids.length
    ? await prisma.question.groupBy({
        by: ["testPackageItemId"],
        where: {
          explanation: { isNot: null },
          testPackageItem: { testPackageId: { in: ids } },
        },
        _count: { _all: true },
      })
    : [];

  const itemOwners = ids.length
    ? await prisma.testPackageItem.findMany({
        where: { testPackageId: { in: ids } },
        select: { id: true, testPackageId: true },
      })
    : [];
  const packageByItem = new Map(itemOwners.map((item) => [item.id, item.testPackageId]));

  const explainedByPackage = new Map<number, number>();
  for (const row of explained) {
    const packageId = packageByItem.get(row.testPackageItemId);
    if (!packageId) continue;
    explainedByPackage.set(packageId, (explainedByPackage.get(packageId) ?? 0) + row._count._all);
  }

  return packages.map(({ testPackageItems, ...row }) => {
    const questionCount = testPackageItems.reduce(
      (total, item) => total + item._count.questions,
      0,
    );
    return {
      ...row,
      questionCount,
      // "SESI UJIAN" pada halaman publik sebenarnya menghitung blok mondai.
      // Di sini keduanya dipisah supaya operator melihat angka yang benar.
      sessionCount: new Set(testPackageItems.map((item) => item.session)).size,
      explainedCount: explainedByPackage.get(row.id) ?? 0,
    };
  });
}

export async function getAdminTestPackage(id: number) {
  return prisma.testPackage.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      jlptLevel: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { attempts: true, questionContexts: true } },
      questionContexts: {
        select: {
          id: true,
          storyText: true,
          storyImage: true,
          storyAudio: true,
          _count: { select: { questions: true } },
        },
      },
      testPackageItems: {
        orderBy: [{ session: "asc" }, { order: "asc" }],
        select: {
          id: true,
          mondaiType: true,
          section: true,
          session: true,
          order: true,
          instruction: true,
          questions: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              order: true,
              questionText: true,
              questionImage: true,
              questionAudio: true,
              questionAnswer: true,
              questionContextId: true,
              questionContext: {
                select: { storyImage: true, storyAudio: true },
              },
              questionChoices: {
                select: { answerImage: true },
              },
              explanation: { select: { id: true, source: true, reviewedAt: true, answerKeyDoubt: true } },
              _count: { select: { questionChoices: true } },
            },
          },
        },
      },
    },
  });
}

// Editor wacana bersama. Menyertakan daftar soal yang memakainya, karena
// perubahan di sini terasa di semua soal itu sekaligus.
export async function getAdminQuestionContext(id: number) {
  return prisma.questionContext.findUnique({
    where: { id },
    select: {
      id: true,
      storyText: true,
      storyImage: true,
      storyAudio: true,
      testPackage: { select: { id: true, name: true, jlptLevel: true } },
      questions: {
        orderBy: [{ testPackageItem: { session: "asc" } }, { order: "asc" }],
        select: {
          id: true,
          order: true,
          questionText: true,
          testPackageItem: { select: { mondaiType: true, session: true } },
        },
      },
    },
  });
}

// Editor soal. Admin memang boleh melihat kunci jawaban dan pembahasan — jalur
// ini tidak boleh dipakai ulang oleh modul exam.
export async function getAdminQuestion(id: number) {
  return prisma.question.findUnique({
    where: { id },
    select: {
      id: true,
      order: true,
      questionText: true,
      questionImage: true,
      questionAudio: true,
      questionAnswer: true,
      questionChoices: {
        orderBy: { codeAnswer: "asc" },
        select: { id: true, codeAnswer: true, answerText: true, answerImage: true },
      },
      questionContext: {
        select: { id: true, storyText: true, storyImage: true, storyAudio: true },
      },
      explanation: {
        select: { summary: true, source: true, reviewedAt: true, answerKeyDoubt: true, answerKeyDoubtNote: true },
      },
      testPackageItem: {
        select: {
          id: true,
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
