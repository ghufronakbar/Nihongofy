import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { ClashConfigSchema, ClashNicknameSchema, ClashQuestionSnapshotSchema, ClashClientMessageSchema, nicknameKey } from "../schemas";
import { acceptsAnswer, correctAnswerPoints, createSchedule, earlyRevealSchedule, phaseAt, rankPlayers, scoreLedger } from "./engine";
import { projectRound } from "./projection";
import { CLASH_DURATIONS_MS, CLASH_MONDAI_TYPES } from "./rules";

const question = ClashQuestionSnapshotSchema.parse({
  sourceQuestionId: 1, mondaiType: "MOJI_GOI_READ_KANJI", correctChoice: 1, explanation: "Review only",
  content: {
    instruction: "__{TEST|reading-instruction}__", text: "{TEST|reading-stem}", image: null,
    context: { text: "{TEST|reading-context}", image: null },
    choices: [
      { code: 1, text: "{TEST|reading-choice}", image: null },
      { code: 2, text: "Other choice", image: null },
    ],
  },
});
const schedule = createSchedule(1_000, Array.from({ length: 5 }, (_, index) => ({ id: `round-${index}`, mondaiType: "MOJI_GOI_READ_KANJI" as const })));

describe("Kotoba Clash schedule and scoring", () => {
  it("persists a contiguous countdown/question/reveal schedule", () => {
    expect(schedule[0]).toMatchObject({ startsAt: 6_000, endsAt: 36_000, revealEndsAt: 44_000 });
    expect(schedule[1]!.startsAt).toBe(schedule[0]!.revealEndsAt);
    expect(phaseAt(schedule, 5_999).type).toBe("COUNTDOWN");
    expect(phaseAt(schedule, 6_000).type).toBe("QUESTION");
    expect(phaseAt(schedule, 36_000).type).toBe("REVEAL");
    expect(phaseAt(schedule, 44_000)).toMatchObject({ type: "QUESTION", position: 2 });
    expect(phaseAt(schedule, schedule.at(-1)!.revealEndsAt).type).toBe("FINISHED");
  });
  it("accepts only the inclusive start/exclusive deadline", () => {
    expect(acceptsAnswer(schedule[0]!, 5_999)).toBe(false);
    expect(acceptsAnswer(schedule[0]!, 6_000)).toBe(true);
    expect(acceptsAnswer(schedule[0]!, 35_999)).toBe(true);
    expect(acceptsAnswer(schedule[0]!, 36_000)).toBe(false);
  });
  it("reveals after the last accepted millisecond and preserves the full reveal interval", () => {
    const round = schedule[0]!;
    const accelerated = earlyRevealSchedule(round, round.startsAt + 6_000);
    expect(accelerated.endsAt).toBe(12_001);
    expect(accelerated.revealEndsAt).toBe(20_001);
    expect(acceptsAnswer(accelerated, 12_000)).toBe(true);
    expect(acceptsAnswer(accelerated, 12_001)).toBe(false);
    expect(phaseAt([accelerated], 12_001).type).toBe("REVEAL");
    expect(earlyRevealSchedule(round, round.endsAt - 1)).toEqual(round);
    expect(() => earlyRevealSchedule(round, round.endsAt)).toThrow("outside");
  });
  it("keeps speed points independent of early completion, including same-millisecond answers", () => {
    const round = schedule[0]!;
    const answers = ["a", "b"].map((playerId) => ({ playerId, roundId: round.id, choice: 1, acceptedAt: round.startsAt + 6_000 }));
    const accelerated = { ...earlyRevealSchedule(round, answers[0]!.acceptedAt), correctChoice: 1, scoringDurationMs: 30_000 };
    const result = scoreLedger(["a", "b"], [accelerated], answers, accelerated.endsAt);
    expect(result.map((player) => player.score)).toEqual([1_320, 1_320]);
    expect(scoreLedger(["a", "b"], [accelerated], answers, accelerated.endsAt - 1).map((player) => player.score)).toEqual([0, 0]);
    expect(result).toEqual(scoreLedger(["a", "b"], [{ ...round, correctChoice: 1 }], answers, round.endsAt));
  });
  it("implements the documented speed/streak formula and cap", () => {
    expect(correctAnswerPoints(30_000, 6_000, 3)).toBe(1_420);
    expect(correctAnswerPoints(30_000, 0, 1)).toBe(1_400);
    expect(correctAnswerPoints(30_000, 0, 20)).toBe(1_650);
    expect(correctAnswerPoints(30_000, 29_999, 1)).toBe(1_000);
    expect(() => correctAnswerPoints(0, 0, 1)).toThrow();
  });
  it("rebuilds revealed rounds only, resets streak after wrong/empty, and is repeatable", () => {
    const rounds = schedule.map((round) => ({ ...round, correctChoice: 1 }));
    const answers = [0, 1, 3, 4].map((index) => ({ playerId: "p", roundId: rounds[index]!.id, choice: index === 3 ? 2 : 1, acceptedAt: rounds[index]!.startsAt + 6_000 }));
    expect(scoreLedger(["p"], rounds, answers, 35_999)[0]!.score).toBe(0);
    const result = scoreLedger(["p"], rounds, answers, rounds.at(-1)!.revealEndsAt);
    expect(result[0]).toMatchObject({ score: 4_010, correctCount: 3, wrongCount: 1, skippedCount: 1, bestStreak: 2, correctTimeMs: 18_000 });
    expect(scoreLedger(["p"], rounds, answers, rounds.at(-1)!.revealEndsAt)).toEqual(result);
  });
  it("rejects duplicate or out-of-window persisted answers", () => {
    const round = { ...schedule[0]!, correctChoice: 1 };
    const answer = { playerId: "p", roundId: round.id, choice: 1, acceptedAt: round.endsAt };
    expect(() => scoreLedger(["p"], [round], [answer], round.endsAt)).toThrow("outside");
    expect(() => scoreLedger(["p"], [round], [answer, answer], round.endsAt)).toThrow("Duplicate");
  });
  it("shares rank when all tie-break values match", () => {
    const base = { score: 1_200, correctCount: 1, wrongCount: 0, skippedCount: 0, bestStreak: 1, correctTimeMs: 15_000 };
    const ranks = rankPlayers([{ ...base, playerId: "z" }, { ...base, playerId: "a" }, { ...base, playerId: "b", correctTimeMs: 16_000 }]);
    expect(ranks.map(({ rank }) => rank)).toEqual([1, 1, 3]);
  });
  it("supports long dokkai matches without a 20 minute expiry assumption", () => {
    const rounds = createSchedule(0, Array.from({ length: 20 }, () => ({ id: randomUUID(), mondaiType: "DOKKAI_LONG_TEXT" as const })));
    expect(rounds.at(-1)!.revealEndsAt).toBe(4_965_000);
  });
});

describe("Kotoba Clash private/public boundary", () => {
  it("does not send future questions or private fields during countdown", () => {
    expect(projectRound(schedule[0]!, question, 5_999)).toBeNull();
  });
  it("removes every reading and answer-derived field while answering", () => {
    const result = projectRound(schedule[0]!, question, 6_000);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toMatch(/reading-|correctChoice|explanation|sourceQuestionId/);
    expect(result?.content.instruction).toBe("__TEST__");
    expect(result?.content.context?.text).toBe("TEST");
    expect(result?.content.choices[0]!.text).toBe("TEST");
  });
  it("reveals the answer and full markup exactly at the deadline", () => {
    expect(projectRound(schedule[0]!, question, 36_000)).toMatchObject({ correctChoice: 1, explanation: "Review only" });
    expect(JSON.stringify(projectRound(schedule[0]!, question, 36_000))).toContain("reading-stem");
  });
});

describe("Kotoba Clash untrusted inputs", () => {
  it.each([5, 10, 15, 20])("accepts exactly %i questions", (questionCount) => {
    expect(ClashConfigSchema.safeParse({ jlptLevel: "N5", mondaiTypes: ["MOJI_GOI_CONTEXT"], questionCount }).success).toBe(true);
  });
  it("rejects audio, repeated categories, and arbitrary question counts", () => {
    const config = { jlptLevel: "N5", mondaiTypes: ["MOJI_GOI_CONTEXT"], questionCount: 5 };
    expect(ClashConfigSchema.safeParse({ ...config, questionCount: 6 }).success).toBe(false);
    expect(ClashConfigSchema.safeParse({ ...config, mondaiTypes: ["CHOUKAI_MAIN_POINT"] }).success).toBe(false);
    expect(ClashConfigSchema.safeParse({ ...config, mondaiTypes: ["MOJI_GOI_CONTEXT", "MOJI_GOI_CONTEXT"] }).success).toBe(false);
    expect(CLASH_MONDAI_TYPES.every((type) => CLASH_DURATIONS_MS[type] > 0)).toBe(true);
  });
  it("normalizes nicknames and rejects markup/control characters", () => {
    expect(ClashNicknameSchema.parse("  Alice   B  ")).toBe("Alice B");
    expect(nicknameKey("ALICE")).toBe(nicknameKey("alice"));
    expect(nicknameKey("\u0130".repeat(24))).toHaveLength(48);
    expect(ClashNicknameSchema.safeParse("<script>").success).toBe(false);
    expect(ClashNicknameSchema.safeParse("a\u200bb").success).toBe(false);
  });
  it("rejects spoofed identity and client clocks in answer messages", () => {
    const input = { protocolVersion: 1, type: "submit_answer", requestId: randomUUID(), roomId: randomUUID(), matchId: randomUUID(), roundId: randomUUID(), choice: 1 };
    expect(ClashClientMessageSchema.safeParse(input).success).toBe(true);
    expect(ClashClientMessageSchema.safeParse({ ...input, userId: 1 }).success).toBe(false);
    expect(ClashClientMessageSchema.safeParse({ ...input, acceptedAt: 0 }).success).toBe(false);
  });
});
