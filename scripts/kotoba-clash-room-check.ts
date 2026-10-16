import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { PrismaClashLobbyRepository } from "../src/features/kotoba-clash/server/lobby-repository";
import { PrismaClashRepository } from "../src/features/kotoba-clash/server/repository";
import { PrismaClashState } from "../src/features/kotoba-clash/server/state";
import { sampleClashQuestions } from "../src/features/kotoba-clash/server/catalog";
import { cleanupClash } from "../src/features/kotoba-clash/server/cleanup";
import { getClashAccountExport } from "../src/features/kotoba-clash/server/account-export";
import { CLASH_LEASE_SCRIPT } from "../src/features/kotoba-clash/server/presence";
import { createGuestCredential } from "../src/features/kotoba-clash/server/guest-credential";

const url = z.url().parse(process.argv[2]);
const parsed = new URL(url);
assert(["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname) && parsed.pathname.startsWith("/kotoba_"), "Only a disposable local kotoba_ database is allowed.");
const redisPort = z.coerce.number().int().min(1024).max(65535).parse(process.argv[3] ?? 56379);
const db = new PrismaClient({ datasourceUrl: url });
const lobby = new PrismaClashLobbyRepository(db);
const repository = new PrismaClashRepository(db);
const state = new PrismaClashState(db, repository);
const checks: string[] = [];
const userIds: number[] = [];
const roomIds: string[] = [];
let packageId: number | undefined;
const config = { jlptLevel: "N5" as const, mondaiTypes: ["MOJI_GOI_CONTEXT" as const, "MOJI_GOI_SYNONYM" as const], questionCount: 5 as const };
const codeIs = (code: string) => (error: unknown) => error instanceof Error && "code" in error && error.code === code;
function guest() { const credential = createGuestCredential(Date.now()); return { kind: "guest" as const, hash: credential.hash, expiresAt: credential.expiresAt }; }

async function main() {
  try {
    for (let index = 0; index < 2; index++) {
      const user = await db.user.create({ data: { username: `kc_${randomUUID().replaceAll("-", "").slice(0, 18)}`, displayName: `Room checker ${index}` }, select: { id: true } });
      userIds.push(user.id);
    }
    const host = { kind: "account" as const, userId: userIds[0]! };
    const otherHost = { kind: "account" as const, userId: userIds[1]! };
    const created = await Promise.all([lobby.create(host, { nickname: "Host" }), lobby.create(host, { nickname: "Host" })]);
    const room = created[0]!;
    roomIds.push(room.id);
    assert.equal(created[1]!.id, room.id);
    await assert.rejects(lobby.create(otherHost, { nickname: "Other host" }), codeIs("CAPACITY"));
    checks.push("Concurrent create is idempotent; global one-room admission is atomic");

    const g = guest();
    const joined = await Promise.all([lobby.join(g, { code: room.code, nickname: "Guest" }), lobby.join(g, { code: room.code, nickname: "Guest" })]);
    assert.equal(joined[0]!.memberId, joined[1]!.memberId);
    await assert.rejects(lobby.join(guest(), { code: room.code, nickname: "  GUEST  " }), codeIs("NICKNAME_TAKEN"));
    await assert.rejects(state.read(guest(), room.id), codeIs("UNAUTHORIZED"));
    await assert.rejects(lobby.configure(g, { roomId: room.id, configRevision: 0, config }), codeIs("HOST_REQUIRED"));
    checks.push("Guest resume preserves one membership; normalized nickname collision and unrelated reads are rejected");

    const fixture = await db.testPackage.create({ data: { name: `Kotoba check ${randomUUID()}`, jlptLevel: "N5" }, select: { id: true } });
    packageId = fixture.id;
    for (const [index, type] of config.mondaiTypes.entries()) {
      const item = await db.testPackageItem.create({ data: { testPackageId: fixture.id, mondaiType: type, section: "MOJI_GOI", session: 1, order: index + 1 }, select: { id: true } });
      for (let n = 0; n < 7; n++) await db.question.create({ data: {
        testPackageItemId: item.id, order: n + 1, questionText: `{食事|しょくじ} fixture-${index}-${n}`,
        questionAnswer: 1, questionAudio: n === 6 ? "https://example.com/audio.mp3" : null,
        questionChoices: { create: [{ codeAnswer: 1, answerText: "One" }, { codeAnswer: 2, answerText: "Two" }] },
        explanation: { create: { summary: `private-explanation-${index}-${n}`, translation: "Fixture", source: "IMPORTED", keyPoints: [] } },
      }, select: { id: true } });
    }
    const assignments = await sampleClashQuestions(config, db);
    assert.equal(new Set(assignments.map((row) => row.question.sourceQuestionId)).size, 5);
    const counts = config.mondaiTypes.map((type) => assignments.filter((row) => row.question.mondaiType === type).length);
    assert(Math.abs(counts[0]! - counts[1]!) <= 1);
    assert(assignments.every((row) => !row.question.content.text.endsWith("-6")));
    await assert.rejects(sampleClashQuestions({ ...config, questionCount: 20 }, db), codeIs("INVALID_QUESTIONS"));
    checks.push("Server sampling is unique and balanced, excludes audio, and rejects insufficient stock");

    await lobby.configure(host, { roomId: room.id, configRevision: 0, config });
    await lobby.ready(host, { roomId: room.id, configRevision: 1, ready: true });
    await lobby.ready(g, { roomId: room.id, configRevision: 1, ready: true });
    await lobby.configure(host, { roomId: room.id, configRevision: 1, config });
    assert((await state.read(host, room.id)).members.every((member) => !member.ready));
    await assert.rejects(lobby.ready(g, { roomId: room.id, configRevision: 1, ready: true }), codeIs("STALE_CONFIG"));
    await lobby.ready(host, { roomId: room.id, configRevision: 2, ready: true });
    await lobby.ready(g, { roomId: room.id, configRevision: 2, ready: true });
    const before = await state.read(host, room.id);
    const roster = before.members.map((member) => member.id);
    await assert.rejects(repository.start(host, { roomId: room.id, configRevision: 2, requestId: randomUUID() }, assignments, [roster[0]!]), codeIs("NOT_READY"));
    const start = await repository.start(host, { roomId: room.id, configRevision: 2, requestId: randomUUID() }, assignments, roster);
    assert.equal((await state.read(host, room.id)).match!.round, null);
    checks.push("Config resets all ready states; stale ready and a disconnected roster cannot Start; countdown hides content");

    const late = guest();
    await lobby.join(late, { code: room.code, nickname: "Late guest" });
    assert.equal((await state.read(late, room.id)).viewer.spectating, true);
    const concurrent = await Promise.allSettled(Array.from({ length: 7 }, (_, index) => lobby.join(guest(), { code: room.code, nickname: `Spectator ${index}` })));
    assert.equal(concurrent.filter((result) => result.status === "fulfilled").length, 4);
    await assert.rejects(state.results(host, room.code, start.matchId), codeIs("NOT_FOUND"));
    checks.push("Late arrivals spectate; concurrent spectator admission respects five slots; unfinished results remain private");

    const rounds = await db.kotobaClashRound.findMany({ where: { matchId: start.matchId }, orderBy: { position: "asc" }, select: { id: true } });
    await db.kotobaClashRound.update({ where: { id: rounds[0]!.id }, data: { startsAt: new Date(Date.now() - 1000), endsAt: new Date(Date.now() + 5000), revealEndsAt: new Date(Date.now() + 13000) } });
    const answer = { roomId: room.id, matchId: start.matchId, roundId: rounds[0]!.id, requestId: randomUUID(), choice: 1 };
    await repository.submitAnswer(host, answer);
    await repository.submitAnswer(g, { ...answer, choice: 2 });
    await assert.rejects(repository.submitAnswer(late, answer), codeIs("NOT_PLAYING"));
    const running = await state.read(host, room.id);
    assert.equal(running.match!.ownAnswer!.choice, 1);
    assert(!("correctChoice" in running.match!.round!));
    assert(!("explanation" in running.match!.round!));
    assert(!running.match!.round!.content.text.includes("しょくじ"));
    assert(running.match!.leaderboard.every((player) => player.score === 0));
    assert(!JSON.stringify(running).includes("private-explanation"));
    assert((await getClashAccountExport(db, host.userId, new Date())).every((member) => member.players.length === 0));
    checks.push("Active projection hides keys, explanations, furigana, opponent choices and active-round points");

    await delay(30);
    const accepted = await db.kotobaClashAnswer.findMany({ where: { matchId: start.matchId }, select: { acceptedAt: true } });
    const lastAnswer = Math.max(...accepted.map((row) => row.acceptedAt.getTime()));
    for (const [index, round] of rounds.entries()) {
      const startsAt = index === 0 ? lastAnswer - 1000 : lastAnswer + index * 3;
      const endsAt = index === 0 ? lastAnswer + 1 : startsAt + 1;
      await db.kotobaClashRound.update({ where: { id: round.id }, data: { startsAt: new Date(startsAt), endsAt: new Date(endsAt), revealEndsAt: new Date(endsAt + 1) } });
    }
    await db.kotobaClashMatch.update({ where: { id: start.matchId }, data: { endsAt: new Date(lastAnswer + 20) } });
    const exported = await getClashAccountExport(db, host.userId, new Date());
    const exportedPlayer = exported[0]!.players[0]!;
    assert.equal(exportedPlayer.matchId, start.matchId);
    assert(exportedPlayer.score > 0);
    assert.equal(exportedPlayer.answers.length, 1);
    assert.equal(exportedPlayer.answers[0]!.choice, 1);
    assert(!JSON.stringify(exported).includes("private-explanation"));
    assert(!JSON.stringify(exported).includes("correctChoice"));
    assert.equal((await getClashAccountExport(db, otherHost.userId, new Date())).length, 0);
    assert.equal((await db.kotobaClashMatch.findUniqueOrThrow({ where: { id: start.matchId }, select: { status: true } })).status, "RUNNING");
    checks.push("Account export includes completed offline schedules, rebuilds own score and excludes active matches, keys and other players");
    const finished = await state.read(host, room.id);
    assert.equal(finished.match!.phase.type, "FINISHED");
    assert(finished.match!.leaderboard[0]!.score > 0);
    const review = await state.results(host, room.code, start.matchId);
    assert.equal(review.review.length, 5);
    assert(review.review.every((row) => row.round.correctChoice === 1));
    assert.equal(review.review[0]!.ownChoice, 1);
    await lobby.participate(late, { roomId: room.id });
    await lobby.ready(host, { roomId: room.id, configRevision: 2, ready: true });
    await lobby.ready(g, { roomId: room.id, configRevision: 2, ready: true });
    const rematch = await repository.start(host, { roomId: room.id, configRevision: 2, requestId: randomUUID() }, await sampleClashQuestions(config, db), roster);
    assert.notEqual(rematch.matchId, start.matchId);
    assert.equal((await state.results(host, room.code, start.matchId)).state.match!.id, start.matchId);
    assert.equal((await state.read(host, room.id)).code, room.code);
    checks.push("Read recovers finalization; completed review is scoped; spectator can opt in; rematch preserves code and old result URL");

    await db.kotobaClashRoomMember.update({ where: { id: joined[0]!.memberId }, data: { guestExpiresAt: new Date(Date.now() - 1) } });
    const cleanup = await cleanupClash(db, new Date());
    assert.equal(cleanup.roomsDeleted, 0);
    assert.equal(cleanup.matchesDeleted, 0);
    assert.equal(cleanup.guestsAnonymized, 1);
    const expiredGuest = await db.kotobaClashRoomMember.findUniqueOrThrow({ where: { id: joined[0]!.memberId } });
    assert.equal(expiredGuest.guestHash, null);
    assert.equal(expiredGuest.nicknameKey, null);
    assert.notEqual(expiredGuest.nickname, "Guest");
    assert.equal(await db.kotobaClashMatchPlayer.count({ where: { matchId: start.matchId } }), 2);
    checks.push("Cleanup preserves active matches and unexpired results; expired guest identity is anonymized without deleting score ledgers");

    const key = `kotoba-local-check:${randomUUID()}`;
    const run = (operation: string, owner: string) => execFileSync("redis-cli", ["-h", "127.0.0.1", "-p", String(redisPort), "--raw", "EVAL", CLASH_LEASE_SCRIPT, "1", key, String(Date.now()), roster[0]!, owner, operation, "60000"], { encoding: "utf8" }).trim();
    const oldOwner = randomUUID(); const newOwner = randomUUID();
    try {
      assert.equal(run("acquire", oldOwner), "1");
      assert.equal(run("acquire", newOwner), "1");
      assert.equal(run("renew", oldOwner), "0");
      assert.equal(run("release", oldOwner), "0");
      assert.equal(run("renew", newOwner), "1");
      assert.equal(run("release", newOwner), "1");
    } finally { execFileSync("redis-cli", ["-h", "127.0.0.1", "-p", String(redisPort), "DEL", key]); }
    checks.push("Real Redis Lua: authenticated takeover is immediate; old owner cannot renew or release replacement");
    console.log(JSON.stringify({ status: "PASS", checks }, null, 2));
  } finally {
    await db.kotobaClashRoom.deleteMany({ where: { id: { in: roomIds } } });
    if (packageId) await db.testPackage.delete({ where: { id: packageId } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    await db.$disconnect();
  }
}
void main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
