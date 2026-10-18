import { beforeEach, describe, expect, it, vi } from "vitest";
import { QUESTION_EXPLANATION_SELECT } from "@/lib/question-explanation";
import { projectRound } from "../domain/projection";
import type { ClashConfig } from "../schemas";

const fixture = vi.hoisted(() => ({ questions: vi.fn(), explanations: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {
  question: { findMany: fixture.questions }, questionExplanation: { findMany: fixture.explanations },
} }));
vi.mock("@/constants", () => ({ FEATURES: { kotobaClash: true } }));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));

import { getClashCatalog, sampleClashQuestions } from "./catalog";

const config: ClashConfig = { jlptLevel: "N5", mondaiTypes: ["MOJI_GOI_CONTEXT"], questionCount: 5 };
const explanation = {
  summary: "PRIVATE_SUMMARY", detail: "PRIVATE_DETAIL", translation: "PRIVATE_TRANSLATION",
  keyPoints: ["PRIVATE_KEY_POINT"], answerKeyDoubt: false,
  choices: [
    { codeAnswer: 1, isCorrect: true, reason: "PRIVATE_CORRECT_REASON" },
    { codeAnswer: 2, isCorrect: false, reason: "PRIVATE_WRONG_REASON" },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  fixture.questions.mockResolvedValue(Array.from({ length: 7 }, (_, index) => ({
    id: index + 1, questionText: "{質問|しつもん}", questionImage: null, questionAnswer: 1,
    testPackageItem: { instruction: null, mondaiType: "MOJI_GOI_CONTEXT", testPackage: { jlptLevel: "N5" } },
    questionContext: null,
    questionChoices: [
      { codeAnswer: 1, answerText: "正解", answerImage: null },
      { codeAnswer: 2, answerText: "別", answerImage: null },
    ],
  })));
  fixture.explanations.mockImplementation(async ({ where }: { where: { questionId: { in: number[] } } }) =>
    where.questionId.in.map((questionId) => ({ questionId, ...explanation })));
});

describe("Kotoba Clash full explanation snapshots", () => {
  it("loads full explanations once for selected questions and reveals them only at the cutoff", async () => {
    const assignments = await sampleClashQuestions(config);
    expect(assignments).toHaveLength(5);
    const selectedIds = assignments.map(({ question }) => question.sourceQuestionId);
    expect(new Set(selectedIds).size).toBe(5);
    expect(fixture.explanations).toHaveBeenCalledTimes(1);
    expect(fixture.explanations).toHaveBeenCalledWith({
      where: { questionId: { in: expect.arrayContaining(selectedIds) } },
      select: { questionId: true, ...QUESTION_EXPLANATION_SELECT },
    });
    expect(fixture.explanations.mock.calls[0]![0].where.questionId.in).toHaveLength(5);
    for (const { id, question } of assignments) {
      expect(question.explanationDetails).toEqual(explanation);
      const round = { id, position: 1, startsAt: 1000, endsAt: 31000, revealEndsAt: 39000 };
      expect(JSON.stringify(projectRound(round, question, 30999))).not.toMatch(/PRIVATE_|explanation|isCorrect/);
      expect(projectRound(round, question, 31000)?.explanationDetails).toEqual(explanation);
    }
  });

  it("does not load or return private explanations for catalog counts", async () => {
    const catalog = await getClashCatalog();
    expect(catalog).toContainEqual({ jlptLevel: "N5", mondaiType: "MOJI_GOI_CONTEXT", count: 7 });
    expect(fixture.questions.mock.calls[0]![0].select).not.toHaveProperty("explanation");
    expect(fixture.explanations).not.toHaveBeenCalled();
    expect(JSON.stringify(catalog)).not.toContain("PRIVATE_");
  });

  it("keeps questions playable when their explanation is unavailable", async () => {
    fixture.explanations.mockResolvedValue([]);
    const assignments = await sampleClashQuestions(config);
    expect(assignments.every(({ question }) => question.explanation === null && question.explanationDetails === null)).toBe(true);
  });
});
