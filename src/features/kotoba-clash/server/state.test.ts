import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { PrismaClashRepository } from "./repository";
import { PrismaClashState } from "./state";

const fixture = vi.hoisted(() => ({
  lookup: vi.fn(), transaction: vi.fn(), match: vi.fn(), members: vi.fn(),
  now: vi.fn(), room: vi.fn(), member: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {
  kotobaClashRoom: { findUnique: fixture.lookup }, $transaction: fixture.transaction,
} }));
vi.mock("./repository", async (importOriginal) => ({
  ...await importOriginal<typeof import("./repository")>(),
  databaseNow: fixture.now, lockIdentity: vi.fn(), lockRoom: fixture.room, requireMember: fixture.member,
}));

const id = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
const identity = { kind: "account" as const, userId: 1 };
const round = (position: number, startsAt: number) => ({
  id: id(20 + position), position, startsAt: new Date(startsAt), endsAt: new Date(startsAt + 30000),
  revealEndsAt: new Date(startsAt + 38000), finalizedAt: new Date(0),
  snapshot: {
    sourceQuestionId: position, mondaiType: "MOJI_GOI_CONTEXT", correctChoice: 2, explanation: "PRIVATE_EXPLANATION",
    content: { instruction: null, text: "Question", image: null, context: null, choices: [
      { code: 1, text: "First", image: null }, { code: 2, text: "Second", image: null },
    ] },
  },
});
function match() {
  return {
    id: id(10), status: "RUNNING", rulesVersion: 2, endsAt: new Date(77000),
    rounds: [round(1, 1000), round(2, 39000)],
    players: [
      { id: id(11), memberId: id(2), member: { nickname: "Host" }, answers: [{ roundId: id(21), choice: 2, acceptedAt: new Date(4000) }] },
      { id: id(12), memberId: id(3), member: { nickname: "Guest" }, answers: [{ roundId: id(21), choice: 1, acceptedAt: new Date(3000) }] },
      { id: id(13), memberId: id(4), member: { nickname: "Waiting" }, answers: [] },
    ],
  };
}
const repository = new PrismaClashRepository(prisma);
const state = new PrismaClashState(prisma, repository);

beforeEach(() => {
  vi.clearAllMocks();
  fixture.lookup.mockResolvedValue({ id: id(1) });
  fixture.transaction.mockImplementation(async (run: (tx: unknown) => Promise<unknown>) => run({
    kotobaClashMatch: { findFirst: fixture.match }, kotobaClashRoomMember: { findMany: fixture.members },
  }));
  fixture.now.mockResolvedValue(new Date(5000));
  fixture.room.mockResolvedValue({ id: id(1), code: "ABCD2345", status: "OPEN", hostUserId: 1,
    revision: 2, config: null, configRevision: 0, updatedAt: new Date(0), expiresAt: new Date(1000000) });
  fixture.member.mockResolvedValue({ id: id(2), spectating: false });
  fixture.members.mockResolvedValue([2, 3, 4, 5].map((value) => ({
    id: id(value), nickname: `Member ${value}`, readyRevision: null, spectating: value === 5, userId: value, user: null,
  })));
  fixture.match.mockResolvedValue(match());
  vi.spyOn(repository, "reconcile").mockResolvedValue({ revision: 2, changed: false });
});

describe("Kotoba Clash live answer status projection", () => {
  it("adds status using existing reads while keeping active scores and opponents' answers private", async () => {
    const result = await state.read(identity, id(1));
    expect(result.match!.leaderboard.map((player) => [player.nickname, player.answerOrder, player.score])).toEqual([
      ["Host", 2, 0], ["Guest", 1, 0], ["Waiting", null, 0],
    ]);
    expect(result.match!.ownAnswer).toEqual({ choice: 2, acceptedAt: 4000 });
    expect(JSON.stringify(result.match!.leaderboard)).not.toMatch(/choice|acceptedAt|explanation|isCorrect/);
    expect(result.match!.round).not.toHaveProperty("correctChoice");
    expect(result.match!.round).not.toHaveProperty("explanation");
    expect(fixture.lookup).toHaveBeenCalledOnce();
    expect(fixture.transaction).toHaveBeenCalledOnce();
    expect(fixture.match).toHaveBeenCalledOnce();
    expect(fixture.members).toHaveBeenCalledOnce();
    expect(fixture.match.mock.calls[0]![0].select.players.select.answers.select).toEqual({ roundId: true, choice: true, acceptedAt: true });
  });

  it("shows the same orders to spectators and restores them on reconnect without opponent choices", async () => {
    fixture.member.mockResolvedValue({ id: id(5), spectating: true });
    const first = await state.read(identity, id(1));
    const reconnected = await state.read(identity, id(1));
    expect(first.match!.playing).toBe(false);
    expect(first.match!.ownAnswer).toBeNull();
    expect(first.match!.leaderboard.map((player) => player.answerOrder)).toEqual([2, 1, null]);
    expect(reconnected.match!.leaderboard).toEqual(first.match!.leaderboard);
    expect(JSON.stringify(first)).not.toMatch(/"choice":|"acceptedAt":|PRIVATE_EXPLANATION|"correctChoice":/);
  });

  it.each([0, 39000, 77000])("clears prior-round status at countdown, new round and finish (now=%s)", async (now) => {
    fixture.now.mockResolvedValue(new Date(now));
    const result = await state.read(identity, id(1));
    expect(result.match!.leaderboard.every((player) => player.answerOrder === null)).toBe(true);
  });

  it("keeps orders available during reveal", async () => {
    fixture.now.mockResolvedValue(new Date(31000));
    const result = await state.read(identity, id(1));
    expect(result.match!.phase.type).toBe("REVEAL");
    expect(result.match!.leaderboard.map((player) => player.answerOrder)).toEqual([2, 1, null]);
  });
});
