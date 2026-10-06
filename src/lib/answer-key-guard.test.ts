import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

// Penjaga aturan data-leak (docs/database.md "Aturan Query"): kunci jawaban,
// pembahasan, dan turunannya tidak boleh sampai ke browser sebelum waktunya.
//
// Tiga lapis:
// 1. Runtime — action exam, latihan, dan result dipanggil dengan Prisma tiruan.
//    Argumen query yang BENAR-BENAR dikirim ditelusuri lewat DMMF schema, jadi
//    select baru yang ditulis langsung di action pun ikut terperiksa, bukan hanya
//    konstanta. Tidak ada koneksi database sama sekali.
// 2. Statis — pola terlarang di seluruh src/ (include pembahasan, query tanpa
//    select pada model ber-kunci, cache ber-kunci yang dipakai ulang jalur exam,
//    permukaan diskusi di runner).
// 3. Bentuk `QUESTION_EXPLANATION_SELECT` dikunci supaya tidak dilonggarkan
//    demi admin.

const mocks = vi.hoisted(() => {
  const delegate = () => ({
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  });
  return {
    delegates: {
      attempt: delegate(),
      testPackage: delegate(),
      testPackageItem: delegate(),
      question: delegate(),
      practiceSession: delegate(),
      practiceAnswer: delegate(),
    },
    transaction: vi.fn(),
    getSession: vi.fn(),
    cookies: new Map<string, string>(),
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: { ...mocks.delegates, $transaction: mocks.transaction },
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
  cookies: async () => ({
    get: (name: string) => {
      const value = mocks.cookies.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set: vi.fn(),
    delete: vi.fn(),
  }),
}));
vi.mock("next/cache", () => ({
  unstable_cache: (fn: unknown) => fn,
  updateTag: vi.fn(),
}));
vi.mock("@/constants", () => ({ FEATURES: { questionDiscussion: false } }));
vi.mock("@/features/question-comment/queries", () => ({
  getQuestionDiscussionCounts: vi.fn(async () => new Map()),
}));
vi.mock("@/features/result/lib/guest-attempt-stash", () => ({
  createGuestAttemptStash: vi.fn(),
  consumeGuestAttemptStash: vi.fn(),
}));

import { getExamQuestions } from "@/features/exam/actions";
import { getPracticeSession, submitPracticeAnswerAction } from "@/features/practice/actions";
import {
  getAttemptDetail,
  getAttemptSummary,
  getGuestAttemptSummary,
} from "@/features/result/actions";
import { QUESTION_BUNPOU_LINKS_SELECT } from "@/lib/question-bunpou-links";
import { QUESTION_EXPLANATION_SELECT } from "@/lib/question-explanation";

// ============================================================
// PENELUSUR SELECT BERBASIS SCHEMA
// ============================================================

const MODELS = new Map(Prisma.dmmf.datamodel.models.map((model) => [model.name, model]));

// Kolom dan relasi yang membuka kunci jawaban atau turunannya, atau berisi tulisan
// yang dapat menyebut jawabannya (catatan/diskusi, laporan, jawaban user lain).
const FORBIDDEN_FIELDS: Record<string, readonly string[]> = {
  Question: [
    "questionAnswer",
    "explanation",
    "bunpouLinks",
    "questionComments",
    "attemptAnswers",
    "practiceAnswers",
    "reports",
  ],
  AttemptAnswer: ["isCorrect"],
};
// Model yang seluruh isinya pembahasan, dari jalur mana pun ia dicapai. Tautan
// soal -> pola bunpou menyebut pola yang diuji, jadi termasuk di sini.
const FORBIDDEN_MODELS = new Set(["QuestionExplanation", "QuestionExplanationChoice", "QuestionBunpouLink"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Jalur kolom terlarang yang ikut terbaca oleh argumen query Prisma pada `modelName`. */
function answerKeyPaths(modelName: string, args: unknown, path: string = modelName): string[] {
  const model = MODELS.get(modelName);
  if (!model) throw new Error(`model tidak dikenal: ${modelName}`);
  if (FORBIDDEN_MODELS.has(modelName)) return [path];

  const forbidden = FORBIDDEN_FIELDS[modelName] ?? [];
  const query = isRecord(args) ? args : {};
  const select = isRecord(query.select) ? query.select : null;
  const found: string[] = [];

  // Tanpa `select` (termasuk bila memakai `include`), Prisma mengembalikan
  // seluruh kolom skalar model itu.
  if (!select) {
    for (const field of model.fields) {
      if (field.kind !== "object" && forbidden.includes(field.name)) {
        found.push(`${path}.${field.name}`);
      }
    }
  }

  const selection = select ?? (isRecord(query.include) ? query.include : {});
  for (const [name, value] of Object.entries(selection)) {
    if (value === false || value === undefined || name === "_count") continue;
    const field = model.fields.find((candidate) => candidate.name === name);
    if (!field) throw new Error(`${path}.${name} tidak ada di schema`);

    if (forbidden.includes(name) || FORBIDDEN_MODELS.has(field.type)) {
      found.push(`${path}.${name}`);
    } else if (field.kind === "object") {
      // `relasi: true` berarti seluruh kolom skalar model relasinya.
      found.push(...answerKeyPaths(field.type, value === true ? {} : value, `${path}.${name}`));
    }
  }

  return found;
}

describe("penelusur select", () => {
  it("menangkap kunci jawaban yang dipilih langsung, tanpa select, atau lewat include", () => {
    expect(answerKeyPaths("Question", { select: { id: true, questionAnswer: true } })).toEqual([
      "Question.questionAnswer",
    ]);
    expect(answerKeyPaths("Question", { where: { id: 1 } })).toEqual(["Question.questionAnswer"]);
    expect(answerKeyPaths("Question", { include: { questionChoices: true } })).toEqual([
      "Question.questionAnswer",
    ]);
  });

  it("menangkap relasi pembahasan dan relasi `true` di kedalaman mana pun", () => {
    expect(answerKeyPaths("TestPackageItem", { select: { questions: true } })).toEqual([
      "TestPackageItem.questions.questionAnswer",
    ]);
    expect(
      answerKeyPaths("TestPackageItem", {
        select: { questions: { select: { explanation: { select: { summary: true } } } } },
      }),
    ).toEqual(["TestPackageItem.questions.explanation"]);
    expect(
      answerKeyPaths("Question", {
        select: { testPackageItem: { select: { questions: { select: { questionAnswer: true } } } } },
      }),
    ).toEqual(["Question.testPackageItem.questions.questionAnswer"]);
  });

  it("select soal yang aman lolos", () => {
    expect(
      answerKeyPaths("Question", {
        select: {
          id: true,
          questionText: true,
          questionChoices: { select: { codeAnswer: true, answerText: true } },
          questionContext: true,
          _count: { select: { questionComments: true } },
        },
      }),
    ).toEqual([]);
  });
});

// ============================================================
// RUNTIME: EXAM, LATIHAN, DAN RESULT DENGAN PRISMA TIRUAN
// ============================================================

type CapturedQuery = { model: string; method: string; args: unknown };

/** Semua query baca yang dikirim action ke Prisma tiruan, beserta argumennya. */
function capturedReads(): CapturedQuery[] {
  const delegates: Record<string, Record<string, Mock>> = mocks.delegates;
  const reads: CapturedQuery[] = [];
  for (const [delegate, methods] of Object.entries(delegates)) {
    const model = delegate[0]!.toUpperCase() + delegate.slice(1);
    for (const [method, fn] of Object.entries(methods)) {
      if (!method.startsWith("find")) continue;
      for (const call of fn.mock.calls) reads.push({ model, method, args: call[0] });
    }
  }
  return reads;
}

function expectNoAnswerKeyReads() {
  const reads = capturedReads();
  expect(reads.length).toBeGreaterThan(0);
  for (const read of reads) {
    expect(answerKeyPaths(read.model, read.args), `${read.model}.${read.method}`).toEqual([]);
  }
}

/** Seluruh nama properti di dalam nilai, untuk memastikan field tertentu tidak ikut. */
function keysDeep(value: unknown): Set<string> {
  const keys = new Set<string>();
  const visit = (node: unknown) => {
    if (Array.isArray(node)) {
      node.forEach(visit);
    } else if (isRecord(node)) {
      for (const [key, child] of Object.entries(node)) {
        keys.add(key);
        visit(child);
      }
    }
  };
  visit(value);
  return keys;
}

function hasFurigana(text: string) {
  return /\{[^|}]+\|[^}]+\}/.test(text);
}

// Contoh 漢字読み: cara baca di dalam underline sama dengan teks pilihan yang benar.
const READ_KANJI_TEXT = "社会活動に参加することで、__{人脈|じんみゃく}__を広げた。";
const CONTEXT_TEXT = "{私|わたし}は__{読|よ}める__";

function questionRow(id: number, questionText: string) {
  return {
    id,
    order: id,
    questionText,
    questionImage: null,
    questionAudio: null,
    questionContext: null,
    questionChoices: [1, 2, 3, 4].map((codeAnswer) => ({
      id: id * 10 + codeAnswer,
      codeAnswer,
      answerText: `pilihan ${codeAnswer}`,
      answerImage: null,
    })),
  };
}

const EXPLANATION = {
  summary: "Ringkasan",
  detail: null,
  translation: null,
  keyPoints: [],
  answerKeyDoubt: false,
  choices: [{ codeAnswer: 2, isCorrect: true, reason: "Benar" }],
};

beforeEach(() => {
  mocks.cookies.clear();
  mocks.getSession.mockResolvedValue({ userId: 5, sessionId: "sesi" });
  mocks.transaction.mockImplementation(async (fn: (tx: typeof mocks.delegates) => unknown) =>
    fn(mocks.delegates),
  );
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("exam runner", () => {
  function mockExamItems() {
    mocks.delegates.testPackageItem.findMany.mockImplementation(async (args: unknown) =>
      isRecord(args) && "distinct" in args
        ? [{ session: 1 }, { session: 2 }]
        : [
            {
              id: 1,
              mondaiType: "MOJI_GOI_READ_KANJI",
              section: "MOJI_GOI",
              session: 1,
              order: 1,
              instruction: null,
              questions: [questionRow(100, READ_KANJI_TEXT)],
            },
            {
              id: 2,
              mondaiType: "DOKKAI_SHORT_TEXT",
              section: "DOKKAI",
              session: 1,
              order: 2,
              instruction: "{正|ただ}しいものを{選|えら}んでください。",
              questions: [
                {
                  ...questionRow(101, CONTEXT_TEXT),
                  questionContext: {
                    id: 7,
                    storyText: "{机|つくえ}の{上|うえ}に{切符|きっぷ}がある。",
                    storyImage: null,
                    storyAudio: null,
                  },
                  questionChoices: [1, 2, 3, 4].map((codeAnswer) => ({
                    id: 1010 + codeAnswer,
                    codeAnswer,
                    answerText: `{田中|たなか}{先生|せんせい} ${codeAnswer}`,
                    answerImage: null,
                  })),
                },
              ],
            },
          ],
    );
  }

  const inProgress = {
    id: 10,
    userId: 5,
    testPackageId: 1,
    sectionScope: null,
    status: "IN_PROGRESS",
    testPackage: { id: 1, name: "Paket", jlptLevel: "N2" },
  };

  it("user login: tidak ada query yang membaca kunci, pembahasan, atau catatan", async () => {
    mocks.delegates.attempt.findUnique.mockResolvedValue(inProgress);
    mockExamItems();

    await getExamQuestions(10, 1);

    expectNoAnswerKeyReads();
  });

  it("guest: jalur cookie juga tidak membaca kunci", async () => {
    mocks.getSession.mockResolvedValue(null);
    mocks.cookies.set(
      "jlpt_guest_exam",
      JSON.stringify({ testPackageId: 1, sectionScope: null, startedAt: "2026-10-03T00:00:00.000Z" }),
    );
    mocks.delegates.testPackage.findUnique.mockResolvedValue(inProgress.testPackage);
    mockExamItems();

    await getExamQuestions(0, 1);

    expectNoAnswerKeyReads();
    expect(mocks.delegates.attempt.findUnique).not.toHaveBeenCalled();
  });

  it("semua furigana dibuang sebelum dikirim, termasuk cara baca 漢字読み", async () => {
    mocks.delegates.attempt.findUnique.mockResolvedValue(inProgress);
    mockExamItems();

    const { testPackageItems } = await getExamQuestions(10, 1);
    const [readKanji, context] = testPackageItems.flatMap((item) => item.questions);

    expect(readKanji!.questionText).toBe("社会活動に参加することで、__人脈__を広げた。");
    expect(context!.questionText).toBe("私は__読める__");
    expect(context!.questionContext?.storyText).toBe("机の上に切符がある。");
    expect(context!.questionChoices[0]!.answerText).toBe("田中先生 1");
    expect(testPackageItems[1]!.instruction).toBe("正しいものを選んでください。");
    expect(JSON.stringify(testPackageItems)).not.toMatch(/\{[^|}]+\|[^}]+\}/);
  });
});

describe("latihan cepat", () => {
  function practiceQuestion(id: number, questionText: string) {
    return {
      ...questionRow(id, questionText),
      testPackageItem: { instruction: null, mondaiType: "MOJI_GOI_READ_KANJI" },
    };
  }

  it("payload sesi hanya memuat kunci untuk soal yang sudah dijawab", async () => {
    mocks.delegates.practiceSession.findUnique.mockResolvedValue({
      id: 3,
      userId: 5,
      jlptLevel: "N2",
      section: "MOJI_GOI",
      mondaiType: "MOJI_GOI_READ_KANJI",
      questionCount: 2,
      status: "IN_PROGRESS",
      startedAt: new Date("2026-10-03T00:00:00Z"),
      finishedAt: null,
      answers: [
        {
          questionId: 100,
          order: 1,
          selectedAnswer: 2,
          isCorrect: true,
          answeredAt: new Date("2026-10-03T00:01:00Z"),
          question: practiceQuestion(100, READ_KANJI_TEXT),
        },
        {
          questionId: 101,
          order: 2,
          selectedAnswer: null,
          isCorrect: null,
          answeredAt: null,
          question: practiceQuestion(101, READ_KANJI_TEXT),
        },
      ],
    });
    // Query kunci hanya mengembalikan soal yang diminta, seperti database.
    mocks.delegates.question.findMany.mockImplementation(async (args: unknown) => {
      const where = isRecord(args) && isRecord(args.where) ? args.where : {};
      const ids = isRecord(where.id) && Array.isArray(where.id.in) ? where.id.in : [];
      return ids.map((id: unknown) => ({ id, questionAnswer: 2, explanation: EXPLANATION }));
    });

    const session = await getPracticeSession({ sessionId: 3 });

    const reads = capturedReads();
    const keyed = reads.filter((read) => answerKeyPaths(read.model, read.args).length > 0);
    // Satu-satunya query ber-kunci adalah untuk soal yang sudah dijawab.
    expect(keyed).toHaveLength(1);
    expect(keyed[0]!.args).toMatchObject({ where: { id: { in: [100] } } });

    const [answered, unanswered] = session.questions;
    expect(answered!.feedback).toMatchObject({ correctAnswer: 2 });
    expect(unanswered!.feedback).toBeNull();
    expect(keysDeep(unanswered)).not.toContain("questionAnswer");
    for (const question of session.questions) {
      expect(hasFurigana(question.questionText)).toBe(false);
    }
  });

  it("guest: payload sesi tidak membaca kunci sama sekali", async () => {
    mocks.getSession.mockResolvedValue(null);
    mocks.cookies.set(
      "jlpt_guest_practice",
      JSON.stringify({
        jlptLevel: "N2",
        section: "MOJI_GOI",
        mondaiType: "MOJI_GOI_READ_KANJI",
        questionIds: [100, 101],
      }),
    );
    mocks.delegates.question.findMany.mockResolvedValue([
      practiceQuestion(100, READ_KANJI_TEXT),
      practiceQuestion(101, READ_KANJI_TEXT),
    ]);

    const session = await getPracticeSession({ sessionId: 0 });

    expectNoAnswerKeyReads();
    for (const question of session.questions) {
      expect(question.feedback).toBeNull();
      expect(hasFurigana(question.questionText)).toBe(false);
    }
  });

  function mockAssignment(status: string, answeredAt: Date | null) {
    mocks.delegates.practiceAnswer.findUnique.mockResolvedValue({
      id: 9,
      selectedAnswer: null,
      isCorrect: null,
      answeredAt,
      practiceSession: { id: 3, userId: 5, status, questionCount: 2 },
      question: {
        questionAnswer: 2,
        explanation: EXPLANATION,
        questionChoices: [1, 2, 3].map((codeAnswer) => ({ codeAnswer })),
      },
    });
  }

  it("pilihan yang tidak ada di soal ditolak tanpa membuka kunci", async () => {
    mockAssignment("IN_PROGRESS", null);

    const result = await submitPracticeAnswerAction({ sessionId: 3, questionId: 100, selectedAnswer: 4 });

    expect(result.ok).toBe(false);
    expect(keysDeep(result)).not.toContain("correctAnswer");
    expect(keysDeep(result)).not.toContain("explanation");
    expect(mocks.delegates.practiceAnswer.updateMany).not.toHaveBeenCalled();
  });

  it("soal yang belum dijawab di sesi yang sudah ditutup tidak membuka kunci", async () => {
    mockAssignment("ABANDONED", null);

    const result = await submitPracticeAnswerAction({ sessionId: 3, questionId: 100, selectedAnswer: 1 });

    expect(result.ok).toBe(false);
    expect(keysDeep(result)).not.toContain("correctAnswer");
    expect(keysDeep(result)).not.toContain("explanation");
  });

  describe("submit guest", () => {
    function setGuestCookie(value: string) {
      mocks.cookies.set("jlpt_guest_practice", value);
    }

    beforeEach(() => {
      mocks.getSession.mockResolvedValue(null);
      mocks.delegates.question.findUnique.mockResolvedValue({
        questionAnswer: 2,
        explanation: EXPLANATION,
        questionChoices: [1, 2, 3, 4].map((codeAnswer) => ({ codeAnswer })),
      });
    });

    function expectRejectedWithoutKey(result: unknown) {
      expect(result).toMatchObject({ ok: false });
      expect(keysDeep(result)).not.toContain("correctAnswer");
      expect(keysDeep(result)).not.toContain("explanation");
      // Ditolak sebelum kunci dibaca dari database.
      expect(mocks.delegates.question.findUnique).not.toHaveBeenCalled();
    }

    it("soal di luar sesi guest ditolak tanpa membuka kunci", async () => {
      setGuestCookie(JSON.stringify({ jlptLevel: "N2", questionIds: [100, 101] }));

      expectRejectedWithoutKey(
        await submitPracticeAnswerAction({ sessionId: 0, questionId: 999, selectedAnswer: 1 }),
      );
    });

    it("tanpa cookie guest — termasuk user login yang mengirim sessionId 0 — ditolak", async () => {
      mocks.getSession.mockResolvedValue({ userId: 5, sessionId: "sesi" });

      expectRejectedWithoutKey(
        await submitPracticeAnswerAction({ sessionId: 0, questionId: 100, selectedAnswer: 1 }),
      );
    });

    it("cookie yang rusak ditolak", async () => {
      for (const value of ["{bukan json", JSON.stringify({ questionIds: ["100"] }), "[]"]) {
        setGuestCookie(value);
        expectRejectedWithoutKey(
          await submitPracticeAnswerAction({ sessionId: 0, questionId: 100, selectedAnswer: 1 }),
        );
      }
    });

    it("pilihan yang tidak ada di soal ditolak tanpa membuka kunci", async () => {
      setGuestCookie(JSON.stringify({ jlptLevel: "N2", questionIds: [100, 101] }));
      mocks.delegates.question.findUnique.mockResolvedValue({
        questionAnswer: 2,
        explanation: EXPLANATION,
        questionChoices: [1, 2, 3].map((codeAnswer) => ({ codeAnswer })),
      });

      const result = await submitPracticeAnswerAction({ sessionId: 0, questionId: 100, selectedAnswer: 4 });

      expect(result).toMatchObject({ ok: false, message: "Pilihan jawaban tidak tersedia untuk soal ini." });
      expect(keysDeep(result)).not.toContain("correctAnswer");
      expect(keysDeep(result)).not.toContain("explanation");
    });

    it("soal anggota sesi guest dinilai dan mendapat kunci", async () => {
      setGuestCookie(JSON.stringify({ jlptLevel: "N2", questionIds: [100, 101] }));

      const result = await submitPracticeAnswerAction({ sessionId: 0, questionId: 101, selectedAnswer: 2 });

      expect(result).toMatchObject({ ok: true, isCorrect: true, correctAnswer: 2 });
    });
  });

  it("kunci dan pembahasan baru dikirim setelah jawaban dinilai server", async () => {
    mockAssignment("IN_PROGRESS", null);
    mocks.delegates.practiceAnswer.count.mockResolvedValue(1);
    mocks.delegates.practiceAnswer.findUniqueOrThrow.mockResolvedValue({
      selectedAnswer: 1,
      isCorrect: false,
      answeredAt: new Date("2026-10-03T00:02:00Z"),
    });

    const result = await submitPracticeAnswerAction({ sessionId: 3, questionId: 100, selectedAnswer: 1 });

    expect(mocks.delegates.practiceAnswer.updateMany).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ ok: true, isCorrect: false, correctAnswer: 2 });
  });
});

describe("result", () => {
  const attempt = (status: string, userId = 5) => ({
    id: 10,
    userId,
    testPackageId: 1,
    sectionScope: null,
    status,
    testPackage: { id: 1, name: "Paket", jlptLevel: "N2" },
  });

  it("review per soal ditolak sebelum query ber-kunci untuk attempt yang belum selesai", async () => {
    mocks.delegates.attempt.findUnique.mockResolvedValue(attempt("IN_PROGRESS"));

    await expect(getAttemptDetail(10)).rejects.toThrow("NEXT_REDIRECT /test-package/1");
    expect(mocks.delegates.testPackageItem.findMany).not.toHaveBeenCalled();
  });

  it("review per soal attempt milik orang lain berakhir 404 sebelum query ber-kunci", async () => {
    mocks.delegates.attempt.findUnique.mockResolvedValue(attempt("COMPLETED", 6));

    await expect(getAttemptDetail(10)).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.delegates.testPackageItem.findMany).not.toHaveBeenCalled();
  });

  it("review per soal pemilik attempt yang selesai membaca kunci", async () => {
    mocks.delegates.attempt.findUnique.mockResolvedValue(attempt("COMPLETED"));
    mocks.delegates.testPackageItem.findMany.mockResolvedValue([]);

    await getAttemptDetail(10);

    const [read] = mocks.delegates.testPackageItem.findMany.mock.calls[0] ?? [];
    expect(answerKeyPaths("TestPackageItem", read)).toContain(
      "TestPackageItem.questions.questionAnswer",
    );
  });

  it("ringkasan attempt yang belum selesai dialihkan, bukan ditampilkan", async () => {
    mocks.delegates.attempt.findUnique.mockResolvedValue({
      ...attempt("IN_PROGRESS"),
      startedAt: new Date(),
      finishedAt: null,
      answers: [],
    });

    await expect(getAttemptSummary(10)).rejects.toThrow("NEXT_REDIRECT /test-package/1");
  });

  it("ringkasan guest hanya berisi agregat, walau baris soal membawa kunci dan pembahasan", async () => {
    mocks.cookies.set("jlpt_guest_exam", JSON.stringify({ testPackageId: 1, sectionScope: null }));
    mocks.delegates.testPackage.findUnique.mockResolvedValue({ id: 1, name: "Paket", jlptLevel: "N2" });
    mocks.delegates.testPackageItem.findMany.mockResolvedValue([
      {
        mondaiType: "MOJI_GOI_READ_KANJI",
        questions: [
          { id: 100, questionAnswer: 2, explanation: EXPLANATION },
          { id: 101, questionAnswer: 3, explanation: EXPLANATION },
        ],
      },
    ]);

    const summary = await getGuestAttemptSummary([
      { questionId: 100, selectedAnswer: 2, flagged: false },
      { questionId: 101, selectedAnswer: 1, flagged: true },
    ]);

    expect(summary?.stats).toMatchObject({ totalQuestions: 2, totalCorrect: 1, totalWrong: 1 });
    const keys = keysDeep(summary);
    for (const key of ["questionAnswer", "explanation", "isCorrect", "questions", "questionId"]) {
      expect(keys, key).not.toContain(key);
    }
  });
});

// ============================================================
// STATIS: POLA TERLARANG DI SELURUH src/
// ============================================================

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

function listSources(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = `${dir}/${entry}`;
    if (statSync(path).isDirectory()) return listSources(path);
    return /\.(ts|tsx)$/.test(entry) && !entry.endsWith(".test.ts") ? [path] : [];
  });
}

const SOURCES = new Map(
  listSources(`${ROOT}src`).map((path) => [path.slice(ROOT.length), readFileSync(path, "utf8")]),
);

function sourcesUnder(...prefixes: string[]) {
  return [...SOURCES].filter(([path]) => prefixes.some((prefix) => path.startsWith(prefix)));
}

/** Isi argumen sebuah pemanggilan, dari `(` sesudah `index` sampai `)` pasangannya. */
function callArguments(source: string, openIndex: number) {
  let depth = 0;
  for (let index = openIndex; index < source.length; index += 1) {
    if (source[index] === "(") depth += 1;
    if (source[index] === ")" && --depth === 0) return source.slice(openIndex + 1, index);
  }
  throw new Error("pemanggilan tanpa kurung penutup");
}

/** Hanya isi tingkat teratas objek argumen; isi objek bersarang dibuang. */
function topLevel(args: string) {
  let depth = 0;
  let result = "";
  for (const char of args) {
    if ("({[".includes(char)) depth += 1;
    if (depth <= 1) result += char;
    if (")}]".includes(char)) depth -= 1;
  }
  return result;
}

describe("QUESTION_EXPLANATION_SELECT", () => {
  it("bentuknya tetap: tanpa jejak audit, catatan keraguan, atau kolom admin", () => {
    expect(QUESTION_EXPLANATION_SELECT).toEqual({
      summary: true,
      detail: true,
      translation: true,
      keyPoints: true,
      answerKeyDoubt: true,
      choices: {
        orderBy: { codeAnswer: "asc" },
        select: { codeAnswer: true, isCorrect: true, reason: true },
      },
    });
  });

  it("hanya dipakai jalur yang memang boleh membuka pembahasan", () => {
    const users = [...SOURCES]
      .filter(([, source]) => source.includes("QUESTION_EXPLANATION_SELECT"))
      .map(([path]) => path)
      .sort();
    expect(users).toEqual([
      "src/features/practice/actions.ts", // hanya soal yang dijawab (dijaga test runtime)
      "src/features/question-comment/queries.ts", // halaman diskusi publik
      "src/features/result/actions.ts", // review setelah submit
      "src/features/test-package/actions.ts", // mode baca publik
      "src/lib/question-explanation.ts",
    ]);
  });
});

describe("QUESTION_BUNPOU_LINKS_SELECT", () => {
  it("bentuknya tetap: hanya pola yang diuji, yakin, dan belum pensiun", () => {
    expect(QUESTION_BUNPOU_LINKS_SELECT).toEqual({
      where: { role: "TESTED", confidence: "HIGH", point: { retiredAt: null } },
      orderBy: { order: "asc" },
      select: { point: { select: { key: true, title: true, level: true, meaningId: true } } },
    });
  });

  it("hanya dipakai jalur yang memang boleh membuka pembahasan", () => {
    const users = [...SOURCES]
      .filter(([, source]) => source.includes("QUESTION_BUNPOU_LINKS_SELECT"))
      .map(([path]) => path)
      .sort();
    expect(users).toEqual([
      "src/features/practice/actions.ts", // hanya soal yang dijawab (dijaga test runtime)
      "src/features/result/actions.ts", // review setelah submit
      "src/features/test-package/actions.ts", // mode baca publik
      "src/lib/question-bunpou-links.ts",
    ]);
  });
});

describe("pola query terlarang", () => {
  it("relasi pembahasan tidak pernah diambil utuh atau lewat include", () => {
    for (const [path, source] of SOURCES) {
      expect(source, path).not.toMatch(/\bexplanation:\s*true/);
      expect(source, path).not.toMatch(/\binclude:\s*\{[^}]*\bexplanation\b/);
    }
  });

  it("jalur publik tidak memakai include Prisma", () => {
    const publicPaths = sourcesUnder(
      "src/app/(public)/",
      "src/app/api/",
      "src/lib/",
      "src/features/exam/",
      "src/features/practice/",
      "src/features/result/",
      "src/features/test-package/",
      "src/features/question-comment/",
      "src/features/report/",
    );
    for (const [path, source] of publicPaths) {
      expect(source, path).not.toMatch(/\binclude:\s*\{/);
    }
  });

  it("query baca pada model yang menyimpan kunci selalu memakai select eksplisit", () => {
    // Model yang punya kolom kunci/turunannya: tanpa select, kolom itu ikut.
    const keyedDelegates = [...MODELS.values()]
      .filter(
        (model) =>
          FORBIDDEN_MODELS.has(model.name) ||
          model.fields.some(
            (field) => field.kind !== "object" && FORBIDDEN_FIELDS[model.name]?.includes(field.name),
          ),
      )
      .map((model) => model.name[0]!.toLowerCase() + model.name.slice(1));
    expect(keyedDelegates).toEqual(
      expect.arrayContaining(["question", "attemptAnswer", "questionExplanation"]),
    );

    const call = new RegExp(
      `\\b(?:prisma|tx|transaction)\\.(${keyedDelegates.join("|")})\\.(find\\w*|\\w+AndReturn)\\(`,
      "g",
    );
    const missing: string[] = [];
    for (const [path, source] of SOURCES) {
      for (const match of source.matchAll(call)) {
        const args = callArguments(source, match.index + match[0].length - 1);
        if (!/\bselect\s*:/.test(topLevel(args))) {
          missing.push(`${path}:${source.slice(0, match.index).split("\n").length} ${match[0]}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});

describe("permukaan sampingan selama ujian dan latihan", () => {
  it("runner dan halaman exam tidak menyentuh kunci, pembahasan, catatan, atau diskusi", () => {
    const examFiles = sourcesUnder("src/features/exam/components/", "src/app/(public)/exam/");
    expect(examFiles.length).toBeGreaterThan(0);
    for (const [path, source] of examFiles) {
      for (const token of [
        "questionAnswer",
        "isCorrect",
        "correctAnswer",
        "explanation",
        "Explanation",
        "bunpouPoints",
        "BunpouPoints",
        "Discussion",
        "QuestionComment",
        "/discussion",
        "/questions",
      ]) {
        expect(source, `${path} menyebut ${token}`).not.toContain(token);
      }
      // Laporan dari runner hanya untuk soal, bukan pembahasannya.
      for (const match of source.matchAll(/targetType: "(\w+)"/g)) {
        expect(match[1], path).toBe("QUESTION");
      }
    }
  });

  it("runner latihan tidak membuka diskusi atau catatan, dan pembahasan hanya dari feedback", () => {
    const runner = SOURCES.get("src/features/practice/components/practice-runner.tsx")!;
    for (const token of ["Discussion", "QuestionComment", "/discussion", "/questions"]) {
      expect(runner, token).not.toContain(token);
    }
    expect(runner.match(/<QuestionExplanationBody explanation=\{([^}]+)\}/g)).toEqual([
      "<QuestionExplanationBody explanation={currentQuestion.feedback.explanation}",
    ]);
    expect(runner).toMatch(
      /currentQuestion\.feedback\?\.explanation && \([\s\S]{0,200}targetType: "QUESTION_EXPLANATION"/,
    );
    // Tautan pola menyebut pola yang diuji: sama seperti pembahasan, hanya dari feedback.
    expect(runner.match(/<QuestionBunpouPoints points=\{([^}]+)\}/g)).toEqual([
      "<QuestionBunpouPoints points={currentQuestion.feedback.bunpouPoints}",
    ]);
  });
});

describe("cache ber-kunci terpisah dari jalur exam", () => {
  it("hanya mode baca yang men-cache soal beserta kunci dan pembahasannya", () => {
    const keyedCaches: string[] = [];
    for (const [path, source] of SOURCES) {
      for (const match of source.matchAll(/\bunstable_cache\(/g)) {
        const args = callArguments(source, match.index + match[0].length - 1);
        if (/questionAnswer|QUESTION_EXPLANATION_SELECT|explanation/.test(args)) {
          keyedCaches.push(path);
          expect(args).toContain("CACHE_KEYS.testPackageQuestions(");
          expect(args).toContain("CACHE_TAGS.testPackageQuestions(");
        }
      }
    }
    expect(keyedCaches).toEqual(["src/features/test-package/actions.ts"]);
  });

  it("cache tautan pola hanya di mode baca, dengan key dan tag katalog bunpou sendiri", () => {
    const linkCaches: string[] = [];
    for (const [path, source] of SOURCES) {
      for (const match of source.matchAll(/\bunstable_cache\(/g)) {
        const args = callArguments(source, match.index + match[0].length - 1);
        if (/QUESTION_BUNPOU_LINKS_SELECT|bunpouLinks|questionBunpouLink/.test(args)) {
          linkCaches.push(path);
          expect(args).toContain("CACHE_KEYS.testPackageBunpouPoints(");
          expect(args).toContain("CACHE_TAGS.bunpouCatalog");
        }
      }
    }
    expect(linkCaches).toEqual(["src/features/test-package/actions.ts"]);
  });

  it("jalur exam, latihan, dan result tidak memakai cache mode baca", () => {
    const users = [...SOURCES]
      .filter(([, source]) =>
        /getTestPackageQuestions|getCachedTestPackageQuestions|CACHE_KEYS\.testPackageQuestions/.test(
          source,
        ),
      )
      .map(([path]) => path)
      .sort();
    expect(users).toEqual([
      "src/app/(public)/test-package/[id]/questions/page.tsx",
      "src/features/test-package/actions.ts",
    ]);
  });
});

describe("admin terpisah dari jalur exam", () => {
  it("admin tidak memakai ulang query, select, atau komponen exam/latihan/result", () => {
    for (const [path, source] of sourcesUnder("src/features/admin/", "src/app/admin/")) {
      expect(source, path).not.toMatch(/from "@\/features\/(exam|practice|result)\b/);
      expect(source, path).not.toContain("QUESTION_EXPLANATION_SELECT");
    }
  });

  it("jalur publik tidak mengimpor modul admin", () => {
    const publicPaths = sourcesUnder(
      "src/app/(public)/",
      "src/features/exam/",
      "src/features/practice/",
      "src/features/result/",
      "src/features/test-package/",
      "src/features/question-comment/",
    );
    for (const [path, source] of publicPaths) {
      expect(source, path).not.toMatch(/from "@\/features\/admin\b/);
    }
  });
});
