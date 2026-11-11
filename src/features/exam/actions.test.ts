import { Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Simpan otomatis dan submit sesi exam diuji dengan Prisma tiruan; tidak ada
// koneksi database. `$transaction` menerima array query yang sudah dibangun,
// jadi test membaca argumen tiap delegate dan mensimulasikan hasil transaksi.

const mocks = vi.hoisted(() => ({
  attempt: { findUnique: vi.fn(), update: vi.fn() },
  attemptAnswer: { findMany: vi.fn(), upsert: vi.fn() },
  testPackageItem: { findMany: vi.fn() },
  question: { findMany: vi.fn() },
  transaction: vi.fn(),
  getSession: vi.fn(),
  updateTag: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    attempt: mocks.attempt,
    attemptAnswer: mocks.attemptAnswer,
    testPackageItem: mocks.testPackageItem,
    question: mocks.question,
    $transaction: mocks.transaction,
  },
}));
vi.mock("@/lib/auth", () => ({ getSession: mocks.getSession }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  },
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));
vi.mock("next/cache", () => ({ updateTag: mocks.updateTag }));

import { getExamQuestions, saveExamAnswersAction, submitExamSessionAction } from "./actions";

const USER_ID = 5;

function attemptRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    userId: USER_ID,
    testPackageId: 1,
    sectionScope: null,
    status: "IN_PROGRESS",
    currentSession: 1,
    testPackage: { id: 1, name: "Paket", jlptLevel: "N3" },
    ...overrides,
  };
}

function sessionClosedError() {
  return new Prisma.PrismaClientKnownRequestError("No record was found for an update.", {
    code: "P2025",
    clientVersion: "test",
  });
}

beforeEach(() => {
  mocks.getSession.mockResolvedValue({ userId: USER_ID, sessionId: "sesi" });
  mocks.attempt.update.mockImplementation((args: unknown) => ({ op: "claim", args }));
  mocks.attemptAnswer.upsert.mockImplementation((args: unknown) => ({ op: "upsert", args }));
  mocks.transaction.mockResolvedValue([]);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("getExamQuestions", () => {
  it("sesi yang sudah disubmit dialihkan ke sesi yang sedang berjalan", async () => {
    mocks.attempt.findUnique.mockResolvedValue(attemptRow({ currentSession: 2 }));

    await expect(getExamQuestions(10, 1)).rejects.toThrow("NEXT_REDIRECT /exam/10/2");
    expect(mocks.testPackageItem.findMany).not.toHaveBeenCalled();
  });

  it("sesi yang belum gilirannya juga dialihkan", async () => {
    mocks.attempt.findUnique.mockResolvedValue(attemptRow({ currentSession: 1 }));

    await expect(getExamQuestions(10, 3)).rejects.toThrow("NEXT_REDIRECT /exam/10/1");
  });

  it("memuat lembar jawaban tersimpan untuk sesi yang sedang berjalan", async () => {
    mocks.attempt.findUnique.mockResolvedValue(attemptRow({ currentSession: 2 }));
    mocks.testPackageItem.findMany.mockResolvedValue([]);
    mocks.attemptAnswer.findMany.mockResolvedValue([
      { questionId: 201, selectedAnswer: 3, flagged: true },
    ]);

    const { savedAnswers } = await getExamQuestions(10, 2);

    expect(savedAnswers).toEqual([{ questionId: 201, selectedAnswer: 3, flagged: true }]);
    expect(mocks.attemptAnswer.findMany.mock.calls[0]![0]).toMatchObject({
      where: { attemptId: 10, question: { testPackageItem: { testPackageId: 1, session: 2 } } },
    });
  });
});

describe("saveExamAnswersAction", () => {
  const input = {
    attemptId: 10,
    session: 1,
    answers: [
      { questionId: 100, selectedAnswer: 2, flagged: false },
      { questionId: 999, selectedAnswer: 1, flagged: false },
      { questionId: 100, selectedAnswer: 4, flagged: true },
    ],
  };

  it("menyimpan hanya soal milik sesi, perubahan terakhir per soal, tanpa menilai", async () => {
    mocks.attempt.findUnique.mockResolvedValue(attemptRow());
    mocks.question.findMany.mockResolvedValue([{ id: 100 }]);

    await expect(saveExamAnswersAction(input)).resolves.toEqual({ status: "saved" });

    const [batch] = mocks.transaction.mock.calls[0]!;
    expect(batch).toHaveLength(2);
    // Klaim sesi lebih dulu supaya simpanan berurutan dengan submit.
    expect(batch[0]).toMatchObject({
      op: "claim",
      args: { where: { id: 10, status: "IN_PROGRESS", currentSession: 1 } },
    });
    expect(batch[1]).toEqual({
      op: "upsert",
      args: {
        where: { attemptId_questionId: { attemptId: 10, questionId: 100 } },
        create: { attemptId: 10, questionId: 100, selectedAnswer: 4, flagged: true },
        update: { selectedAnswer: 4, flagged: true },
        select: { id: true },
      },
    });
  });

  it("sesi yang sudah disubmit ditolak tanpa menulis apa pun", async () => {
    mocks.attempt.findUnique.mockResolvedValue(attemptRow({ currentSession: 2 }));

    await expect(saveExamAnswersAction(input)).resolves.toEqual({
      status: "closed",
      redirectTo: "/exam/10/2",
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("attempt yang sudah selesai diarahkan ke hasil", async () => {
    mocks.attempt.findUnique.mockResolvedValue(attemptRow({ status: "COMPLETED" }));

    await expect(saveExamAnswersAction(input)).resolves.toEqual({
      status: "closed",
      redirectTo: "/result/10",
    });
  });

  it("submit dari device lain di antara cek dan simpan membatalkan simpanan", async () => {
    mocks.attempt.findUnique
      .mockResolvedValueOnce(attemptRow())
      .mockResolvedValueOnce({ status: "IN_PROGRESS", sectionScope: null, currentSession: 2 });
    mocks.question.findMany.mockResolvedValue([{ id: 100 }]);
    mocks.transaction.mockRejectedValue(sessionClosedError());

    await expect(saveExamAnswersAction(input)).resolves.toEqual({
      status: "closed",
      redirectTo: "/exam/10/2",
    });
  });

  it("error database lain tetap dilempar agar client mencoba ulang", async () => {
    mocks.attempt.findUnique.mockResolvedValue(attemptRow());
    mocks.question.findMany.mockResolvedValue([{ id: 100 }]);
    mocks.transaction.mockRejectedValue(new Error("koneksi putus"));

    await expect(saveExamAnswersAction(input)).rejects.toThrow("koneksi putus");
  });

  it("tanpa login tidak menyentuh database", async () => {
    mocks.getSession.mockResolvedValue(null);

    await expect(saveExamAnswersAction(input)).resolves.toEqual({ status: "unauthorized" });
    expect(mocks.attempt.findUnique).not.toHaveBeenCalled();
  });

  it("attempt milik user lain ditolak", async () => {
    mocks.attempt.findUnique.mockResolvedValue(attemptRow({ userId: 99 }));

    await expect(saveExamAnswersAction(input)).rejects.toThrow("Attempt tidak ditemukan.");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});

describe("submitExamSessionAction", () => {
  function mockPackage() {
    mocks.testPackageItem.findMany.mockImplementation(async (args: { distinct?: unknown }) =>
      args.distinct
        ? [{ session: 2 }, { session: 1 }]
        : [{ questions: [{ id: 100, questionAnswer: 2 }, { id: 101, questionAnswer: 3 }] }],
    );
  }

  it("menilai seluruh soal sesi, soal yang tidak dikirim dihitung kosong", async () => {
    mocks.attempt.findUnique.mockResolvedValue(attemptRow());
    mockPackage();

    await expect(
      submitExamSessionAction({
        attemptId: 10,
        session: 1,
        answers: [
          { questionId: 100, selectedAnswer: 2, flagged: true },
          { questionId: 555, selectedAnswer: 1, flagged: false },
        ],
      }),
    ).rejects.toThrow("NEXT_REDIRECT /exam/10/2");

    const [batch] = mocks.transaction.mock.calls[0]!;
    expect(batch[0]).toMatchObject({
      op: "claim",
      args: { where: { id: 10, status: "IN_PROGRESS", currentSession: 1 }, data: { currentSession: 2 } },
    });
    expect(batch.slice(1).map((query: { args: { create: unknown } }) => query.args.create)).toEqual([
      { attemptId: 10, questionId: 100, selectedAnswer: 2, isCorrect: true, flagged: true },
      { attemptId: 10, questionId: 101, selectedAnswer: null, isCorrect: false, flagged: false },
    ]);
    expect(mocks.updateTag).not.toHaveBeenCalled();
  });

  it("sesi terakhir menyelesaikan attempt", async () => {
    mocks.attempt.findUnique.mockResolvedValue(attemptRow({ currentSession: 2 }));
    mockPackage();

    await expect(
      submitExamSessionAction({ attemptId: 10, session: 2, answers: [] }),
    ).rejects.toThrow("NEXT_REDIRECT /result/10");

    const [batch] = mocks.transaction.mock.calls[0]!;
    expect(batch[0].args.where).toEqual({ id: 10, status: "IN_PROGRESS", currentSession: 2 });
    expect(batch[0].args.data).toMatchObject({ status: "COMPLETED" });
    expect(mocks.updateTag).toHaveBeenCalled();
  });

  it("tab lama yang mengirim sesi yang sudah lewat dialihkan tanpa menulis", async () => {
    mocks.attempt.findUnique.mockResolvedValue(attemptRow({ currentSession: 2 }));

    await expect(
      submitExamSessionAction({ attemptId: 10, session: 1, answers: [] }),
    ).rejects.toThrow("NEXT_REDIRECT /exam/10/2");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("submit ganda: yang kalah klaim dialihkan ke posisi terbaru", async () => {
    mocks.attempt.findUnique
      .mockResolvedValueOnce(attemptRow())
      .mockResolvedValueOnce({ status: "IN_PROGRESS", sectionScope: null, currentSession: 2 });
    mockPackage();
    mocks.transaction.mockRejectedValue(sessionClosedError());

    await expect(
      submitExamSessionAction({ attemptId: 10, session: 1, answers: [] }),
    ).rejects.toThrow("NEXT_REDIRECT /exam/10/2");
    expect(mocks.updateTag).not.toHaveBeenCalled();
  });

  it("latihan per seksi selalu sesi 1 dan langsung selesai", async () => {
    mocks.attempt.findUnique.mockResolvedValue(attemptRow({ sectionScope: "CHOUKAI" }));
    mocks.testPackageItem.findMany.mockResolvedValue([
      { questions: [{ id: 300, questionAnswer: 1 }] },
    ]);

    await expect(
      submitExamSessionAction({
        attemptId: 10,
        session: 1,
        answers: [{ questionId: 300, selectedAnswer: 1, flagged: false }],
      }),
    ).rejects.toThrow("NEXT_REDIRECT /result/10");

    const [batch] = mocks.transaction.mock.calls[0]!;
    expect(batch[0].args.data).toMatchObject({ status: "COMPLETED" });
    expect(mocks.testPackageItem.findMany).toHaveBeenCalledOnce();
  });
});
