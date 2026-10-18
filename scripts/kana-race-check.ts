import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";
import { RaceRepository, type RaceIdentity } from "../src/features/kana-word-race/server/repository";
import { DictionarySchema, MatchSchema, type RaceCommand, type RaceMatch } from "../src/features/kana-word-race/contracts";
import { cleanupRace, getRaceAccountExport } from "../src/features/kana-word-race/server/lifecycle";
import { anonymizeAccount } from "../src/features/auth/lib/anonymize-account";
import { RACE_LEASE_SCRIPT } from "../src/features/kana-word-race/server/presence";

const url = z.url().parse(process.argv[2]);
const target = new URL(url);
assert(["127.0.0.1", "localhost", "[::1]"].includes(target.hostname), "Loopback database only");
assert(target.pathname.startsWith("/kana_race_"), "Disposable kana_race_ database required");
const db = new PrismaClient({ datasourceUrl: url });
const repository = new RaceRepository(db, async (id) => DictionarySchema.parse((await db.kanaRaceDictionary.findUniqueOrThrow({ where: { id } })).payload));
const users: number[] = []; const rooms: string[] = []; const clashRooms: string[] = []; const checks: string[] = [];
const data = (state: RaceMatch) => state as Prisma.InputJsonObject;
const sync = (roomId: string): RaceCommand => ({ type: "sync", roomId, requestId: randomUUID() });
async function readMatch(id: string) { return MatchSchema.parse((await db.kanaRaceMatch.findUniqueOrThrow({ where: { id } })).state); }
async function saveMatch(id: string, state: RaceMatch) { await db.kanaRaceMatch.update({ where: { id }, data: { state: data(state) } }); }

async function main() {
  try {
    const host = await db.user.create({ data: { username: `kana_${randomUUID().slice(0, 18)}`, displayName: "Race fixture" } }); users.push(host.id);
    const identity: RaceIdentity = { kind: "account", userId: host.id };
    const guest: RaceIdentity = { kind: "guest", hash: "a".repeat(64), expiresAt: Date.now() + 86400000 };
    const roomId = randomUUID(); rooms.push(roomId);
    const creates = await Promise.all([repository.create(host.id, "Host", roomId), repository.create(host.id, "Host", roomId)]);
    assert.equal(creates[0]!.code, creates[1]!.code);
    const code = creates[0]!.code;
    await repository.join(guest, code, "Guest");
    assert.equal(await repository.lookup(guest, code), roomId);
    let state = await repository.run(identity, sync(roomId));
    await repository.run(identity, { type: "configure", roomId, requestId: randomUUID(), revision: state.revision, config: { ...state.config, length: 3 } });
    state = await repository.run(identity, sync(roomId));
    await Promise.all([identity, guest].map((player) => repository.run(player, { type: "ready", roomId, requestId: randomUUID(), revision: state.revision, ready: true })));
    const requestId = randomUUID();
    const starts = await Promise.all([identity, identity].map((player) => repository.run(player, { type: "start", roomId, requestId, revision: state.revision })));
    assert.equal(starts[0]!.match!.id, starts[1]!.match!.id);
    assert.equal(await db.kanaRaceMatch.count({ where: { roomId } }), 1);
    await assert.rejects(repository.join({ ...guest, hash: "b".repeat(64) }, code, "Late guest"));
    checks.push("Concurrent create/Start are idempotent; frozen roster rejects late admission");
    const matchId = requestId; const hostMember = starts[0]!.viewer.memberId;
    let match = await readMatch(matchId);
    const dictionary = DictionarySchema.parse((await db.kanaRaceDictionary.findFirstOrThrow()).payload);
    const dictionaryRow = await db.kanaRaceDictionary.findFirstOrThrow();
    await assert.rejects(db.kanaRaceDictionary.update({ where: { id: dictionaryRow.id }, data: { payload: { version: 1, guesses: [], answers: [] } } }));
    match.rounds[0]!.startsAt = Date.now() - 1000; match.rounds[0]!.deadline = Date.now() + 90000;
    await saveMatch(matchId, match);
    const answer: RaceCommand = { type: "guess", roomId, matchId, requestId: randomUUID(), round: 0, kana: match.rounds[0]!.target };
    await Promise.all([repository.run(identity, answer), repository.run(identity, answer)]);
    assert.equal((await readMatch(matchId)).rounds[0]!.guesses[hostMember]!.length, 1);
    const personal = await repository.run(guest, sync(roomId));
    assert.equal(personal.match!.phase, "PLAYING"); assert.equal(personal.match!.reveal, null);
    assert.deepEqual(personal.match!.guesses, []); assert.deepEqual(personal.match!.review, []);
    assert(!JSON.stringify(personal).includes(`"kana":"${answer.kana}"`));
    assert((await getRaceAccountExport(db, host.id, new Date()))[0]!.matches[0]!.rounds.every((round) => round.reveal === null));
    await assert.rejects(repository.run({ ...guest, hash: "b".repeat(64) }, sync(roomId)));
    await assert.rejects(repository.run(identity, sync(roomId), matchId));
    checks.push("Personal projection/export hides targets and opponents' guesses; first solver keeps opponents playing");
    const wrong = dictionary.guesses.filter((kana) => kana.length === 3 && kana !== answer.kana).slice(0, 7);
    const guesses = await Promise.allSettled(wrong.map((kana) => repository.run(guest, { type: "guess", roomId, matchId, requestId: randomUUID(), round: 0, kana })));
    assert.equal(guesses.filter((result) => result.status === "fulfilled").length, 6);
    assert.equal((await repository.run(identity, sync(roomId))).match!.phase, "REVEAL");
    await assert.rejects(repository.run(identity, { ...answer, kana: wrong[0]! }));
    checks.push("Seven concurrent submissions consume exactly six slots; shared reveal and conflicting replay are correct");

    match = await readMatch(matchId);
    match.rounds[0]!.revealAt = Date.now() - 10000;
    match.rounds[1]!.startsAt = Date.now() - 1000; match.rounds[1]!.deadline = Date.now() + 200;
    await saveMatch(matchId, match);
    let release!: () => void; let locked!: () => void;
    const barrier = new Promise<void>((resolve) => { release = resolve; }); const acquired = new Promise<void>((resolve) => { locked = resolve; });
    const blocker = db.$transaction(async (tx) => { await tx.$queryRaw`SELECT id FROM "KanaRaceRoom" WHERE id = ${roomId}::uuid FOR UPDATE`; locked(); await barrier; });
    await acquired;
    const late = assert.rejects(repository.run(guest, { type: "guess", roomId, matchId, requestId: randomUUID(), round: 1, kana: match.rounds[1]!.target }));
    await delay(400); release(); await blocker; await late;
    checks.push("Database time after lock wait rejects a submission crossing the deadline");

    match = await readMatch(matchId);
    for (const [index, round] of match.rounds.entries()) { round.startsAt = Date.now() - (match.rounds.length - index) * 100000; round.deadline = round.startsAt + 90000; round.revealAt = round.deadline; }
    await saveMatch(matchId, match);
    const results = await Promise.all([repository.run(identity, sync(roomId)), repository.run(guest, sync(roomId))]);
    assert(results.every((result) => result.match?.phase === "FINISHED"));
    const finished = await db.kanaRaceMatch.findUniqueOrThrow({ where: { id: matchId } }); assert(finished.finishedAt);
    assert.equal(results[0]!.match!.review.length, 3);
    const scores = results[0]!.match!.players.map(({ memberId, score }) => ({ memberId, score }));
    const lobbyAgain = await repository.run(identity, { type: "rematch", roomId, requestId: randomUUID() });
    assert.equal(lobbyAgain.match, null); assert.equal(lobbyAgain.code, code); assert(lobbyAgain.members.every((member) => !member.ready));
    assert.equal((await repository.run(identity, { type: "rematch", roomId, requestId: randomUUID() })).revision, lobbyAgain.revision);
    assert.deepEqual((await repository.run(identity, sync(roomId), matchId)).match!.review, results[0]!.match!.review);
    checks.push("Rematch keeps the code, resets readiness, preserves historic review and is harmless to retry in lobby");
    await anonymizeAccount(host.id, db);
    const anonymized = await db.kanaRaceMember.findUniqueOrThrow({ where: { id: hostMember } });
    assert.equal(anonymized.userId, null); assert.equal(anonymized.nickname, "Pengguna dihapus");
    assert((await readMatch(matchId)).rounds.every((round) => (round.guesses[hostMember] ?? []).every((guess) => guess.kana === "" && !guess.feedback.length)));
    const after = await repository.run(guest, sync(roomId), matchId);
    assert.deepEqual(after.match!.players.map(({ memberId, score }) => ({ memberId, score })), scores);
    await assert.rejects(repository.run(identity, sync(roomId)));
    checks.push("Concurrent finalization persists finishedAt; deletion redacts identity/words while preserving numeric scores");

    const tables = ["KanaWord", "KanaWordSource", "KanaRaceDictionary", "KanaRaceRoom", "KanaRaceMember", "KanaRaceMatch"];
    const rls = await db.$queryRaw<Array<{ relname: string; relrowsecurity: boolean }>>`SELECT relname, relrowsecurity FROM pg_class WHERE relname = ANY(${tables})`;
    assert.equal(rls.length, 6); assert(rls.every((row) => row.relrowsecurity));
    const grants = await db.$queryRaw<Array<{ table_name: string }>>`SELECT table_name FROM information_schema.role_table_grants WHERE grantee IN ('anon','authenticated','service_role','PUBLIC') AND table_name = ANY(${tables})`;
    assert.equal(grants.length, 0);
    const foreignRoom = randomUUID(); rooms.push(foreignRoom);
    await db.kanaRaceRoom.create({ data: { id: foreignRoom, code: "ABCD2345", config: state.config, idleExpiresAt: new Date(Date.now() + 1000), expiresAt: new Date(Date.now() + 86400000) } });
    await assert.rejects(db.kanaRaceRoom.update({ where: { id: foreignRoom }, data: { currentMatchId: matchId } }));
    checks.push("All six tables have RLS and no Data API grants; composite FK rejects a foreign-room match");
    await cleanupRace(db, new Date(Date.now() + 8 * 86400000));
    assert.equal(await db.kanaRaceRoom.count({ where: { id: { in: rooms } } }), 0);
    assert(await db.kanaRaceDictionary.count());
    checks.push("Retention cleanup cascades match/member data and preserves the latest immutable dictionary");

    const host2 = await db.user.create({ data: { username: `cap_${randomUUID().slice(0, 18)}`, displayName: "Capacity host" } }); users.push(host2.id);
    const clashId = randomUUID(); clashRooms.push(clashId);
    await db.kotobaClashRoom.create({ data: { id: clashId, code: "KANA2345", hostUserId: host2.id, expiresAt: new Date(Date.now() + 86400000) } });
    const lobbyId = randomUUID(); rooms.push(lobbyId);
    const lobby = await repository.create(host2.id, "Host", lobbyId);
    const admission = await Promise.allSettled(Array.from({ length: 22 }, (_, index) => repository.join({ kind: "guest", hash: index.toString(16).padStart(64, "c"), expiresAt: Date.now() + 86400000 }, lobby.code, `Guest ${index}`)));
    assert.equal(admission.filter((result) => result.status === "fulfilled").length, 19);
    assert.equal(await db.kanaRaceMember.count({ where: { roomId: lobbyId } }), 20);
    const secondId = randomUUID(); rooms.push(secondId);
    await repository.create(host2.id, "Host", secondId);
    assert((await db.kanaRaceRoom.findUniqueOrThrow({ where: { id: lobbyId } })).closedAt);
    assert.equal((await db.kotobaClashRoom.findUniqueOrThrow({ where: { id: clashId } })).status, "OPEN");
    await assert.rejects(repository.create(host2.id, "Stale retry", lobbyId));
    checks.push("Concurrent admission caps membership at twenty; host replacement closes only prior game rooms");
    if (process.argv[3]) {
      const port = z.coerce.number().int().min(1024).max(65535).parse(process.argv[3]);
      const key = `kana-race-check:${randomUUID()}`;
      const cli = (...args: string[]) => execFileSync("redis-cli", ["-h", "127.0.0.1", "-p", String(port), "--raw", ...args], { encoding: "utf8" }).trim();
      const lease = (member: string, owner: string, operation: string, now = Date.now()) => cli("EVAL", RACE_LEASE_SCRIPT, "1", key, String(now), member, owner, operation, "60000");
      try {
        assert.equal(lease("member", "old", "acquire"), "1"); assert.equal(lease("member", "new", "acquire"), "1");
        assert.equal(lease("member", "old", "renew"), "0"); assert.equal(lease("member", "old", "release"), "0");
        assert.equal(lease("member", "new", "renew"), "1");
        for (let i = 0; i < 19; i++) assert.equal(lease(`member-${i}`, `owner-${i}`, "acquire"), "1");
        assert.equal(lease("full", "owner", "acquire"), "0");
        assert.equal(lease("expired", "owner", "acquire", Date.now() + 61000), "1");
        checks.push("Real Redis Lua enforces takeover, owner-only renew/release, twenty leases and expired lease recovery");
      } finally { cli("DEL", key); }
    }
    console.log(JSON.stringify({ environment: "loopback PostgreSQL", checks, passed: checks.length }, null, 2));
  } finally {
    await db.kanaRaceRoom.deleteMany({ where: { id: { in: rooms } } });
    await db.kotobaClashRoom.deleteMany({ where: { id: { in: clashRooms } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.$disconnect();
  }
}
void main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
