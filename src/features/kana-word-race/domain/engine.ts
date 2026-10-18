import type { Feedback, RaceConfig, RaceDictionary, RaceMatch, RaceRound, RaceStatus } from "../contracts";
import { isGameKana, normalizeKana } from "./kana";

export const REVEAL_MS = 8000;
export const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export class RaceError extends Error {
  constructor(message: string, public readonly terminal = false) { super(message); }
}
export function evaluate(target: string, guess: string): Feedback[] {
  const chars = Array.from(guess);
  const targetChars = Array.from(target);
  const result: Feedback[] = chars.map(() => "absent");
  const remaining = new Map<string, number>();
  targetChars.forEach((char, i) => {
    if (char === chars[i]) result[i] = "correct";
    else remaining.set(char, (remaining.get(char) ?? 0) + 1);
  });
  chars.forEach((char, i) => {
    if (result[i] !== "correct" && (remaining.get(char) ?? 0) > 0) {
      result[i] = "present"; remaining.set(char, remaining.get(char)! - 1);
    }
  });
  return result;
}
export function playerStatus(round: RaceRound, memberId: string, now: number): RaceStatus {
  const guesses = round.guesses[memberId] ?? [];
  if (guesses.some((guess) => guess.solved ?? guess.kana === round.target)) return "SOLVED";
  if (guesses.length >= 6) return "EXHAUSTED";
  return now >= round.deadline ? "TIMED_OUT" : "PLAYING";
}
export function duration(config: RaceConfig, length: number) {
  return ((length <= 4 ? 90 : length === 5 ? 120 : 150) + (config.pace === "relaxed" ? 60 : 0)) * 1000;
}
export function stock(dictionary: RaceDictionary) {
  return Object.fromEntries([3, 4, 5, 6, 7].map((length) => [String(length), dictionary.answers.filter((word) => word.kana.length === length).length]));
}
export function buildMatch(config: RaceConfig, roster: string[], dictionary: RaceDictionary, now: number, random: (n: number) => number): RaceMatch {
  const used = new Set<string>();
  const bag = [3, 4, 5, 6, 7];
  for (let i = bag.length - 1; i > 0; i--) { const j = random(i + 1); [bag[i], bag[j]] = [bag[j]!, bag[i]!]; }
  const lengths = Array.from({ length: config.rounds }, (_, i) => config.length || bag[i % 5]!);
  for (let i = lengths.length - 1; i > 0; i--) { const j = random(i + 1); [lengths[i], lengths[j]] = [lengths[j]!, lengths[i]!]; }
  const rounds = lengths.map((length) => {
    const pool = dictionary.answers.filter((word) => word.kana.length === length && !used.has(word.kana));
    if (!pool.length) throw new RaceError("Stok kata belum cukup untuk konfigurasi ini.");
    const target = pool[random(pool.length)]!; used.add(target.kana);
    return { target: target.kana, category: target.category, sources: target.sources, startsAt: 0, deadline: 0, revealAt: null, guesses: Object.fromEntries(roster.map((id) => [id, []])) };
  });
  rounds[0]!.startsAt = now + 5000;
  rounds[0]!.deadline = rounds[0]!.startsAt + duration(config, rounds[0]!.target.length);
  return { version: 1, roster, config, rounds };
}
export function advance(match: RaceMatch, now: number) {
  for (let i = 0; i < match.rounds.length; i++) {
    const round = match.rounds[i]!;
    if (!round.startsAt || now < round.startsAt) return;
    if (round.revealAt === null) {
      if (now >= round.deadline) round.revealAt = round.deadline;
      else if (match.roster.every((id) => playerStatus(round, id, now) !== "PLAYING")) round.revealAt = now;
      else return;
    }
    if (now < round.revealAt + REVEAL_MS) return;
    const next = match.rounds[i + 1];
    if (next && !next.startsAt) {
      next.startsAt = round.revealAt + REVEAL_MS;
      next.deadline = next.startsAt + duration(match.config, next.target.length);
    }
  }
}
export function phase(match: RaceMatch, now: number) {
  for (let index = 0; index < match.rounds.length; index++) {
    const round = match.rounds[index]!;
    if (now < round.startsAt) return { kind: "COUNTDOWN" as const, index, endsAt: round.startsAt };
    if (round.revealAt === null) return { kind: "PLAYING" as const, index, endsAt: round.deadline };
    if (now < round.revealAt + REVEAL_MS) return { kind: "REVEAL" as const, index, endsAt: round.revealAt + REVEAL_MS };
  }
  return { kind: "FINISHED" as const, index: match.rounds.length - 1, endsAt: now };
}
export function submitGuess(match: RaceMatch, dictionary: ReadonlySet<string>, memberId: string, input: { round: number; requestId: string; kana: string }, now: number) {
  if (!match.roster.includes(memberId)) throw new RaceError("Tunggu pertandingan berikutnya untuk ikut bermain.");
  const round = match.rounds[input.round];
  if (!round) throw new RaceError("Ronde tidak ditemukan.");
  const kana = normalizeKana(input.kana);
  const previous = round.guesses[memberId]!.find((guess) => guess.requestId === input.requestId);
  if (previous) {
    if (previous.kana !== kana) throw new RaceError("Request yang sama memiliki isi berbeda.");
    return;
  }
  advance(match, now);
  const current = phase(match, now);
  if (current.kind !== "PLAYING" || current.index !== input.round || now >= round.deadline || playerStatus(round, memberId, now) !== "PLAYING") throw new RaceError("Kesempatan pada ronde ini sudah ditutup.");
  if (!isGameKana(kana) || kana.length !== round.target.length) throw new RaceError("Isi seluruh kotak dengan kana yang valid.");
  if (!dictionary.has(kana)) throw new RaceError("Kata belum tersedia di kamus game.");
  if (round.guesses[memberId]!.some((guess) => guess.kana === kana)) throw new RaceError("Kata ini sudah kamu coba.");
  round.guesses[memberId]!.push({ requestId: input.requestId, kana, at: now, feedback: evaluate(round.target, kana) });
  advance(match, now);
}
export function leaderboard(match: RaceMatch, now: number) {
  const rows = match.roster.map((memberId) => {
    let score = 0;
    for (const round of match.rounds) {
      if (round.revealAt === null || now < round.revealAt) continue;
      const answer = round.guesses[memberId]?.find((guess) => guess.solved ?? guess.kana === round.target);
      if (answer) score += 1000 + Math.floor(1000 * Math.max(0, round.deadline - answer.at) / (round.deadline - round.startsAt));
    }
    return { memberId, score, rank: 1 };
  }).sort((a, b) => b.score - a.score);
  rows.forEach((row, i) => { row.rank = i > 0 && rows[i - 1]!.score === row.score ? rows[i - 1]!.rank : i + 1; });
  return rows;
}
