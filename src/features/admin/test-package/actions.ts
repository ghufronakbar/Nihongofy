"use server";

import { notFound } from "next/navigation";
import { updateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { recordAdminAction, recordAdminActionTx } from "../audit";
import { CACHE_TAGS } from "@/constants/cache-key";
// Kontrak fixture dan logika import dipakai bersama dengan CLI
// `npm run seed:test-package`. Tidak ditulis ulang di sini — lihat catatan di
// schemas.ts dan header prisma/import-test-package.mjs.
import { seedTestPackageSchema, formatZodIssue } from "../../../../prisma/test-package-contract.mjs";
import { importTestPackage } from "../../../../prisma/import-test-package.mjs";
import {
  ImportTestPackageSchema,
  DeleteTestPackageSchema,
  UpdateQuestionSchema,
  type ImportTestPackageInput,
  type DeleteTestPackageInput,
  type UpdateQuestionInput,
} from "./schemas";

export type ImportResult =
  | { ok: true; status: string; message: string; packageId?: number }
  | { ok: false; message: string; issues?: string[] };

function revalidateTestPackage(packageId?: number) {
  updateTag(CACHE_TAGS.testPackageList);
  updateTag(CACHE_TAGS.practiceCatalog);
  if (packageId !== undefined) {
    updateTag(CACHE_TAGS.testPackageDetail(packageId));
    updateTag(CACHE_TAGS.testPackageQuestions(packageId));
  }
}

export async function importTestPackageAction(
  input: ImportTestPackageInput,
): Promise<ImportResult> {
  const actor = await requireAdmin();

  const validated = ImportTestPackageSchema.safeParse(input);
  if (!validated.success) {
    return { ok: false, message: validated.error.issues[0]?.message ?? "Data tidak valid." };
  }

  const { fixtureJson, fileLabel, replaceExisting } = validated.data;

  let parsed: unknown;
  try {
    parsed = JSON.parse(fixtureJson);
  } catch (cause) {
    return {
      ok: false,
      message: `JSON tidak dapat dibaca: ${cause instanceof Error ? cause.message : "format salah"}`,
    };
  }

  // Kontrak yang sama persis dengan yang dipakai `npm run seed:test-package`.
  const fixture = seedTestPackageSchema.safeParse(parsed);
  if (!fixture.success) {
    return {
      ok: false,
      message: "Fixture tidak memenuhi kontrak bank soal.",
      issues: fixture.error.issues.slice(0, 20).map(formatZodIssue),
    };
  }

  const result = await importTestPackage(
    prisma,
    { file: fileLabel || "(tempelan)", pkg: fixture.data },
    replaceExisting,
  );

  if (result.status === "blocked") {
    return { ok: false, message: result.message };
  }

  if (result.status === "skipped") {
    return {
      ok: true,
      status: result.status,
      packageId: result.id,
      message: `Paket sudah ada dan isinya cocok dengan fixture. Tidak ada perubahan (id ${result.id}).`,
    };
  }

  // Import berjalan di transaksinya sendiri di dalam modul bersama dengan CLI,
  // jadi lognya ditulis setelahnya — bukan di dalam transaksi itu.
  await recordAdminAction({
    actor,
    action: "test-package.import",
    targetType: "test-package",
    targetId: result.id,
    summary:
      result.status === "replaced"
        ? `Mengganti paket id ${result.replacedId} dengan import baru (${result.questionsSeeded} soal) dari ${fileLabel || "tempelan"}.`
        : `Mengimpor paket baru (${result.questionsSeeded} soal) dari ${fileLabel || "tempelan"}.`,
  });

  revalidateTestPackage(result.id);
  if (result.replacedId && result.replacedId !== result.id) {
    revalidateTestPackage(result.replacedId);
  }

  return {
    ok: true,
    status: result.status,
    packageId: result.id,
    message:
      result.status === "replaced"
        ? `Paket lama id ${result.replacedId} diganti. Sekarang id ${result.id} dengan ${result.questionsSeeded} soal.`
        : `Paket dibuat dengan id ${result.id} dan ${result.questionsSeeded} soal.`,
  };
}

export type DeleteResult = { ok: true } | { ok: false; message: string };

export async function deleteTestPackageAction(
  input: DeleteTestPackageInput,
): Promise<DeleteResult> {
  const actor = await requireAdmin();

  const validated = DeleteTestPackageSchema.safeParse(input);
  if (!validated.success) {
    return { ok: false, message: "Data tidak valid." };
  }

  const { id, confirmName } = validated.data;
  const testPackage = await prisma.testPackage.findUnique({
    where: { id },
    select: { id: true, name: true, _count: { select: { attempts: true } } },
  });
  if (!testPackage) notFound();

  if (confirmName !== testPackage.name) {
    return { ok: false, message: "Nama paket tidak cocok. Penghapusan dibatalkan." };
  }

  // Aturan yang sama dengan `npm run test-package:delete`: paket yang sudah
  // dikerjakan user tidak boleh hilang begitu saja bersama attempt-nya.
  if (testPackage._count.attempts > 0) {
    return {
      ok: false,
      message: `Paket ini punya ${testPackage._count.attempts} attempt. Menghapusnya ikut menghapus hasil pengerjaan user, jadi ditolak di sini.`,
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.testPackage.delete({ where: { id } });
    await recordAdminActionTx(tx, {
      actor,
      action: "test-package.delete",
      targetType: "test-package",
      targetId: id,
      summary: `Menghapus permanen paket "${testPackage.name}" beserta seluruh soal dan turunannya.`,
    });
  });
  revalidateTestPackage(id);
  return { ok: true };
}

export type UpdateQuestionResult = { ok: true } | { ok: false; message: string };

export async function updateQuestionAction(
  input: UpdateQuestionInput,
): Promise<UpdateQuestionResult> {
  const actor = await requireAdmin();

  const validated = UpdateQuestionSchema.safeParse(input);
  if (!validated.success) {
    return { ok: false, message: validated.error.issues[0]?.message ?? "Data tidak valid." };
  }

  const data = validated.data;
  const current = await prisma.question.findUnique({
    where: { id: data.id },
    select: {
      id: true,
      testPackageItem: { select: { id: true, testPackageId: true } },
      questionChoices: { select: { id: true } },
    },
  });
  if (!current) notFound();

  // Pilihan diperbarui berdasarkan id yang sudah ada, bukan dihapus lalu dibuat
  // ulang: AttemptAnswer dan PracticeAnswer menyimpan codeAnswer, dan membuat
  // ulang baris pilihan akan mengubah id yang dirujuk UI tanpa alasan.
  const ownedChoiceIds = new Set(current.questionChoices.map((choice) => choice.id));
  for (const choice of data.choices) {
    if (!ownedChoiceIds.has(choice.id)) {
      return { ok: false, message: "Pilihan jawaban tidak cocok dengan soal ini." };
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.question.update({
      where: { id: data.id },
      data: {
        questionText: data.questionText,
        questionImage: data.questionImage,
        questionAudio: data.questionAudio,
        questionAnswer: data.questionAnswer,
      },
    });

    for (const choice of data.choices) {
      await tx.questionChoice.update({
        where: { id: choice.id },
        data: { answerText: choice.answerText, answerImage: choice.answerImage },
      });
    }

    await tx.testPackageItem.update({
      where: { id: current.testPackageItem.id },
      data: { instruction: data.instruction },
    });

    await recordAdminActionTx(tx, {
      actor,
      action: "question.update",
      targetType: "question",
      targetId: data.id,
      summary: `Menyunting soal (kunci jawaban ${data.questionAnswer}) pada paket id ${current.testPackageItem.testPackageId}.`,
    });
  });

  revalidateTestPackage(current.testPackageItem.testPackageId);
  return { ok: true };
}
