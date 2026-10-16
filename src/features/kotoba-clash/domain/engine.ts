import { CLASH_COUNTDOWN_MS, CLASH_DURATIONS_MS, CLASH_REVEAL_MS, type ClashMondaiType } from "./rules";

export type RoundSchedule = {
  id: string;
  position: number;
  startsAt: number;
  endsAt: number;
  revealEndsAt: number;
};

export function createSchedule(startedAt: number, questions: { id: string; mondaiType: ClashMondaiType }[]): RoundSchedule[] {
  let cursor = startedAt + CLASH_COUNTDOWN_MS;
  return questions.map((question, index) => {
    const startsAt = cursor;
    const endsAt = startsAt + CLASH_DURATIONS_MS[question.mondaiType];
    cursor = endsAt + CLASH_REVEAL_MS;
    return { id: question.id, position: index + 1, startsAt, endsAt, revealEndsAt: cursor };
  });
}

export type ClashPhase =
  | { type: "COUNTDOWN"; endsAt: number }
  | { type: "QUESTION" | "REVEAL"; roundId: string; position: number; endsAt: number }
  | { type: "FINISHED" };

export function phaseAt(rounds: RoundSchedule[], now: number): ClashPhase {
  const first = rounds[0];
  if (!first) throw new Error("A match requires rounds.");
  if (now < first.startsAt) return { type: "COUNTDOWN", endsAt: first.startsAt };
  for (const round of rounds) {
    if (now < round.endsAt) return { type: "QUESTION", roundId: round.id, position: round.position, endsAt: round.endsAt };
    if (now < round.revealEndsAt) return { type: "REVEAL", roundId: round.id, position: round.position, endsAt: round.revealEndsAt };
  }
  return { type: "FINISHED" };
}

export function acceptsAnswer(round: RoundSchedule, acceptedAt: number) {
  return acceptedAt >= round.startsAt && acceptedAt < round.endsAt;
}

export function correctAnswerPoints(durationMs: number, elapsedMs: number, streak: number) {
  if (!Number.isFinite(durationMs) || durationMs <= 0 || !Number.isFinite(elapsedMs) || !Number.isInteger(streak) || streak < 1) {
    throw new Error("Invalid scoring input.");
  }
  const speed = Math.floor(400 * Math.min(1, Math.max(0, (durationMs - elapsedMs) / durationMs)));
  return 1_000 + speed + Math.min(50 * (streak - 1), 250);
}

export type LedgerRound = RoundSchedule & { correctChoice: number };
export type LedgerAnswer = { roundId: string; playerId: string; choice: number; acceptedAt: number };
export type PlayerResult = {
  playerId: string;
  score: number;
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
  bestStreak: number;
  correctTimeMs: number;
};

// Rebuild from the immutable ledger; retries never increment an existing aggregate.
export function scoreLedger(playerIds: string[], rounds: LedgerRound[], answers: LedgerAnswer[], revealedAt: number): PlayerResult[] {
  const byAnswer = new Map<string, LedgerAnswer>();
  for (const answer of answers) {
    const key = `${answer.playerId}:${answer.roundId}`;
    if (byAnswer.has(key)) throw new Error("Duplicate ledger answer.");
    byAnswer.set(key, answer);
  }
  const completed = rounds.filter((round) => round.endsAt <= revealedAt).sort((a, b) => a.position - b.position);
  return playerIds.map((playerId) => {
    const result: PlayerResult = { playerId, score: 0, correctCount: 0, wrongCount: 0, skippedCount: 0, bestStreak: 0, correctTimeMs: 0 };
    let streak = 0;
    for (const round of completed) {
      const answer = byAnswer.get(`${playerId}:${round.id}`);
      if (!answer) {
        result.skippedCount += 1;
        streak = 0;
      } else if (!acceptsAnswer(round, answer.acceptedAt)) {
        throw new Error("Ledger answer is outside its round.");
      } else if (answer.choice !== round.correctChoice) {
        result.wrongCount += 1;
        streak = 0;
      } else {
        streak += 1;
        const elapsed = answer.acceptedAt - round.startsAt;
        result.correctCount += 1;
        result.correctTimeMs += elapsed;
        result.bestStreak = Math.max(result.bestStreak, streak);
        result.score += correctAnswerPoints(round.endsAt - round.startsAt, elapsed, streak);
      }
    }
    return result;
  });
}

export function rankPlayers(results: PlayerResult[]) {
  const compare = (a: PlayerResult, b: PlayerResult) => b.score - a.score || b.correctCount - a.correctCount || a.correctTimeMs - b.correctTimeMs;
  const sorted = [...results].sort((a, b) => compare(a, b) || a.playerId.localeCompare(b.playerId));
  let rank = 1;
  return sorted.map((result, index) => {
    if (index > 0 && compare(result, sorted[index - 1]!) !== 0) rank = index + 1;
    return { ...result, rank };
  });
}
