import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { correctAnswerPoints } from "../src/features/kotoba-clash/domain/engine";
import type { ClashAssignment, ClashIdentity } from "../src/features/kotoba-clash/domain/ports";
import { CLASH_RETENTION_MS, CLASH_REVEAL_MS } from "../src/features/kotoba-clash/domain/rules";
import { PrismaClashRepository } from "../src/features/kotoba-clash/server/repository";
import { PrismaClashState } from "../src/features/kotoba-clash/server/state";
import { createGuestCredential, createRoomCode } from "../src/features/kotoba-clash/server/guest-credential";
import { getClashAccountExport } from "../src/features/kotoba-clash/server/account-export";

// Explicit disposable loopback target; this checker never migrates or writes production.
const url = z.url().parse(process.argv[2]);
const target = new URL(url);
assert(["127.0.0.1", "localhost", "[::1]"].includes(target.hostname));
assert(target.pathname.startsWith("/kotoba_"));
const db = new PrismaClient({ datasourceUrl: url });
const repository = new PrismaClashRepository(db);
const state = new PrismaClashState(db, repository);
const roomIds: string[] = [];
const userIds: number[] = [];
const checks: string[] = [];
const config = { jlptLevel: "N5" as const, mondaiTypes: ["MOJI_GOI_CONTEXT" as const], questionCount: 5 as const };
const codeIs = (code: string) => (error: unknown) => error instanceof Error && "code" in error && error.code === code;
const assignments = (): ClashAssignment[] => Array.from({ length: 5 }, (_, i) => ({ id: randomUUID(), question: {
  sourceQuestionId: i + 1, mondaiType: "MOJI_GOI_CONTEXT", correctChoice: 1, explanation: "Fixture review",
  content: { instruction: null, text: `Fixture ${i + 1}`, image: null, context: null,
    choices: [{ code: 1, text: "One", image: null }, { code: 2, text: "Two", image: null }] },
} }));
const dates = (matchId: string) => db.kotobaClashRound.findMany({ where: { matchId }, orderBy: { position: "asc" },
  select: { id: true, startsAt: true, endsAt: true, revealEndsAt: true } });

async function fixture(guestCount = 2) {
  const host = await db.user.create({ data: { username: `early_${randomUUID().replaceAll("-", "").slice(0, 15)}`, displayName: "Fixture host" }, select: { id: true } });
  userIds.push(host.id);
  const identity: ClashIdentity = { kind: "account", userId: host.id };
  const room = await db.kotobaClashRoom.create({ data: { code: createRoomCode(), hostUserId: host.id, config, configRevision: 1, expiresAt: new Date(Date.now() + 60_000) }, select: { id: true, code: true } });
  roomIds.push(room.id);
  const hostMember = await db.kotobaClashRoomMember.create({ data: { roomId: room.id, userId: host.id, nickname: "Host", nicknameKey: "host", readyRevision: 1 }, select: { id: true } });
  const guests: ClashIdentity[] = [];
  for (let i = 0; i <= guestCount; i++) {
    const credential = createGuestCredential(Date.now());
    guests.push({ kind: "guest", hash: credential.hash, expiresAt: credential.expiresAt });
    await db.kotobaClashRoomMember.create({ data: { roomId: room.id, guestHash: credential.hash, guestExpiresAt: new Date(credential.expiresAt), nickname: `Guest ${i}`, nicknameKey: `guest ${i}`, readyRevision: 1, spectating: i === guestCount } });
  }
  const started = await repository.start(identity, { roomId: room.id, configRevision: 1, requestId: randomUUID() }, assignments());
  return { room, identity, hostId: host.id, hostMemberId: hostMember.id, players: [identity, ...guests.slice(0, guestCount)], spectator: guests[guestCount]!, matchId: started.matchId };
}

// Move only a new, unanswered fixture's schedule to avoid waiting through countdown/elapsed time.
async function elapse(matchId: string, milliseconds: number) {
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`UPDATE "KotobaClashRound" SET
      "startsAt" = "startsAt" - ${milliseconds}::bigint * INTERVAL '1 millisecond',
      "endsAt" = "endsAt" - ${milliseconds}::bigint * INTERVAL '1 millisecond',
      "revealEndsAt" = "revealEndsAt" - ${milliseconds}::bigint * INTERVAL '1 millisecond'
      WHERE "matchId" = ${matchId}::uuid`;
    await tx.$executeRaw`UPDATE "KotobaClashMatch" SET
      "startsAt" = "startsAt" - ${milliseconds}::bigint * INTERVAL '1 millisecond',
      "endsAt" = "endsAt" - ${milliseconds}::bigint * INTERVAL '1 millisecond',
      "expiresAt" = "expiresAt" - ${milliseconds}::bigint * INTERVAL '1 millisecond'
      WHERE id = ${matchId}::uuid`;
  });
}

async function main() {
  try {
    const game = await fixture();
    assert.equal((await db.kotobaClashMatch.findUniqueOrThrow({ where: { id: game.matchId } })).rulesVersion, 2);
    await assert.rejects(db.kotobaClashMatch.update({ where: { id: game.matchId }, data: { rulesVersion: 3 } }));
    assert.equal((await state.read(game.identity, game.room.id)).match!.phase.type, "COUNTDOWN");
    await elapse(game.matchId, 6_000);
    const original = await dates(game.matchId);
    const originalMatch = await db.kotobaClashMatch.findUniqueOrThrow({ where: { id: game.matchId } });
    const first = original[0]!;
    const input = { roomId: game.room.id, matchId: game.matchId, roundId: first.id, choice: 1, requestId: randomUUID() };
    const firstAck = await repository.submitAnswer(game.players[0]!, input);
    await repository.submitAnswer(game.players[1]!, { ...input, choice: 2 });
    await assert.rejects(repository.submitAnswer(game.spectator, input), codeIs("NOT_PLAYING"));
    const waiting = await state.read(game.identity, game.room.id);
    assert.equal(waiting.match!.phase.type, "QUESTION");
    assert(!("correctChoice" in waiting.match!.round!));
    assert(!("explanation" in waiting.match!.round!));
    assert(waiting.match!.leaderboard.every((player) => player.score === 0));
    assert.deepEqual(await dates(game.matchId), original);
    checks.push("Roster quorum includes the missing/offline player and excludes spectator; partial answers keep keys/points private");

    const last = { ...input, requestId: randomUUID() };
    const acks = await Promise.all([repository.submitAnswer(game.players[2]!, last), repository.submitAnswer(game.players[2]!, last), repository.submitAnswer(game.identity, input)]);
    assert.equal(acks.slice(0, 2).filter((ack) => ack.duplicate).length, 1);
    assert.equal(acks[0]!.acceptedAt, acks[1]!.acceptedAt);
    assert(!JSON.stringify(acks).match(/correct|score|streak|explanation/i));
    const accelerated = await dates(game.matchId);
    const cutoff = acks[0]!.acceptedAt + 1;
    const savedMs = first.endsAt.getTime() - cutoff;
    assert(savedMs > 0);
    assert.equal(accelerated[0]!.endsAt.getTime(), cutoff);
    assert.equal(accelerated[0]!.revealEndsAt.getTime(), cutoff + CLASH_REVEAL_MS);
    for (let i = 1; i < accelerated.length; i++) {
      assert.equal(accelerated[i]!.startsAt.getTime(), original[i]!.startsAt.getTime() - savedMs);
      assert.equal(accelerated[i]!.endsAt.getTime(), original[i]!.endsAt.getTime() - savedMs);
      assert.equal(accelerated[i]!.startsAt.getTime(), accelerated[i - 1]!.revealEndsAt.getTime());
    }
    const shortenedMatch = await db.kotobaClashMatch.findUniqueOrThrow({ where: { id: game.matchId } });
    assert.equal(shortenedMatch.endsAt.getTime(), originalMatch.endsAt.getTime() - savedMs);
    assert.equal(shortenedMatch.expiresAt.getTime(), shortenedMatch.endsAt.getTime() + CLASH_RETENTION_MS);
    await repository.submitAnswer(game.players[2]!, last);
    assert.deepEqual(await dates(game.matchId), accelerated);
    await assert.rejects(repository.submitAnswer(game.players[2]!, { ...last, choice: 2 }), codeIs("ALREADY_ANSWERED"));
    checks.push("Concurrent last-answer/retry shifts schedule exactly once; exclusive cutoff, 8-second reveal, future continuity and retention persist");

    const resumed = await new PrismaClashState(db, repository).read(game.identity, game.room.id);
    assert.equal(resumed.match!.phase.type, "REVEAL");
    assert.equal(resumed.match!.round!.correctChoice, 1);
    const ownScore = resumed.match!.leaderboard.find((player) => player.memberId === game.hostMemberId)!;
    assert.equal(ownScore.score, correctAnswerPoints(30_000, firstAck.acceptedAt - first.startsAt.getTime(), 1));
    assert.equal((await state.read(game.spectator, game.room.id)).match!.phase.type, "REVEAL");
    checks.push("Fresh state/reconnect and spectator see the persisted reveal; speed bonus still uses the original 30-second maximum");

    // Run the remaining rounds through actual reveal intervals and fresh server reads.
    for (let position = 2; position <= 5; position++) {
      const previous = (await dates(game.matchId))[position - 2]!;
      await delay(Math.max(0, previous.revealEndsAt.getTime() - Date.now() + 20));
      const current = await state.read(game.identity, game.room.id);
      assert.equal(current.match!.phase.type, "QUESTION");
      assert.equal(current.match!.round!.position, position);
      const nextInput = { ...input, roundId: current.match!.round!.id, requestId: randomUUID() };
      await Promise.all(game.players.map((identity) => repository.submitAnswer(identity, nextInput)));
      assert.equal((await state.read(game.identity, game.room.id)).match!.phase.type, "REVEAL");
    }
    const finalRound = (await dates(game.matchId)).at(-1)!;
    await delay(Math.max(0, finalRound.revealEndsAt.getTime() - Date.now() + 20));
    const finished = await state.read(game.identity, game.room.id);
    assert.equal(finished.match!.phase.type, "FINISHED");
    const scores = await db.kotobaClashMatchPlayer.findMany({ where: { matchId: game.matchId } });
    const stored = scores.find((player) => player.memberId === game.hostMemberId)!;
    const leaderboard = finished.match!.leaderboard.find((player) => player.memberId === game.hostMemberId)!;
    assert.equal(stored.score, leaderboard.score);
    assert.equal(stored.correctCount, 5);
    assert.equal((await repository.reconcile(game.identity, game.room.id, game.matchId)).changed, false);
    assert.equal((await state.results(game.identity, game.room.code, game.matchId)).review.length, 5);
    const exported = (await getClashAccountExport(db, game.hostId, new Date())).flatMap((member) => member.players).find((player) => player.matchId === game.matchId)!;
    assert.equal(exported.score, stored.score);
    assert.equal(exported.answers.length, 5);
    checks.push("Five accelerated rounds finish with real 8-second reveals; final leaderboard, persisted totals, review and private account export agree");

    for (const rulesVersion of [1, 2]) {
      const fallback = await fixture(1);
      await db.kotobaClashMatch.update({ where: { id: fallback.matchId }, data: { rulesVersion } });
      await elapse(fallback.matchId, 34_000);
      const before = await dates(fallback.matchId);
      const request = { roomId: fallback.room.id, matchId: fallback.matchId, roundId: before[0]!.id, choice: 1, requestId: randomUUID() };
      await repository.submitAnswer(fallback.identity, request);
      if (rulesVersion === 1) await repository.submitAnswer(fallback.players[1]!, request);
      assert.equal((await state.read(fallback.identity, fallback.room.id)).match!.phase.type, "QUESTION");
      assert.deepEqual(await dates(fallback.matchId), before);
      await delay(Math.max(0, before[0]!.endsAt.getTime() - Date.now() + 20));
      const normal = await state.read(fallback.identity, fallback.room.id);
      assert.equal(normal.match!.phase.type, "REVEAL");
      assert.equal(normal.match!.round!.endsAt, before[0]!.endsAt.getTime());
      if (rulesVersion === 2) assert(normal.match!.leaderboard.some((player) => player.skippedCount === 1));
      await assert.rejects(repository.submitAnswer(fallback.players[1]!, { ...request, choice: 2 }), codeIs(rulesVersion === 1 ? "ALREADY_ANSWERED" : "OUTSIDE_WINDOW"));
    }
    checks.push("Missing v2 player still waits for the normal deadline; legacy v1 never accelerates even when all answer; late/changed answers are rejected");
    console.log(JSON.stringify({ status: "PASS", checks }, null, 2));
  } finally {
    await db.kotobaClashRoom.deleteMany({ where: { id: { in: roomIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    await db.$disconnect();
  }
}

void main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
