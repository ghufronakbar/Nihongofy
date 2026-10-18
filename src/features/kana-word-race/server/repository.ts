import "server-only";
import { randomInt } from "node:crypto";
import { Prisma, type PrismaClient, type KanaRaceMember } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { CACHE_KEYS } from "@/constants/cache-key";
import { ConfigSchema, DEFAULT_CONFIG, DictionarySchema, MatchSchema, SnapshotSchema, type RaceCommand, type RaceConfig, type RaceMatch, type RaceSnapshot } from "../contracts";
import { advance, buildMatch, leaderboard, phase, playerStatus, RaceError, RETENTION_MS, stock, submitGuess } from "../domain/engine";

export type RaceIdentity = { kind: "account"; userId: number } | { kind: "guest"; hash: string; expiresAt: number };
type Tx = Prisma.TransactionClient;
const json = (value: object) => value as Prisma.InputJsonObject;
const IDLE_MS = 30 * 60 * 1000;
function identityWhere(identity: RaceIdentity) {
  return identity.kind === "account" ? { userId: identity.userId } : { guestHash: identity.hash };
}
async function databaseNow(tx: Tx) {
  const [row] = await tx.$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() AS now`;
  return row!.now.getTime();
}
function authorize(member: KanaRaceMember | undefined, identity: RaceIdentity, now: number) {
  if (!member || member.anonymizedAt || (identity.kind === "guest" && (!member.guestExpiresAt || member.guestExpiresAt.getTime() <= now || identity.expiresAt <= now))) throw new RaceError("Masuk kembali untuk mengakses room ini.", true);
  return member;
}
function roomCode() {
  const chars = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  return Array.from({ length: 8 }, () => chars[randomInt(chars.length)]).join("");
}

export class RaceRepository {
  constructor(private readonly db: PrismaClient, private readonly loadDictionary?: (id: string) => Promise<ReturnType<typeof DictionarySchema.parse>>) {}
  private dictionary(id: string, tx: Tx) {
    if (this.loadDictionary) return this.loadDictionary(id);
    return unstable_cache(async () => {
      const row = await tx.kanaRaceDictionary.findUniqueOrThrow({ where: { id }, select: { payload: true } });
      return DictionarySchema.parse(row.payload);
    }, [...CACHE_KEYS.kanaRaceDictionary, id], { revalidate: false })();
  }
  async create(userId: number, nickname: string, requestId: string) {
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
      const user = await tx.user.findUnique({ where: { id: userId }, select: { anonymizedAt: true } });
      if (!user || user.anonymizedAt) throw new RaceError("Masuk untuk membuat room.", true);
      const existing = await tx.kanaRaceRoom.findUnique({ where: { id: requestId }, select: { code: true, hostId: true, closedAt: true, expiresAt: true } });
      const now = await databaseNow(tx);
      if (existing) {
        if (existing.hostId !== userId || existing.closedAt || existing.expiresAt.getTime() <= now) throw new RaceError("Room permintaan ini sudah ditutup. Buat room baru.");
        return { code: existing.code };
      }
      const dictionary = await tx.kanaRaceDictionary.findFirst({ select: { id: true } });
      if (!dictionary) throw new RaceError("Kamus game belum tersedia. Hubungi pengelola.");
      const old = await tx.kanaRaceRoom.findMany({ where: { hostId: userId, closedAt: null }, orderBy: { id: "asc" }, select: { id: true } });
      for (const row of old) await tx.$queryRaw`SELECT id FROM "KanaRaceRoom" WHERE id = ${row.id}::uuid FOR UPDATE`;
      await tx.kanaRaceRoom.updateMany({ where: { hostId: userId, closedAt: null }, data: { closedAt: new Date(now) } });
      const room = await tx.kanaRaceRoom.create({ data: {
        id: requestId, code: roomCode(), hostId: userId, config: DEFAULT_CONFIG,
        expiresAt: new Date(now + RETENTION_MS), idleExpiresAt: new Date(now + IDLE_MS),
        members: { create: { userId, nickname, nicknameKey: nickname.toLowerCase() } },
      }, select: { code: true } });
      return room;
    });
  }
  async join(identity: RaceIdentity, code: string, nickname: string) {
    const found = await this.db.kanaRaceRoom.findUnique({ where: { code }, select: { id: true } });
    if (!found) throw new RaceError("Room tidak ditemukan.", true);
    return this.db.$transaction(async (tx) => {
      if (identity.kind === "account") await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${identity.userId} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "KanaRaceRoom" WHERE id = ${found.id}::uuid FOR UPDATE`;
      const room = await tx.kanaRaceRoom.findUniqueOrThrow({ where: { id: found.id }, include: { members: true } });
      const now = await databaseNow(tx);
      if (room.closedAt || room.expiresAt.getTime() <= now || room.idleExpiresAt.getTime() <= now) throw new RaceError("Room sudah ditutup atau kedaluwarsa.", true);
      if (identity.kind === "account") {
        const user = await tx.user.findUnique({ where: { id: identity.userId }, select: { anonymizedAt: true } });
        if (!user || user.anonymizedAt) throw new RaceError("Session berakhir.", true);
      }
      const existing = room.members.find((member) => identity.kind === "account" ? member.userId === identity.userId : member.guestHash === identity.hash);
      if (existing) { authorize(existing, identity, now); return { roomId: room.id, code }; }
      if (identity.kind === "guest" && identity.expiresAt <= now) throw new RaceError("Akses guest kedaluwarsa.", true);
      if (room.currentMatchId) throw new RaceError("Pertandingan sudah dimulai. Gabung saat host kembali ke lobby.");
      if (room.members.filter((member) => !member.anonymizedAt && (!member.guestExpiresAt || member.guestExpiresAt.getTime() > now)).length >= 20) throw new RaceError("Room sudah penuh.");
      if (room.members.some((member) => member.nicknameKey === nickname.toLowerCase())) throw new RaceError("Nickname sudah dipakai dalam room.");
      await tx.kanaRaceMember.create({ data: { roomId: room.id, nickname, nicknameKey: nickname.toLowerCase(), ...identityWhere(identity), ...(identity.kind === "guest" ? { guestExpiresAt: new Date(identity.expiresAt) } : {}) } });
      await tx.kanaRaceRoom.update({ where: { id: room.id }, data: { revision: { increment: 1 }, idleExpiresAt: new Date(now + IDLE_MS) } });
      return { roomId: room.id, code };
    });
  }
  async lookup(identity: RaceIdentity, code: string) {
    const room = await this.db.kanaRaceRoom.findUnique({ where: { code }, select: { id: true, members: { where: identityWhere(identity), select: { id: true } } } });
    return room?.members.length ? room.id : null;
  }
  async run(identity: RaceIdentity, command: RaceCommand, resultMatchId?: string): Promise<RaceSnapshot> {
    return this.db.$transaction(async (tx) => {
      if (identity.kind === "account" && command.type !== "sync") await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${identity.userId} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "KanaRaceRoom" WHERE id = ${command.roomId}::uuid FOR UPDATE`;
      const room = await tx.kanaRaceRoom.findUnique({ where: { id: command.roomId }, include: { members: { orderBy: { joinedAt: "asc" } } } });
      const now = await databaseNow(tx);
      if (!room || room.expiresAt.getTime() <= now) throw new RaceError("Room sudah kedaluwarsa.", true);
      const viewer = authorize(room.members.find((member) => identity.kind === "account" ? member.userId === identity.userId : member.guestHash === identity.hash), identity, now);
      let closed = Boolean(room.closedAt) || room.idleExpiresAt.getTime() <= now;
      const host = identity.kind === "account" && room.hostId === identity.userId;
      if (closed && command.type !== "sync") throw new RaceError("Room sudah ditutup.", true);
      if (["configure", "start", "rematch", "close"].includes(command.type) && !host) throw new RaceError("Hanya host yang dapat melakukan ini.");
      let config: RaceConfig = ConfigSchema.parse(room.config);
      const matchId = resultMatchId ?? room.currentMatchId;
      let saved = matchId ? await tx.kanaRaceMatch.findFirst({ where: { id: matchId, roomId: room.id, expiresAt: { gt: new Date(now) } } }) : null;
      if (resultMatchId && !saved) throw new RaceError("Hasil tidak ditemukan atau kedaluwarsa.", true);
      let match: RaceMatch | null = saved ? MatchSchema.parse(saved.state) : null;
      const before = match ? JSON.stringify(match) : "";
      if (match) advance(match, now);
      if (match && saved && room.currentMatchId === saved.id && phase(match, now).kind === "FINISHED") {
        closed ||= match.rounds.at(-1)!.revealAt! + 8000 + IDLE_MS <= now;
        if (closed && command.type !== "sync") throw new RaceError("Room sudah ditutup.", true);
      }
      if (resultMatchId && (!match || !match.roster.includes(viewer.id) || phase(match, now).kind !== "FINISHED")) throw new RaceError("Hasil belum tersedia untuk pemain ini.");
      const dictionaryId = saved?.dictionaryId ?? (await tx.kanaRaceDictionary.findFirst({ orderBy: { createdAt: "desc" }, select: { id: true } }))?.id;
      if (!dictionaryId) throw new RaceError("Kamus game belum diterbitkan.");
      const dictionary = await this.dictionary(dictionaryId, tx);
      if (command.type === "ready" || command.type === "configure") {
        if (room.currentMatchId) throw new RaceError("Kembali ke lobby terlebih dahulu.");
        if (command.revision !== room.revision) throw new RaceError("Pengaturan berubah. Periksa lobby kembali.");
        if (command.type === "configure") {
          config = command.config;
          await tx.kanaRaceMember.updateMany({ where: { roomId: room.id }, data: { readyRevision: null } });
          await tx.kanaRaceRoom.update({ where: { id: room.id }, data: { config, revision: { increment: 1 }, idleExpiresAt: new Date(now + IDLE_MS) } });
          room.revision++;
          room.members.forEach((member) => { member.readyRevision = null; });
        } else {
          viewer.readyRevision = command.ready ? room.revision : null;
          await tx.kanaRaceMember.update({ where: { id: viewer.id }, data: { readyRevision: viewer.readyRevision } });
          await tx.kanaRaceRoom.update({ where: { id: room.id }, data: { idleExpiresAt: new Date(now + IDLE_MS) } });
        }
      }
      if (command.type === "start") {
        if (room.currentMatchId && room.currentMatchId !== command.requestId) throw new RaceError("Pertandingan sudah dimulai.");
        if (!room.currentMatchId) {
          if (command.revision !== room.revision) throw new RaceError("Pengaturan berubah.");
          const roster = room.members.filter((member) => !member.anonymizedAt && (!member.guestExpiresAt || member.guestExpiresAt.getTime() > now));
          if (roster.length < 2 || roster.length > 20 || roster.some((member) => member.readyRevision !== room.revision)) throw new RaceError("Butuh 2-20 pemain dan semua harus siap.");
          match = buildMatch(config, roster.map((member) => member.id), dictionary, now, randomInt);
          saved = await tx.kanaRaceMatch.create({ data: { id: command.requestId, roomId: room.id, dictionaryId, state: json(match), expiresAt: new Date(now + RETENTION_MS) } });
          await tx.kanaRaceRoom.update({ where: { id: room.id }, data: { currentMatchId: saved.id, expiresAt: new Date(now + RETENTION_MS), idleExpiresAt: new Date(now + RETENTION_MS) } });
        }
      }
      if (command.type === "guess") {
        if (!saved || !match || saved.id !== command.matchId || closed) throw new RaceError("Pertandingan tidak aktif.");
        submitGuess(match, new Set(dictionary.guesses), viewer.id, command, now);
      }
      if (match && saved) {
        const finished = phase(match, now).kind === "FINISHED";
        if (JSON.stringify(match) !== before || (finished && !saved.finishedAt)) {
          await tx.kanaRaceMatch.update({ where: { id: saved.id }, data: { state: json(match), ...(finished && !saved.finishedAt ? { finishedAt: new Date(now) } : {}) } });
        }
        if (finished && !saved.finishedAt && room.currentMatchId === saved.id) {
          const finishedAt = match.rounds.at(-1)!.revealAt! + 8000;
          const idleExpiresAt = new Date(finishedAt + IDLE_MS);
          await tx.kanaRaceRoom.update({ where: { id: room.id }, data: { idleExpiresAt } });
          closed ||= idleExpiresAt.getTime() <= now;
        }
      }
      if (command.type === "rematch" && room.currentMatchId) {
        if (match && phase(match, now).kind !== "FINISHED") throw new RaceError("Tunggu pertandingan selesai.");
        await tx.kanaRaceRoom.update({ where: { id: room.id }, data: { currentMatchId: null, revision: { increment: 1 }, idleExpiresAt: new Date(now + IDLE_MS) } });
        await tx.kanaRaceMember.updateMany({ where: { roomId: room.id }, data: { readyRevision: null } });
        room.revision++; room.members.forEach((member) => { member.readyRevision = null; }); match = null;
      }
      if (command.type === "close") { await tx.kanaRaceRoom.update({ where: { id: room.id }, data: { closedAt: new Date(now) } }); closed = true; }
      const state: RaceSnapshot = {
        roomId: room.id, code: room.code, revision: room.revision, serverNow: now, closed,
        viewer: { memberId: viewer.id, host }, config, stock: stock(dictionary),
        members: room.members.filter((member) => !member.anonymizedAt && (!member.guestExpiresAt || member.guestExpiresAt.getTime() > now)).map((member) => ({ id: member.id, nickname: member.nickname, ready: member.readyRevision === room.revision })), match: null,
      };
      if (match && saved) {
        const current = phase(match, now); const round = match.rounds[current.index]!;
        const reveal = current.kind === "REVEAL" || current.kind === "FINISHED";
        const viewerPlaying = match.roster.includes(viewer.id);
        state.match = { id: saved.id, phase: current.kind, round: current.index, count: match.rounds.length, endsAt: current.endsAt, length: round.target.length,
          category: match.config.category ? round.category : null, status: viewerPlaying ? playerStatus(round, viewer.id, now) : null,
          guesses: round.guesses[viewer.id] ?? [], reveal: reveal ? { kana: round.target, sources: round.sources } : null,
          players: leaderboard(match, now).map((row) => ({ ...row, status: playerStatus(round, row.memberId, now), attempts: round.guesses[row.memberId]?.length ?? 0 })),
          review: current.kind === "FINISHED" ? match.rounds.map((item) => ({ kana: item.target, sources: item.sources, guesses: item.guesses[viewer.id] ?? [] })) : [],
        };
      }
      return SnapshotSchema.parse(state);
    }, { timeout: 15_000 });
  }
}
