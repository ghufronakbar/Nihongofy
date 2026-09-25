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

// Baris QuestionExplanation beserta alasan per pilihannya, siap untuk bulk
// insert. Mengembalikan null bila soal memang belum punya pembahasan.
export function explanationRows(question, questionId) {
  const explanation = normalizeExplanation(question);
  if (!explanation) return null;

  const { choices, generatedAt, ...columns } = explanation;
  return {
    row: { questionId, ...columns, ...(generatedAt ? { generatedAt } : {}) },
    choices: choices ?? [],
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

      // Seluruh isi paket ditulis dengan bulk insert, bukan satu baris satu
      // perintah. Paket berukuran wajar berisi ratusan sampai ribuan baris, dan
      // setiap perintah ke database berbiaya satu perjalanan bolak-balik
      // jaringan — pada koneksi Supabase terukur ~35 ms. Menulis satu per satu
      // membuat impor satu paket memakan puluhan detik padahal kerjanya sendiri
      // di bawah satu detik.
      //
      // `createManyAndReturn` mengembalikan baris sesuai urutan input, sehingga
      // id hasilnya dapat dipasangkan kembali ke data asal lewat posisi array.
      const testPackage = await transaction.testPackage.create({
        data: { name: pkg.name, jlptLevel: pkg.jlptLevel },
        select: { id: true },
      });

      const events = [];

      const contextIdMap = new Map();
      if (pkg.questionContexts.length > 0) {
        const createdContexts = await transaction.questionContext.createManyAndReturn({
          data: pkg.questionContexts.map((questionContext) => ({
            testPackageId: testPackage.id,
            storyText: questionContext.storyText ?? null,
            storyImage: questionContext.storyImage ?? null,
            storyAudio: questionContext.storyAudio ?? null,
          })),
          select: { id: true },
        });

        if (createdContexts.length !== pkg.questionContexts.length) {
          throw new Error("jumlah context yang dibuat tidak sama dengan fixture");
        }
        pkg.questionContexts.forEach((questionContext, index) => {
          contextIdMap.set(questionContext.id, createdContexts[index].id);
        });
        events.push(`CREATE ${createdContexts.length} context`);
      }

      const createdItems = await transaction.testPackageItem.createManyAndReturn({
        data: pkg.testPackageItems.map((item) => ({
          testPackageId: testPackage.id,
          mondaiType: item.mondaiType,
          section: item.section,
          session: item.session,
          order: item.order,
          instruction: item.instruction ?? null,
        })),
        select: { id: true, mondaiType: true },
      });
      const itemIdByMondai = new Map(createdItems.map((item) => [item.mondaiType, item.id]));
      events.push(`CREATE ${createdItems.length} mondai`);

      const sourceQuestions = [];
      const questionData = [];
      for (const item of pkg.testPackageItems) {
        for (const question of item.questions) {
          sourceQuestions.push(question);
          questionData.push({
            testPackageItemId: itemIdByMondai.get(item.mondaiType),
            order: question.order,
            questionText: question.questionText,
            questionImage: question.questionImage ?? null,
            questionAudio: question.questionAudio ?? null,
            questionAnswer: question.questionAnswer,
            questionContextId: question.questionContextRef
              ? contextIdMap.get(question.questionContextRef)
              : null,
          });
        }
      }

      const createdQuestions = await transaction.question.createManyAndReturn({
        data: questionData,
        select: { id: true },
      });
      if (createdQuestions.length !== sourceQuestions.length) {
        throw new Error("jumlah soal yang dibuat tidak sama dengan fixture");
      }
      events.push(`CREATE ${createdQuestions.length} soal`);

      const choiceData = [];
      const explanationData = [];
      const explanationChoiceSources = [];
      sourceQuestions.forEach((question, index) => {
        const questionId = createdQuestions[index].id;

        for (const choice of question.questionChoices) {
          choiceData.push({
            questionId,
            codeAnswer: choice.codeAnswer,
            answerText: choice.answerText,
            answerImage: choice.answerImage ?? null,
          });
        }

        const explanation = explanationRows(question, questionId);
        if (explanation) {
          explanationData.push(explanation.row);
          explanationChoiceSources.push(explanation.choices);
        }
      });

      if (choiceData.length > 0) {
        await transaction.questionChoice.createMany({ data: choiceData });
        events.push(`CREATE ${choiceData.length} pilihan`);
      }

      if (explanationData.length > 0) {
        const createdExplanations = await transaction.questionExplanation.createManyAndReturn({
          data: explanationData,
          select: { id: true },
        });
        if (createdExplanations.length !== explanationData.length) {
          throw new Error("jumlah pembahasan yang dibuat tidak sama dengan fixture");
        }

        const explanationChoiceData = [];
        explanationChoiceSources.forEach((choices, index) => {
          for (const choice of choices) {
            explanationChoiceData.push({ explanationId: createdExplanations[index].id, ...choice });
          }
        });

        if (explanationChoiceData.length > 0) {
          await transaction.questionExplanationChoice.createMany({ data: explanationChoiceData });
        }
        events.push(
          `CREATE ${createdExplanations.length} pembahasan (${explanationChoiceData.length} alasan pilihan)`,
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
