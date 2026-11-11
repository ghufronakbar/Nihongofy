"use server";

import { notFound, redirect } from "next/navigation";
import { updateTag } from "next/cache";
import { Prisma, type AttemptStatus, type JlptSection } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { withoutFurigana, withoutQuestionFurigana } from "@/lib/japanese-markup";
import { CACHE_TAGS } from "@/constants/cache-key";
import { readGuestExamCookie } from "./guest-cookie";
import {
  SaveExamAnswersSchema,
  SubmitExamSessionSchema,
  type SaveExamAnswersInput,
  type SubmitExamSessionInput,
} from "./schemas";

type AttemptProgress = {
  status: AttemptStatus;
  sectionScope: JlptSection | null;
  currentSession: number;
};

// Latihan per seksi selalu satu sesi virtual (1), berapa pun nomor sesi asli
// soalnya. Full mock dikerjakan berurutan: hanya `currentSession` yang terbuka,
// sesi sebelumnya sudah dinilai dan sesi berikutnya belum gilirannya.
function activeSessionOf(attempt: AttemptProgress) {
  return attempt.sectionScope ? 1 : attempt.currentSession;
}

/** Tempat user seharusnya berada untuk attempt ini sekarang. */
function attemptLocation(attemptId: number, attempt: AttemptProgress) {
  if (attempt.status === "COMPLETED") return `/result/${attemptId}`;
  if (attempt.status === "ABANDONED") return "/history";
  return `/exam/${attemptId}/${activeSessionOf(attempt)}`;
}

function sessionItemWhere(
  attempt: { testPackageId: number; sectionScope: JlptSection | null },
  session: number,
) {
  return attempt.sectionScope
    ? { testPackageId: attempt.testPackageId, section: attempt.sectionScope }
    : { testPackageId: attempt.testPackageId, session };
}

// `update` bersyarat yang tidak menemukan baris melempar P2025 dan membatalkan
// seluruh batch `$transaction`.
function isRecordNotFound(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

/**
 * Update bersyarat pada baris Attempt, dijalankan sebagai langkah pertama
 * transaksi simpan otomatis dan submit. Selain memastikan sesi masih berjalan,
 * update ini mengunci baris Attempt sampai transaksi selesai, sehingga simpan
 * otomatis yang datang bersamaan dengan submit berjalan berurutan: yang datang
 * setelah submit gagal P2025, bukan menimpa jawaban yang sudah dinilai.
 */
function claimActiveSession(
  attemptId: number,
  attempt: AttemptProgress,
  data: Prisma.AttemptUpdateInput,
) {
  return prisma.attempt.update({
    where: { id: attemptId, status: "IN_PROGRESS", currentSession: attempt.currentSession },
    data,
    select: { id: true },
  });
}

// Mode kerja tanpa furigana: furigana hanya tampil saat review atau mode baca.
// Dibuang di server karena props Client Component terkirim utuh di RSC payload,
// dan pada 漢字読み cara baca di dalam underline adalah jawabannya.
function withoutFuriganaItems<
  T extends {
    instruction: string | null;
    questions: Parameters<typeof withoutQuestionFurigana>[0][];
  },
>(items: T[]): T[] {
  return items.map((item) => ({
    ...item,
    instruction: item.instruction && withoutFurigana(item.instruction),
    questions: item.questions.map(withoutQuestionFurigana),
  }));
}

// Exam-mode data-leak guard (docs/database.md): questionAnswer & explanation
// must never be selected here — only exposed post-submit via the result feature.
export async function getExamQuestions(attemptId: number, urlSession: number) {
  const authSession = await getSession();

  if (attemptId === 0 || !authSession) {
    const guestData = await readGuestExamCookie();
    if (!guestData) notFound();

    const testPackage = await prisma.testPackage.findUnique({
      where: { id: guestData.testPackageId },
      select: { id: true, name: true, jlptLevel: true },
    });
    if (!testPackage) notFound();

    const attempt = {
      id: 0,
      userId: 0,
      testPackageId: guestData.testPackageId,
      sectionScope: guestData.sectionScope,
      status: "IN_PROGRESS" as const,
      testPackage,
    };

    const testPackageItems = await prisma.testPackageItem.findMany({
      where: attempt.sectionScope
        ? { testPackageId: attempt.testPackageId, section: attempt.sectionScope }
        : { testPackageId: attempt.testPackageId, session: urlSession },
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
            questionContext: {
              select: { id: true, storyText: true, storyImage: true, storyAudio: true },
            },
            questionChoices: {
              orderBy: { codeAnswer: "asc" },
              select: { id: true, codeAnswer: true, answerText: true, answerImage: true },
            },
          },
        },
      },
    });

    // Guest tidak punya lembar jawaban di server; seluruhnya di sessionStorage.
    return { attempt, testPackageItems: withoutFuriganaItems(testPackageItems), savedAnswers: null };
  }

  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    select: {
      id: true,
      userId: true,
      testPackageId: true,
      sectionScope: true,
      status: true,
      currentSession: true,
      testPackage: { select: { id: true, name: true, jlptLevel: true } },
    },
  });

  if (!attempt || attempt.userId !== authSession.userId) notFound();
  if (attempt.status === "COMPLETED") redirect(`/result/${attemptId}`);

  // Sesi yang sudah disubmit (mis. dari device lain) atau belum gilirannya
  // dialihkan ke sesi yang sedang berjalan.
  const activeSession = activeSessionOf(attempt);
  if (urlSession !== activeSession) redirect(`/exam/${attemptId}/${activeSession}`);

  const itemWhere = sessionItemWhere(attempt, urlSession);

  const testPackageItemsQuery = prisma.testPackageItem.findMany({
    where: itemWhere,
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
          questionContext: {
            select: { id: true, storyText: true, storyImage: true, storyAudio: true },
          },
          questionChoices: {
            orderBy: { codeAnswer: "asc" },
            select: { id: true, codeAnswer: true, answerText: true, answerImage: true },
          },
        },
      },
    },
  });

  // Lembar jawaban yang sudah tersimpan otomatis, dari device mana pun.
  // `isCorrect` sengaja tidak dipilih: untuk sesi berjalan nilainya belum dihitung.
  const savedAnswersQuery = prisma.attemptAnswer.findMany({
    where: { attemptId, question: { testPackageItem: itemWhere } },
    select: { questionId: true, selectedAnswer: true, flagged: true },
  });

  const [testPackageItems, savedAnswers] = await Promise.all([
    testPackageItemsQuery,
    savedAnswersQuery,
  ]);

  return { attempt, testPackageItems: withoutFuriganaItems(testPackageItems), savedAnswers };
}

export type SaveExamAnswersResult =
  | { status: "saved" }
  /** Sesi login berakhir; jawaban tetap di perangkat sampai user login lagi. */
  | { status: "unauthorized" }
  /** Sesi sudah disubmit (mis. dari device lain); client pindah ke `redirectTo`. */
  | { status: "closed"; redirectTo: string };

/**
 * Simpan otomatis jawaban yang berubah pada sesi yang sedang berjalan, supaya
 * ujian bisa dilanjutkan dari device lain sebelum sesi disubmit. Tidak menilai
 * apa pun: `isCorrect` baru dihitung saat submit, dan action ini tidak pernah
 * mengembalikan data soal. Sengaja tanpa revalidate/cookie agar halaman tidak
 * dirender ulang setiap kali menyimpan.
 */
export async function saveExamAnswersAction(
  input: SaveExamAnswersInput,
): Promise<SaveExamAnswersResult> {
  const validated = SaveExamAnswersSchema.safeParse(input);
  if (!validated.success) {
    throw new Error("Data tidak valid.");
  }

  const authSession = await getSession();
  if (!authSession) return { status: "unauthorized" };

  const { attemptId, session: urlSession, answers } = validated.data;

  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    select: {
      userId: true,
      testPackageId: true,
      sectionScope: true,
      status: true,
      currentSession: true,
    },
  });

  if (!attempt || attempt.userId !== authSession.userId) {
    throw new Error("Attempt tidak ditemukan.");
  }
  if (attempt.status !== "IN_PROGRESS" || urlSession !== activeSessionOf(attempt)) {
    return { status: "closed", redirectTo: attemptLocation(attemptId, attempt) };
  }

  // Hanya soal milik sesi ini; id lain diabaikan, sama seperti saat submit.
  const questions = await prisma.question.findMany({
    where: {
      id: { in: answers.map((answer) => answer.questionId) },
      testPackageItem: sessionItemWhere(attempt, urlSession),
    },
    select: { id: true },
  });
  const sessionQuestionIds = new Set(questions.map((question) => question.id));
  const latestByQuestion = new Map(
    answers
      .filter((answer) => sessionQuestionIds.has(answer.questionId))
      .map((answer) => [answer.questionId, answer]),
  );
  if (latestByQuestion.size === 0) return { status: "saved" };

  const saved = await prisma
    .$transaction([
      claimActiveSession(attemptId, attempt, { updatedAt: new Date() }),
      ...[...latestByQuestion.values()].map((answer) =>
        prisma.attemptAnswer.upsert({
          where: { attemptId_questionId: { attemptId, questionId: answer.questionId } },
          create: {
            attemptId,
            questionId: answer.questionId,
            selectedAnswer: answer.selectedAnswer,
            flagged: answer.flagged,
          },
          update: { selectedAnswer: answer.selectedAnswer, flagged: answer.flagged },
          select: { id: true },
        }),
      ),
    ])
    .then(
      () => true,
      (error: unknown) => {
        if (isRecordNotFound(error)) return false;
        throw error;
      },
    );

  if (!saved) {
    // Sesi baru saja disubmit dari tab/device lain di antara cek dan simpan.
    const latest = await prisma.attempt.findUnique({
      where: { id: attemptId },
      select: { status: true, sectionScope: true, currentSession: true },
    });
    return { status: "closed", redirectTo: latest ? attemptLocation(attemptId, latest) : "/history" };
  }

  return { status: "saved" };
}

export async function submitExamSessionAction(input: SubmitExamSessionInput) {
  const authSession = await getSession();
  const validated = SubmitExamSessionSchema.safeParse(input);
  if (!validated.success) {
    throw new Error("Data tidak valid.");
  }

  const { attemptId, session: urlSession, answers } = validated.data;

  if (attemptId === 0 || !authSession) {
    const guestData = await readGuestExamCookie();
    if (!guestData) notFound();

    const scopedWhere = guestData.sectionScope
      ? { testPackageId: guestData.testPackageId, section: guestData.sectionScope }
      : { testPackageId: guestData.testPackageId };

    const sessionRows = await prisma.testPackageItem.findMany({
      where: scopedWhere,
      select: { session: true },
      distinct: ["session"],
    });
    const sessionNumbers = sessionRows.map((row) => row.session).sort((a, b) => a - b);
    const isLastSession = guestData.sectionScope ? true : sessionNumbers.at(-1) === urlSession;

    // Jawaban guest tidak dipersist; penilaiannya dibentuk di `/result/guest`
    // dari sessionStorage lalu dinilai server (lihat getGuestAttemptSummary).
    if (isLastSession) {
      redirect("/result/guest");
    }

    const nextSession = sessionNumbers[sessionNumbers.indexOf(urlSession) + 1];
    redirect(`/exam/guest/${nextSession}`);
  }

  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    select: {
      id: true,
      userId: true,
      testPackageId: true,
      sectionScope: true,
      status: true,
      currentSession: true,
    },
  });

  if (!attempt || attempt.userId !== authSession.userId) notFound();
  if (attempt.status === "COMPLETED") redirect(`/result/${attemptId}`);

  // Tab lama yang mengirim sesi yang sudah lewat (mis. sudah disubmit dari
  // device lain) dialihkan ke sesi yang sedang berjalan, bukan menimpa nilai.
  if (urlSession !== activeSessionOf(attempt)) redirect(attemptLocation(attemptId, attempt));

  // Recompute the valid session list server-side rather than trusting the
  // client — also tells us which session comes next.
  const sessionRows = attempt.sectionScope
    ? []
    : await prisma.testPackageItem.findMany({
        where: { testPackageId: attempt.testPackageId },
        select: { session: true },
        distinct: ["session"],
      });
  const sessionNumbers = sessionRows.map((row) => row.session).sort((a, b) => a - b);

  if (!attempt.sectionScope && !sessionNumbers.includes(urlSession)) notFound();

  const testPackageItems = await prisma.testPackageItem.findMany({
    where: sessionItemWhere(attempt, urlSession),
    select: { questions: { select: { id: true, questionAnswer: true } } },
  });

  const answerKey = new Map<number, number>();
  for (const item of testPackageItems) {
    for (const question of item.questions) {
      answerKey.set(question.id, question.questionAnswer);
    }
  }

  // Seluruh soal sesi dinilai, bukan hanya yang ada di payload: soal yang tidak
  // dikirim dihitung kosong supaya tidak hilang dari penyebut hasil. Jawaban
  // untuk soal di luar sesi/scope ini diabaikan.
  const submitted = new Map(answers.map((answer) => [answer.questionId, answer]));
  const answerRows = [...answerKey].map(([questionId, correctAnswer]) => {
    const answer = submitted.get(questionId);
    const selectedAnswer = answer?.selectedAnswer ?? null;
    return {
      attemptId,
      questionId,
      selectedAnswer,
      isCorrect: selectedAnswer !== null && selectedAnswer === correctAnswer,
      flagged: answer?.flagged ?? false,
    };
  });

  const nextSession = attempt.sectionScope
    ? undefined
    : sessionNumbers[sessionNumbers.indexOf(urlSession) + 1];

  // Klaim sesi dan nilai jawabannya dalam satu transaksi. Bila sesi ini sudah
  // disubmit dari tab/device lain, klaim gagal dan tidak ada yang tertimpa.
  const claimed = await prisma
    .$transaction([
      claimActiveSession(
        attemptId,
        attempt,
        nextSession === undefined
          ? { status: "COMPLETED", finishedAt: new Date() }
          : { currentSession: nextSession },
      ),
      ...answerRows.map((row) =>
        prisma.attemptAnswer.upsert({
          where: { attemptId_questionId: { attemptId: row.attemptId, questionId: row.questionId } },
          create: row,
          update: {
            selectedAnswer: row.selectedAnswer,
            isCorrect: row.isCorrect,
            flagged: row.flagged,
          },
          select: { id: true },
        }),
      ),
    ])
    .then(
      () => true,
      (error: unknown) => {
        if (isRecordNotFound(error)) return false;
        throw error;
      },
    );

  if (!claimed) {
    const latest = await prisma.attempt.findUnique({
      where: { id: attemptId },
      select: { status: true, sectionScope: true, currentSession: true },
    });
    redirect(latest ? attemptLocation(attemptId, latest) : "/history");
  }

  if (nextSession === undefined) {
    updateTag(CACHE_TAGS.dashboardSummary(authSession.userId));
    updateTag(CACHE_TAGS.analytics(authSession.userId));
    updateTag(CACHE_TAGS.profileOverview(authSession.userId));
    redirect(`/result/${attemptId}`);
  }

  redirect(`/exam/${attemptId}/${nextSession}`);
}
