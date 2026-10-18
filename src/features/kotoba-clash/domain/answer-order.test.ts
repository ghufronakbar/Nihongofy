import { describe, expect, it } from "vitest";
import { roundAnswerOrders } from "./answer-order";
import { earlyRevealSchedule, type LedgerAnswer } from "./engine";

const round = { id: "current", position: 1, startsAt: 1000, endsAt: 31000, revealEndsAt: 39000 };
const answers: LedgerAnswer[] = [
  { roundId: round.id, playerId: "second", acceptedAt: 3000, choice: 1 },
  { roundId: round.id, playerId: "first", acceptedAt: 2000, choice: 2 },
];

describe("Kotoba Clash round answer order", () => {
  it("uses server acceptance time and ignores correctness, input order and retry reads", () => {
    const expected = new Map([["first", 1], ["second", 2]]);
    expect(roundAnswerOrders(round, answers, 4000)).toEqual(expected);
    expect(roundAnswerOrders(round, [...answers].reverse().map((answer) => ({ ...answer, choice: 4 })), 4000)).toEqual(expected);
    expect(roundAnswerOrders(round, answers, 4000)).toEqual(expected);
    expect(answers[0]!.playerId).toBe("second");
  });

  it("shares order for same-millisecond answers without an arbitrary tiebreaker", () => {
    const simultaneous = [answers[0]!, { ...answers[1]!, acceptedAt: 3000 }, { ...answers[1]!, playerId: "third", acceptedAt: 4000 }];
    expect(roundAnswerOrders(round, simultaneous, 5000)).toEqual(new Map([["second", 1], ["first", 1], ["third", 3]]));
  });

  it("keeps only accepted answers in the current round and within server time", () => {
    const invalid = [
      { ...answers[0]!, roundId: "previous" },
      { ...answers[0]!, roundId: "next" },
      { ...answers[0]!, acceptedAt: 999 },
      { ...answers[0]!, acceptedAt: 31000 },
      { ...answers[0]!, acceptedAt: 5000 },
    ];
    expect(roundAnswerOrders(round, [...invalid, answers[1]!], 4000)).toEqual(new Map([["first", 1]]));
    expect(roundAnswerOrders(round, [{ ...answers[1]!, acceptedAt: 1000 }], 1000)).toEqual(new Map([["first", 1]]));
  });

  it("persists the order through reveal, including accelerated rounds", () => {
    const accelerated = earlyRevealSchedule(round, 3000);
    expect(roundAnswerOrders(accelerated, answers, accelerated.endsAt)).toEqual(new Map([["first", 1], ["second", 2]]));
    expect(roundAnswerOrders(round, answers, round.endsAt)).toEqual(roundAnswerOrders(round, answers, 4000));
  });

  it("resets at countdown, the next round, and completion", () => {
    expect(roundAnswerOrders(null, answers, 4000).size).toBe(0);
    expect(roundAnswerOrders(round, answers, 999).size).toBe(0);
    expect(roundAnswerOrders(round, answers, round.revealEndsAt).size).toBe(0);
    expect(roundAnswerOrders({ ...round, id: "next", startsAt: 39000, endsAt: 69000, revealEndsAt: 77000 }, answers, 40000).size).toBe(0);
  });
});
