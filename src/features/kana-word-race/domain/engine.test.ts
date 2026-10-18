import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import release from "@/kana-race-data/dictionary.v1.json";
import { ConfigSchema, CreateSchema, DEFAULT_CONFIG, DictionarySchema, MatchSchema } from "../contracts";
import { advance, buildMatch, duration, evaluate, leaderboard, phase, playerStatus, submitGuess } from "./engine";
import { composeRomaji, isGameKana, modifyKana, normalizeKana } from "./kana";

const dictionary = DictionarySchema.parse(release);
const players = [randomUUID(), randomUUID()];
const known = new Set(dictionary.guesses);
const make = () => buildMatch({ ...DEFAULT_CONFIG, length: 3 }, players, dictionary, 1000000, () => 0);

describe("kana input", () => {
  it.each([["ｷﾞﾀｰ", "ぎたー"], ["アルバイト", "あるばいと"], ["か\u3099", "が"]])("normalizes %s without expanding long vowels", (input, expected) => expect(normalizeKana(input)).toBe(expected));
  it.each([["k", "", "k"], ["ka", "か", ""], ["kyo", "きょ", ""], ["n", "", "n"], ["nn", "ん", ""], ["n'", "ん", ""], ["gakkou", "がっこう", ""], ["supa-", "すぱー", ""]])("composes %s with pending Latin separate from boxes", (input, kana, pending) => expect(composeRomaji(input)).toMatchObject({ kana, pending }));
  it("supports every normalized dictionary character and modifiers", () => {
    expect(dictionary.guesses.every(isGameKana)).toBe(true);
    expect(modifyKana("は", "voice")).toBe("ば"); expect(modifyKana("ば", "voice")).toBe("ぱ"); expect(modifyKana("ぱ", "voice")).toBe("は");
    expect(modifyKana("や", "small")).toBe("ゃ"); expect(modifyKana("っ", "small")).toBe("つ");
    expect(isGameKana("あaあ")).toBe(false);
  });
});

describe("race rules", () => {
  it("reads existing config and matches as multiplayer and defaults old create requests", () => {
    const legacy = { length: 3, rounds: 3, pace: "normal", category: false };
    expect(ConfigSchema.parse(legacy).mode).toBe("multiplayer");
    expect(MatchSchema.parse({ ...make(), config: legacy }).config.mode).toBe("multiplayer");
    expect(CreateSchema.parse({ nickname: "Player", requestId: randomUUID() }).mode).toBe("multiplayer");
    expect(ConfigSchema.safeParse({ ...legacy, mode: "unknown" }).success).toBe(false);
  });
  it.each(["solved", "exhausted", "timeout"])("reveals a solo round when %s without waiting for another player", (ending) => {
    const member = players[0]!;
    const match = buildMatch({ ...DEFAULT_CONFIG, mode: "solo", length: 3 }, [member], dictionary, 1000000, () => 0);
    const round = match.rounds[0]!;
    expect(phase(match, round.startsAt).kind).toBe("PLAYING");
    if (ending === "solved") submitGuess(match, known, member, { round: 0, requestId: randomUUID(), kana: round.target }, round.startsAt + 1000);
    if (ending === "exhausted") dictionary.guesses.filter((word) => word.length === 3 && word !== round.target).slice(0, 6).forEach((kana) => submitGuess(match, known, member, { round: 0, requestId: randomUUID(), kana }, round.startsAt + 1000));
    const now = ending === "timeout" ? round.deadline : round.startsAt + 1000;
    advance(match, now);
    expect(phase(match, now).kind).toBe("REVEAL");
    expect(playerStatus(round, member, now)).toBe(ending === "solved" ? "SOLVED" : ending === "exhausted" ? "EXHAUSTED" : "TIMED_OUT");
    expect(leaderboard(match, now)[0]!.score).toBe(ending === "solved" ? 1988 : 0);
    expect(phase(match, now + 8000).kind).toBe("PLAYING");
  });
  it("allocates repeated kana exact matches before displaced occurrences", () => {
    expect(evaluate("かたかな", "かかかか")).toEqual(["correct", "absent", "correct", "absent"]);
    expect(evaluate("あいうあ", "あああい")).toEqual(["correct", "present", "absent", "present"]);
  });
  it("freezes unique targets and balances all five lengths", () => {
    const match = buildMatch({ ...DEFAULT_CONFIG, length: 0, rounds: 10 }, players, dictionary, 1000000, () => 0);
    expect(new Set(match.rounds.map((round) => round.target)).size).toBe(10);
    expect([3, 4, 5, 6, 7].map((length) => match.rounds.filter((round) => round.target.length === length).length)).toEqual([2, 2, 2, 2, 2]);
    expect(buildMatch({ ...DEFAULT_CONFIG, length: 0 }, players, dictionary, 1000000, () => 0).rounds.some((round) => round.target.length >= 6)).toBe(true);
    expect(duration(DEFAULT_CONFIG, 7)).toBe(150000);
  });
  it("keeps opponents playing and scores only after shared reveal", () => {
    const match = make(); const round = match.rounds[0]!;
    submitGuess(match, known, players[0]!, { round: 0, requestId: randomUUID(), kana: round.target }, round.startsAt + 1000);
    expect(phase(match, round.startsAt + 1000).kind).toBe("PLAYING");
    expect(leaderboard(match, round.startsAt + 1000).every((player) => player.score === 0)).toBe(true);
    submitGuess(match, known, players[1]!, { round: 0, requestId: randomUUID(), kana: round.target }, round.startsAt + 2000);
    expect(phase(match, round.startsAt + 2000).kind).toBe("REVEAL");
    const scores = leaderboard(match, round.startsAt + 2000);
    expect(scores[0]!.memberId).toBe(players[0]); expect(scores[0]!.score).toBeGreaterThan(scores[1]!.score);
  });
  it("rejects invalid guesses without consuming a slot; at most six accepted guesses", () => {
    const match = make(); const round = match.rounds[0]!;
    const attempt = (kana: string, at = round.startsAt) => submitGuess(match, known, players[0]!, { round: 0, requestId: randomUUID(), kana }, at);
    expect(() => attempt(round.target, round.startsAt - 1)).toThrow();
    expect(() => attempt("あaあ")).toThrow(); expect(() => attempt("あ")).toThrow();
    expect(round.guesses[players[0]!]!.length).toBe(0);
    const words = dictionary.guesses.filter((word) => word.length === 3 && word !== round.target).slice(0, 7);
    words.slice(0, 6).forEach((word) => attempt(word));
    expect(playerStatus(round, players[0]!, round.startsAt)).toBe("EXHAUSTED");
    expect(() => attempt(words[6]!)).toThrow(); expect(round.guesses[players[0]!]!.length).toBe(6);
  });
  it("replays accepted requests after the deadline but rejects conflicting payloads", () => {
    const match = make(); const round = match.rounds[0]!;
    const input = { round: 0, requestId: randomUUID(), kana: round.target };
    submitGuess(match, known, players[0]!, input, round.startsAt);
    advance(match, round.deadline + 10000000);
    submitGuess(match, known, players[0]!, input, round.deadline + 10000000);
    expect(round.guesses[players[0]!]!.length).toBe(1);
    expect(() => submitGuess(match, known, players[0]!, { ...input, kana: "あああ" }, round.deadline + 1)).toThrow();
  });
  it("recovers through missed deadlines and rejects an answer at the deadline", () => {
    const match = make(); const round = match.rounds[0]!;
    expect(() => submitGuess(match, known, players[0]!, { round: 0, requestId: randomUUID(), kana: round.target }, round.deadline)).toThrow();
    advance(match, 10000000); expect(phase(match, 10000000).kind).toBe("FINISHED");
    expect(match.rounds.every((item) => item.revealAt === item.deadline)).toBe(true);
    expect(leaderboard(match, 10000000).map((player) => player.rank)).toEqual([1, 1]);
  });
  it("preserves numeric score after a player's word data is redacted", () => {
    const match = make(); const round = match.rounds[0]!;
    submitGuess(match, known, players[0]!, { round: 0, requestId: randomUUID(), kana: round.target }, round.startsAt);
    advance(match, round.deadline);
    const before = leaderboard(match, round.deadline);
    round.guesses[players[0]!]!.forEach((guess) => { guess.solved = guess.kana === round.target; guess.kana = ""; guess.feedback = []; });
    expect(leaderboard(match, round.deadline)).toEqual(before);
  });
});
