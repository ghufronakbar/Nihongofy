import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { type ClashAssignment, type ClashIdentity } from "../src/features/kotoba-clash/domain/ports";
import { correctAnswerPoints } from "../src/features/kotoba-clash/domain/engine";
import { CLASH_DURATIONS_MS } from "../src/features/kotoba-clash/domain/rules";
import { clashRoomMode } from "../src/features/kotoba-clash/schemas";
import type { ClashRoomSnapshot } from "../src/features/kotoba-clash/contracts";
import { PrismaClashLobbyRepository } from "../src/features/kotoba-clash/server/lobby-repository";
import { PrismaClashRepository } from "../src/features/kotoba-clash/server/repository";
import { PrismaClashState } from "../src/features/kotoba-clash/server/state";
import { createGuestCredential } from "../src/features/kotoba-clash/server/guest-credential";

// All fixture writes require an explicit disposable loopback database.
const url = z.url().parse(process.argv[2]);
const target = new URL(url);
assert(["127.0.0.1", "localhost", "[::1]"].includes(target.hostname));
assert(target.pathname.startsWith("/kotoba_"));
const db = new PrismaClient({ datasourceUrl: url });
const lobby = new PrismaClashLobbyRepository(db);
const repository = new PrismaClashRepository(db);
const state = new PrismaClashState(db, repository);
const userIds: number[] = [];
const checks: string[] = [];
const config = { mode: "solo" as const, jlptLevel: "N5" as const, mondaiTypes: ["MOJI_GOI_CONTEXT" as const], questionCount: 5 as const };
const codeIs = (code: string) => (error: unknown) => error instanceof Error && "code" in error && error.code === code;
const assignments = (): ClashAssignment[] => Array.from({ length: 5 }, (_, index) => ({ id: randomUUID(), question: {
  sourceQuestionId: index + 1, mondaiType: "MOJI_GOI_CONTEXT", correctChoice: 1, explanation: "Solo fixture review",
  content: { instruction: null, text: `Fixture ${index + 1}`, image: null, context: null,
    choices: [{ code: 1, text: "One", image: null }, { code: 2, text: "Two", image: null }] },
} }));

async function main() {
  try {
    for (let index = 0; index < 2; index++) {
      const user = await db.user.create({ data: { username: `solo_${randomUUID().replaceAll("-", "").slice(0, 18)}`, displayName: "Solo fixture" }, select: { id: true } });
      userIds.push(user.id);
    }
    const owner: ClashIdentity = { kind: "account", userId: userIds[0]! };
    const outsider: ClashIdentity = { kind: "account", userId: userIds[1]! };
    const credential = createGuestCredential(Date.now());
    const guest: ClashIdentity = { kind: "guest", hash: credential.hash, expiresAt: credential.expiresAt };
    const create = { nickname: "Solo", mode: "solo", requestId: randomUUID() };
    await assert.rejects(lobby.create(guest, create), codeIs("HOST_REQUIRED"));
    const created = await Promise.all([lobby.create(owner, create), lobby.create(owner, create)]);
    assert.equal(created[0]!.id, created[1]!.id);
    assert.equal(created.filter((result) => result.duplicate).length, 1);
    const room = created[0]!;
    let snapshot = await state.read(owner, room.id);
    assert.equal(snapshot.mode, "solo");
    assert.equal(snapshot.config, null);
    const memberId = snapshot.viewer.memberId;
    await assert.rejects(lobby.ready(owner, { roomId: room.id, configRevision: 0, ready: true }), codeIs("STALE_CONFIG"));
    await assert.rejects(repository.start(owner, { roomId: room.id, configRevision: 0, requestId: randomUUID() }, assignments(), [memberId]), codeIs("STALE_CONFIG"));
    await assert.rejects(lobby.create(owner, { ...create, mode: "multiplayer" }), codeIs("MODE_MISMATCH"));
    for (const identity of [outsider, guest]) {
      await assert.rejects(lobby.join(identity, { code: room.code, nickname: "Outsider" }), codeIs("SOLO_PRIVATE"));
      await assert.rejects(state.read(identity, room.id), codeIs("SOLO_PRIVATE"));
    }
    assert.equal((await lobby.join(owner, { code: room.code, nickname: "Resume" })).memberId, memberId);
    checks.push("Concurrent create is idempotent; private solo rejects accounts/guests and resumes its owner");

    await assert.rejects(lobby.configure(owner, { roomId: room.id, configRevision: 0, config: { ...config, mode: "multiplayer" } }), codeIs("MODE_MISMATCH"));
    await lobby.configure(owner, { roomId: room.id, configRevision: 0, config });
    const start = { roomId: room.id, configRevision: 1, requestId: randomUUID() };
    await assert.rejects(repository.start(owner, start, assignments(), []), codeIs("NOT_READY"));
    const questions = assignments();
    const starts = await Promise.all([repository.start(owner, start, questions, [memberId]), repository.start(owner, start, questions, [memberId])]);
    assert.equal(starts[0]!.matchId, starts[1]!.matchId);
    assert.equal(starts.filter((result) => result.duplicate).length, 1);
    const matchId = starts[0]!.matchId;
    assert.equal(await db.kotobaClashMatchPlayer.count({ where: { matchId } }), 1);
    assert.equal((await db.kotobaClashRoomMember.findUniqueOrThrow({ where: { id: memberId } })).readyRevision, null);
    snapshot = await state.read(owner, room.id);
    assert.equal(snapshot.match!.phase.type, "COUNTDOWN");
    assert.equal(snapshot.match!.round, null);
    checks.push("One connected owner starts without ready; concurrent Start freezes one roster/match");

    await delay(Math.max(0, snapshot.match!.phase.type === "COUNTDOWN" ? snapshot.match!.phase.endsAt - Date.now() + 5 : 0));
    let expectedScore = 0;
    let correctCount = 0;
    let wrongCount = 0;
    let streak = 0;
    for (let position = 1; position <= 5; position++) {
      snapshot = await state.read(owner, room.id);
      const round: NonNullable<NonNullable<ClashRoomSnapshot["match"]>["round"]> = snapshot.match!.round!;
      assert.equal(snapshot.match!.phase.type, "QUESTION");
      assert.equal(round.position, position);
      assert(!("correctChoice" in round));
      assert(!("explanation" in round));
      const input = { roomId: room.id, matchId, roundId: round.id, requestId: randomUUID(), choice: position === 2 ? 2 : 1 };
      const answers: Awaited<ReturnType<PrismaClashRepository["submitAnswer"]>>[] = await Promise.all([repository.submitAnswer(owner, input), repository.submitAnswer(owner, input)]);
      assert.equal(answers.filter((answer) => answer.duplicate).length, 1);
      assert.equal(answers[0]!.acceptedAt, answers[1]!.acceptedAt);
      assert(!JSON.stringify(answers).match(/correct|score|streak|explanation/i));
      await assert.rejects(repository.submitAnswer(owner, { ...input, choice: input.choice === 1 ? 2 : 1 }), codeIs("ALREADY_ANSWERED"));
      if (input.choice === 1) {
        correctCount++;
        expectedScore += correctAnswerPoints(CLASH_DURATIONS_MS.MOJI_GOI_CONTEXT, answers[0]!.acceptedAt - round.startsAt, ++streak);
      } else { wrongCount++; streak = 0; }
      await delay(5);
      const revealed = await state.read(owner, room.id);
      assert.equal(revealed.match!.phase.type, "REVEAL");
      assert.equal(revealed.match!.round!.correctChoice, 1);
      assert.equal(revealed.match!.round!.explanation, "Solo fixture review");
      assert(revealed.match!.round!.endsAt < round.endsAt);
      assert.equal(revealed.match!.leaderboard[0]!.score, expectedScore);
      assert.equal(revealed.match!.leaderboard[0]!.correctCount, correctCount);
      assert.equal(revealed.match!.leaderboard[0]!.wrongCount, wrongCount);
      await delay(Math.max(0, revealed.match!.round!.revealEndsAt - Date.now() + 5));
    }
    const results = await state.results(owner, room.code, matchId);
    assert.equal(results.state.match!.phase.type, "FINISHED");
    assert.equal(results.review.length, 5);
    assert.equal(results.state.match!.leaderboard[0]!.bestStreak, 3);
    assert.equal(results.state.match!.leaderboard[0]!.score, expectedScore);
    checks.push("Five solo rounds reveal immediately after correct/wrong answers; retry, score, streak and completed review agree");

    const rematch = await repository.start(owner, { ...start, requestId: randomUUID() }, assignments(), [memberId]);
    assert.notEqual(rematch.matchId, matchId);
    assert.equal((await state.results(owner, room.code, matchId)).state.match!.id, matchId);
    const rounds = await db.kotobaClashRound.findMany({ where: { matchId: rematch.matchId }, orderBy: { position: "asc" } });
    // An unanswered fixture can be expired without rewriting any accepted answer timestamps.
    const shift = rounds.at(-1)!.revealEndsAt.getTime() - Date.now() + 100;
    await db.$executeRaw`UPDATE "KotobaClashRound" SET
      "startsAt" = "startsAt" - ${shift}::bigint * INTERVAL '1 millisecond',
      "endsAt" = "endsAt" - ${shift}::bigint * INTERVAL '1 millisecond',
      "revealEndsAt" = "revealEndsAt" - ${shift}::bigint * INTERVAL '1 millisecond'
      WHERE "matchId" = ${rematch.matchId}::uuid`;
    await db.kotobaClashMatch.update({ where: { id: rematch.matchId }, data: { startsAt: new Date(Date.now() - shift), endsAt: new Date(Date.now() - 100) } });
    const skipped = await state.results(owner, room.code, rematch.matchId);
    assert.equal(skipped.state.match!.leaderboard[0]!.skippedCount, 5);
    assert.equal(skipped.state.match!.leaderboard[0]!.score, 0);
    checks.push("Solo rematch needs no ready; historic review persists; unanswered timeouts score zero");

    const multi = await lobby.create(outsider, { nickname: "Multi", requestId: randomUUID() });
    const multiConfig = { ...config, mode: "multiplayer" };
    await lobby.configure(outsider, { roomId: multi.id, configRevision: 0, config: multiConfig });
    await lobby.ready(outsider, { roomId: multi.id, configRevision: 1, ready: true });
    await assert.rejects(repository.start(outsider, { roomId: multi.id, configRevision: 1, requestId: randomUUID() }, assignments()), codeIs("NOT_READY"));
    await assert.rejects(lobby.configure(outsider, { roomId: multi.id, configRevision: 1, config }), codeIs("MODE_MISMATCH"));
    assert.equal(clashRoomMode(null), "multiplayer");
    assert.equal(clashRoomMode({ jlptLevel: "N5" }), "multiplayer");
    checks.push("Multiplayer still requires two ready players and cannot switch to solo; legacy configs stay multiplayer");
    console.log(JSON.stringify({ passed: true, checks }, null, 2));
  } finally {
    await db.kotobaClashRoom.deleteMany({ where: { hostUserId: { in: userIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    await db.$disconnect();
  }
}
void main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
