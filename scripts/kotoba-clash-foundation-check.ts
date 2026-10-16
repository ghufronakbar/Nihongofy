import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { PrismaClashRepository } from "../src/features/kotoba-clash/server/repository";
import { anonymizeAccount } from "../src/features/auth/lib/anonymize-account";
import { createGuestCredential, createRoomCode } from "../src/features/kotoba-clash/server/guest-credential";
import type { ClashAssignment } from "../src/features/kotoba-clash/domain/ports";
import { nicknameKey } from "../src/features/kotoba-clash/schemas";

// This checker only accepts a disposable local database; it never runs migrations itself.
const url = z.url().parse(process.argv[2]);
const parsed = new URL(url);
assert(["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname), "Only loopback PostgreSQL is allowed.");
assert(parsed.pathname.startsWith("/kotoba_"), "Use a disposable kotoba_ database.");
const db = new PrismaClient({ datasourceUrl: url });
const repository = new PrismaClashRepository(db);
const roomIds: string[] = [];
const userIds: number[] = [];
const checks: string[] = [];
const config = { jlptLevel: "N5" as const, mondaiTypes: ["MOJI_GOI_CONTEXT" as const], questionCount: 5 as const };
const guest = createGuestCredential(Date.now());
const guestIdentity = { kind: "guest" as const, hash: guest.hash, expiresAt: guest.expiresAt };
const isCode = (code: string) => (error: unknown) => error instanceof Error && "code" in error && error.code === code;

function assignments(): ClashAssignment[] {
  return Array.from({ length: 5 }, (_, index) => ({
    id: randomUUID(), question: {
      sourceQuestionId: index + 1, mondaiType: "MOJI_GOI_CONTEXT", correctChoice: 1, explanation: null,
      content: { instruction: null, text: `Question ${index + 1}`, image: null, context: null,
        choices: [{ code: 1, text: "One", image: null }, { code: 2, text: "Two", image: null }] },
    },
  }));
}

async function main() {
  try {
    const host = await db.user.create({ data: { username: `kc_${randomUUID().replaceAll("-", "").slice(0, 18)}`, displayName: "Fixture host" }, select: { id: true } });
    userIds.push(host.id);
    const identity = { kind: "account" as const, userId: host.id };
    const room = await db.kotobaClashRoom.create({ data: {
      code: createRoomCode(), hostUserId: host.id, config, configRevision: 1, expiresAt: new Date(Date.now() + 60_000),
    }, select: { id: true } });
    roomIds.push(room.id);
    const hostMember = await db.kotobaClashRoomMember.create({ data: { roomId: room.id, userId: host.id, nickname: "Host", nicknameKey: "host", readyRevision: 1 }, select: { id: true } });
    const guestMember = await db.kotobaClashRoomMember.create({ data: { roomId: room.id, guestHash: guest.hash, guestExpiresAt: new Date(guest.expiresAt), nickname: "Guest", nicknameKey: "guest", readyRevision: 1 }, select: { id: true } });
    const start = { roomId: room.id, configRevision: 1, requestId: randomUUID() };
    const questions = assignments();
    const starts = await Promise.all([repository.start(identity, start, questions), repository.start(identity, start, questions)]);
    assert.equal(starts[0]!.matchId, starts[1]!.matchId);
    assert.equal(starts.filter((result) => result.duplicate).length, 1);
    assert.equal(await db.kotobaClashMatch.count({ where: { roomId: room.id } }), 1);
    assert.equal(await db.kotobaClashMatchPlayer.count({ where: { matchId: starts[0]!.matchId } }), 2);
    checks.push("Concurrent Start: one match and one frozen roster");

    const matchId = starts[0]!.matchId;
    const rounds = await db.kotobaClashRound.findMany({ where: { matchId }, orderBy: { position: "asc" }, select: { id: true } });
    const input = { roomId: room.id, matchId, roundId: rounds[0]!.id, requestId: randomUUID(), choice: 1 };
    await assert.rejects(repository.submitAnswer(identity, input), isCode("OUTSIDE_WINDOW"));
    await db.kotobaClashRound.update({ where: { id: rounds[0]!.id }, data: { startsAt: new Date(Date.now() - 1_000), endsAt: new Date(Date.now() + 10_000), revealEndsAt: new Date(Date.now() + 18_000) } });
    const acks = await Promise.all([repository.submitAnswer(identity, input), repository.submitAnswer(identity, input)]);
    assert.equal(acks.filter((ack) => ack.duplicate).length, 1);
    assert.equal(acks[0]!.acceptedAt, acks[1]!.acceptedAt);
    assert(!JSON.stringify(acks).match(/correct|score|streak|explanation/i));
    await assert.rejects(repository.submitAnswer(identity, { ...input, choice: 2 }), isCode("ALREADY_ANSWERED"));
    await repository.submitAnswer(guestIdentity, { ...input, choice: 2, requestId: randomUUID() });
    checks.push("Private ACK; first answer final; concurrent retry creates one answer; other player can answer");

    const spectatorCredential = createGuestCredential(Date.now());
    const unicodeNickname = "\u0130".repeat(24);
    await db.kotobaClashRoomMember.create({ data: { roomId: room.id, guestHash: spectatorCredential.hash, guestExpiresAt: new Date(spectatorCredential.expiresAt), nickname: unicodeNickname, nicknameKey: nicknameKey(unicodeNickname), spectating: true } });
    await assert.rejects(repository.submitAnswer({ kind: "guest", hash: spectatorCredential.hash, expiresAt: spectatorCredential.expiresAt }, input), isCode("NOT_PLAYING"));
    await assert.rejects(repository.submitAnswer({ ...guestIdentity, expiresAt: 0 }, input), isCode("EXPIRED"));
    checks.push("Spectator and expired guest cannot submit; Unicode nickname keys fit normalization");

    await db.kotobaClashRound.update({ where: { id: rounds[1]!.id }, data: { startsAt: new Date(Date.now() - 2_000), endsAt: new Date(Date.now() + 300), revealEndsAt: new Date(Date.now() + 8_300) } });
    let release!: () => void;
    let locked!: () => void;
    const released = new Promise<void>((resolve) => { release = resolve; });
    const acquired = new Promise<void>((resolve) => { locked = resolve; });
    const blocker = db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "KotobaClashRoom" WHERE id = ${room.id}::uuid FOR UPDATE`;
      locked();
      await released;
    });
    await acquired;
    const late = assert.rejects(repository.submitAnswer(guestIdentity, { ...input, roundId: rounds[1]!.id }), isCode("OUTSIDE_WINDOW"));
    await delay(800);
    release();
    await blocker;
    await late;
    checks.push("Database clock is read after lock wait; late acceptance is rejected");

    const answers = await db.kotobaClashAnswer.findMany({ where: { matchId }, select: { acceptedAt: true } });
    const lastAcceptedAt = Math.max(...answers.map((answer) => answer.acceptedAt.getTime()));
    for (let index = 0; index < rounds.length; index += 1) {
      const startsAt = index === 0 ? lastAcceptedAt - 10_000 : lastAcceptedAt + 110 + (index - 1) * 20;
      const endsAt = index === 0 ? lastAcceptedAt + 100 : startsAt + 10;
      await db.kotobaClashRound.update({ where: { id: rounds[index]!.id }, data: { startsAt: new Date(startsAt), endsAt: new Date(endsAt), revealEndsAt: new Date(endsAt + 10) } });
    }
    await db.kotobaClashMatch.update({ where: { id: matchId }, data: { endsAt: new Date(lastAcceptedAt + 200) } });
    const finalized = await Promise.all([repository.reconcile(identity, room.id, matchId), repository.reconcile(guestIdentity, room.id, matchId)]);
    assert.equal(finalized.filter((result) => result.changed).length, 1);
    const players = await db.kotobaClashMatchPlayer.findMany({ where: { matchId }, orderBy: { memberId: "asc" }, select: { id: true, memberId: true, score: true, correctCount: true, wrongCount: true, skippedCount: true } });
    assert.equal(players.find((player) => player.memberId === hostMember.id)!.correctCount, 1);
    assert.equal(players.find((player) => player.memberId === guestMember.id)!.wrongCount, 1);
    assert(players.every((player) => player.skippedCount === 4));
    assert.equal((await repository.reconcile(identity, room.id, matchId)).changed, false);
    assert.deepEqual(await db.kotobaClashMatchPlayer.findMany({ where: { matchId }, orderBy: { memberId: "asc" }, select: { id: true, memberId: true, score: true, correctCount: true, wrongCount: true, skippedCount: true } }), players);
    assert.equal((await repository.submitAnswer(identity, input)).duplicate, true);
    checks.push("Concurrent/repeated finalization is idempotent; late identical retry preserves original ACK");

    const second = await db.kotobaClashMatch.create({ data: { roomId: room.id, startRequestId: randomUUID(), config, startsAt: new Date(), endsAt: new Date(Date.now() + 1_000), expiresAt: new Date(Date.now() + 60_000) }, select: { id: true } });
    await assert.rejects(db.kotobaClashMatch.create({ data: { roomId: room.id, startRequestId: randomUUID(), config, startsAt: new Date(), endsAt: new Date(Date.now() + 1_000), expiresAt: new Date(Date.now() + 60_000) } }), isCode("P2002"));
    await assert.rejects(db.kotobaClashAnswer.create({ data: { matchId: second.id, roundId: rounds[2]!.id, playerId: players[0]!.id, choice: 1, acceptedAt: new Date() } }), isCode("P2003"));
    await assert.rejects(db.kotobaClashRoomMember.create({ data: { roomId: room.id, nickname: "Invalid", nicknameKey: "invalid", guestExpiresAt: new Date(Date.now() + 1_000) } }));
    checks.push("SQL rejects a second running match, cross-match answers, and missing identity");

    const security = await db.$queryRaw<{ name: string; rls: boolean; forbidden: boolean }[]>`
      SELECT c.relname AS name, c.relrowsecurity AS rls,
        EXISTS (SELECT 1 FROM unnest(ARRAY['anon','authenticated','service_role']) r
          WHERE has_table_privilege(r, c.oid, 'SELECT,INSERT,UPDATE,DELETE')) AS forbidden
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind='r' AND c.relname LIKE 'KotobaClash%'`;
    assert.equal(security.length, 6);
    assert(security.every((table) => table.rls && !table.forbidden));
    for (const role of ["anon", "authenticated", "service_role"]) {
      await assert.rejects(db.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL ROLE ${role}`);
        await tx.$queryRaw`SELECT id FROM "KotobaClashRoom" LIMIT 1`;
      }));
    }
    checks.push("RLS enabled on all six tables; all three Data API roles denied access");

    await anonymizeAccount(host.id, db);
    const anonymous = await db.kotobaClashRoomMember.findUniqueOrThrow({ where: { id: hostMember.id }, select: { userId: true, nicknameKey: true, guestHash: true, anonymizedAt: true } });
    assert.equal(anonymous.userId, null);
    assert.equal(anonymous.nicknameKey, null);
    assert.equal(anonymous.guestHash, null);
    assert(anonymous.anonymizedAt);
    assert.equal((await db.kotobaClashRoom.findUniqueOrThrow({ where: { id: room.id }, select: { hostUserId: true } })).hostUserId, null);
    assert.equal(await db.kotobaClashAnswer.count({ where: { matchId } }), 2);
    await assert.rejects(repository.reconcile(identity, room.id, matchId), isCode("UNAUTHORIZED"));
    checks.push("Real account anonymization removes identity and host access while preserving opponent ledger");
    console.log(JSON.stringify({ status: "PASS", checks }, null, 2));
  } finally {
    await db.kotobaClashRoom.deleteMany({ where: { id: { in: roomIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    await db.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
