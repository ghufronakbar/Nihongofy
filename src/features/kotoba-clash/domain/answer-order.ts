import { acceptsAnswer, type LedgerAnswer, type RoundSchedule } from "./engine";

// Only timing participates in this projection; choices and correctness stay private.
export function roundAnswerOrders(
  round: RoundSchedule | null,
  answers: readonly Pick<LedgerAnswer, "roundId" | "playerId" | "acceptedAt">[],
  now: number,
): Map<string, number> {
  if (!round || now < round.startsAt || now >= round.revealEndsAt) return new Map();
  const accepted = answers.filter((answer) => answer.roundId === round.id
    && answer.acceptedAt <= now && acceptsAnswer(round, answer.acceptedAt))
    .sort((a, b) => a.acceptedAt - b.acceptedAt);
  let order = 1;
  return new Map(accepted.map((answer, index) => {
    if (index > 0 && answer.acceptedAt !== accepted[index - 1]!.acceptedAt) order = index + 1;
    return [answer.playerId, order];
  }));
}
