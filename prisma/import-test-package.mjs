// Logika import satu paket tes ke database, dipakai bersama oleh dua pemanggil:
// script CLI `npm run seed:test-package` dan Server Action admin di
// `src/features/admin/test-package/actions.ts`.
//
// Diekstrak ke sini supaya keduanya tidak punya salinan sendiri. Aturan yang
// dijaga di dalamnya — advisory lock per nama paket, satu paket satu transaksi,
// penolakan paket parsial, dan penolakan replacement bila paket sudah punya
// attempt — adalah invariant data, bukan detail script.
//
// Client Prisma dikirim sebagai argumen: CLI memakai PrismaClient sendiri,
// aplikasi memakai singleton di src/lib/prisma.
import { normalizeExplanation } from "./test-package-contract.mjs";

export const TRANSACTION_TIMEOUT_MS = 120_000;

export function expectedPackageShape(pkg) {
  return {
    jlptLevel: pkg.jlptLevel,
    contexts: pkg.questionContexts.length,
    items: new Map(
      pkg.testPackageItems.map((item) => [
        item.mondaiType,
        {
          section: item.section,
          session: item.session,
          order: item.order,
          questions: item.questions.length,
        },
      ]),
    ),
  };
}

export function existingPackageMismatches(existing, pkg) {
  const expected = expectedPackageShape(pkg);
  const mismatches = [];

  if (existing.jlptLevel !== expected.jlptLevel) {
    mismatches.push(`jlptLevel DB=${existing.jlptLevel}, fixture=${expected.jlptLevel}`);
  }

  if (existing._count.questionContexts !== expected.contexts) {
    mismatches.push(
      `contexts DB=${existing._count.questionContexts}, fixture=${expected.contexts}`,
    );
  }

  if (existing.testPackageItems.length !== expected.items.size) {
    mismatches.push(
      `items DB=${existing.testPackageItems.length}, fixture=${expected.items.size}`,
    );
  }

  const storedItems = new Map(
    existing.testPackageItems.map((item) => [item.mondaiType, item]),
  );

  for (const [mondaiType, expectedItem] of expected.items) {
    const storedItem = storedItems.get(mondaiType);
    if (!storedItem) {
      mismatches.push(`item ${mondaiType} belum ada`);
      continue;
    }

    for (const field of ["section", "session", "order"]) {
      if (storedItem[field] !== expectedItem[field]) {
        mismatches.push(
          `${mondaiType}.${field} DB=${storedItem[field]}, fixture=${expectedItem[field]}`,
        );
      }
    }

    if (storedItem._count.questions !== expectedItem.questions) {
      mismatches.push(
        `${mondaiType}.questions DB=${storedItem._count.questions}, fixture=${expectedItem.questions}`,
      );
    }
  }

  return mismatches;
}

// Bentuk nested-create untuk relasi 1:1 QuestionExplanation. Mengembalikan
// undefined bila soal memang belum punya pembahasan, supaya tidak ada baris
// kosong yang dibuat.
export function explanationCreateInput(question) {
  const explanation = normalizeExplanation(question);
  if (!explanation) return undefined;

  const { choices, generatedAt, ...columns } = explanation;
  return {
    create: {
      ...columns,
      ...(generatedAt ? { generatedAt } : {}),
      ...(choices ? { choices: { create: choices } } : {}),
    },
  };
}

export async function importTestPackage(prisma, { file, pkg }, replaceExisting) {
  return prisma.$transaction(
    async (transaction) => {
      const lockKey = `seed:test-package:${pkg.name}`;
      await transaction.$queryRaw`
        SELECT 1 AS locked
        FROM pg_advisory_xact_lock(hashtext(${lockKey}))
      `;

      const existingPackages = await transaction.testPackage.findMany({
        where: { name: pkg.name },
        take: 2,
        select: {
          id: true,
          jlptLevel: true,
          _count: { select: { questionContexts: true, attempts: true } },
          testPackageItems: {
            select: {
              mondaiType: true,
              section: true,
              session: true,
              order: true,
              _count: { select: { questions: true } },
            },
          },
        },
      });

      if (existingPackages.length > 1) {
        return {
          status: "blocked",
          message: `lebih dari satu package memakai nama "${pkg.name}"`,
        };
      }

      const existing = existingPackages[0];
      let replacedId = null;

      if (existing && !replaceExisting) {
        const mismatches = existingPackageMismatches(existing, pkg);
        if (mismatches.length === 0) {
          return { status: "skipped", id: existing.id };
        }

        return {
          status: "blocked",
          message:
            `package existing id=${existing.id} tidak lengkap/sesuai fixture: ` +
            `${mismatches.slice(0, 5).join("; ")}. ` +
            `Periksa lalu jalankan ulang dengan --file ${file} --replace-existing bila aman.`,
        };
      }

      if (existing && replaceExisting) {
        if (existing._count.attempts > 0) {
          return {
            status: "blocked",
            message:
              `package existing id=${existing.id} memiliki ${existing._count.attempts} attempt; ` +
              "replacement ditolak agar data user tidak terhapus",
          };
        }

        replacedId = existing.id;
        await transaction.testPackage.delete({ where: { id: existing.id } });
      }

      const testPackage = await transaction.testPackage.create({
        data: { name: pkg.name, jlptLevel: pkg.jlptLevel },
        select: { id: true },
      });

      const events = [];
      const contextIdMap = new Map();

      for (const questionContext of pkg.questionContexts) {
        const created = await transaction.questionContext.create({
          data: {
            testPackageId: testPackage.id,
            storyText: questionContext.storyText ?? null,
            storyImage: questionContext.storyImage ?? null,
            storyAudio: questionContext.storyAudio ?? null,
          },
          select: { id: true },
        });
        contextIdMap.set(questionContext.id, created.id);
        events.push(`CREATE context "${questionContext.id}" -> id ${created.id}`);
      }

      for (const item of pkg.testPackageItems) {
        const questions = item.questions.map((question) => ({
          order: question.order,
          questionText: question.questionText,
          questionImage: question.questionImage ?? null,
          questionAudio: question.questionAudio ?? null,
          questionAnswer: question.questionAnswer,
          explanation: explanationCreateInput(question),
          questionContextId: question.questionContextRef
            ? contextIdMap.get(question.questionContextRef)
            : null,
          questionChoices: {
            create: question.questionChoices.map((choice) => ({
              codeAnswer: choice.codeAnswer,
              answerText: choice.answerText,
              answerImage: choice.answerImage ?? null,
            })),
          },
        }));

        await transaction.testPackageItem.create({
          data: {
            testPackageId: testPackage.id,
            mondaiType: item.mondaiType,
            section: item.section,
            session: item.session,
            order: item.order,
            instruction: item.instruction ?? null,
            questions: { create: questions },
          },
        });

        events.push(
          `CREATE item ${item.mondaiType} (sesi ${item.session}, order ${item.order}, ${questions.length} soal)`,
        );
      }

      return {
        status: replacedId ? "replaced" : "seeded",
        id: testPackage.id,
        replacedId,
        questionsSeeded: pkg.testPackageItems.reduce(
          (total, item) => total + item.questions.length,
          0,
        ),
        events,
      };
    },
    { maxWait: 10_000, timeout: TRANSACTION_TIMEOUT_MS },
  );
}
