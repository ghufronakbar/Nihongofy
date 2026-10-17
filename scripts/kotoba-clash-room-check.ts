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
import { createGuestCredential, createRoomCode } from "../src/features/kotoba-clash/server/guest-credential";

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
    const createInput = { nickname: "Host", requestId: randomUUID() };
    const created = await Promise.all([lobby.create(host, createInput), lobby.create(host, createInput)]);
    const original = created[0]!;
    roomIds.push(original.id);
    assert.equal(created[1]!.id, original.id);
    assert.equal(created.filter((result) => result.duplicate).length, 1);
    const other = await lobby.create(otherHost, { nickname: "Other host", requestId: randomUUID() });
    roomIds.push(other.id);
    assert.equal(await db.kotobaClashRoom.count({ where: { status: "OPEN" } }), 2);
    checks.push("Different hosts can open rooms together; concurrent retries of one create request return one room");

    const replacements = await Promise.all(Array.from({ length: 2 }, () => lobby.create(host, { nickname: "Host", requestId: randomUUID() })));
    roomIds.push(...replacements.map((result) => result.id));
    const room = await db.kotobaClashRoom.findFirstOrThrow({ where: { hostUserId: host.userId, status: "OPEN" }, select: { id: true, code: true, revision: true } });
    assert.equal(await db.kotobaClashRoom.count({ where: { hostUserId: host.userId, status: "OPEN" } }), 1);
    assert.equal((await db.kotobaClashRoom.findUniqueOrThrow({ where: { id: original.id } })).status, "CLOSED");
    assert.equal((await db.kotobaClashRoom.findUniqueOrThrow({ where: { id: other.id } })).status, "OPEN");
    await assert.rejects(lobby.create(host, createInput), codeIs("CLOSED"));
    await assert.rejects(lobby.create(otherHost, { nickname: "Hijack", requestId: room.id }), codeIs("HOST_REQUIRED"));
    assert.equal((await db.kotobaClashRoom.findUniqueOrThrow({ where: { id: room.id } })).status, "OPEN");
    checks.push("Concurrent distinct creates leave one open room per host; stale retries and another account cannot replace it");

    // A conflicting uncommitted ID fails the insert after closure; rollback must preserve the old room.
    const conflictId = randomUUID();
    roomIds.push(conflictId);
    let release!: () => void;
    let inserted!: () => void;
    const released = new Promise<void>((resolve) => { release = resolve; });
    const acquired = new Promise<void>((resolve) => { inserted = resolve; });
    const blocker = db.$transaction(async (tx) => {
      await tx.kotobaClashRoom.create({ data: { id: conflictId, code: createRoomCode(), hostUserId: otherHost.userId, status: "CLOSED", expiresAt: new Date(Date.now() + 60_000) } });
      inserted();
      await released;
    });
    try {
      await Promise.race([acquired, blocker]);
      const rejected = assert.rejects(lobby.create(host, { nickname: "Rollback", requestId: conflictId }), codeIs("HOST_REQUIRED"));
      let waiting = false;
      for (let attempt = 0; attempt < 100 && !waiting; attempt++) {
        const rows = await db.$queryRaw<{ waiting: boolean }[]>`SELECT EXISTS (
          SELECT 1 FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock'
          AND query LIKE 'INSERT INTO%KotobaClashRoom%'
        ) AS waiting`;
        waiting = rows[0]!.waiting;
        if (!waiting) await delay(10);
      }
      assert(waiting, "Replacement insert must reach the conflicting ID before rollback is tested");
      release();
      await blocker;
      await rejected;
    } finally { release(); await blocker; }
    assert.equal((await db.kotobaClashRoom.findUniqueOrThrow({ where: { id: room.id } })).status, "OPEN");
    checks.push("Failed replacement insert rolls back old-room closure in the real database");

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

    await repository.submitAnswer(g, { ...answer, choice: 2 });
    const revealed = await state.read(host, room.id);
    assert.equal(revealed.match!.phase.type, "REVEAL");
    assert.equal(revealed.match!.round!.correctChoice, 1);
    assert(revealed.match!.leaderboard.some((player) => player.score > 0));
    checks.push("The last roster answer opens reveal without waiting for the maximum deadline");

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
    const exportedPlayer = exported.flatMap((member) => member.players).find((player) => player.matchId === start.matchId)!;
    assert.equal(exportedPlayer.matchId, start.matchId);
    assert(exportedPlayer.score > 0);
    assert.equal(exportedPlayer.answers.length, 1);
    assert.equal(exportedPlayer.answers[0]!.choice, 1);
    assert(!JSON.stringify(exported).includes("private-explanation"));
    assert(!JSON.stringify(exported).includes("correctChoice"));
    assert((await getClashAccountExport(db, otherHost.userId, new Date())).every((member) => member.players.length === 0));
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

    const replacement = await lobby.create(host, { nickname: "New arena", requestId: randomUUID() });
    roomIds.push(replacement.id);
    const closed = await state.read(host, room.id);
    assert.equal(closed.closed, true);
    assert(replacement.closedRooms.some((old) => old.id === room.id && old.revision === closed.revision));
    await assert.rejects(lobby.join(guest(), { code: room.code, nickname: "Too late" }), codeIs("CLOSED"));
    const oldRound = (await db.kotobaClashRound.findFirstOrThrow({ where: { matchId: rematch.matchId }, orderBy: { position: "asc" } })).id;
    await assert.rejects(repository.submitAnswer(host, { roomId: room.id, matchId: rematch.matchId, roundId: oldRound, requestId: randomUUID(), choice: 1 }), codeIs("CLOSED"));
    assert.equal((await state.results(host, room.code, start.matchId)).review.length, 5);
    assert.equal(await db.kotobaClashAnswer.count({ where: { matchId: start.matchId } }), 2);
    assert.equal((await state.read(otherHost, other.id)).closed, false);
    checks.push("Replacing an active room closes old clients, rejects new joins/answers, preserves completed history and leaves the other host untouched");

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
