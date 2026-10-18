import "server-only";
import { Prisma, type PrismaClient } from "@prisma/client";
import { MatchSchema } from "../contracts";
import { advance, leaderboard, phase } from "../domain/engine";

// Caller holds the account lock first (if any), then these sorted room locks.
export async function redactRaceGuesses(tx: Prisma.TransactionClient, memberIds: string[], roomIds: string[]) {
  if (!roomIds.length) return;
  await tx.$queryRaw(Prisma.sql`SELECT id FROM "KanaRaceRoom" WHERE id IN (${Prisma.join([...new Set(roomIds)].sort().map((id) => Prisma.sql`${id}::uuid`))}) ORDER BY id FOR UPDATE`);
  const matches = await tx.kanaRaceMatch.findMany({ where: { roomId: { in: roomIds } }, select: { id: true, state: true } });
  for (const row of matches) {
    const state = MatchSchema.parse(row.state);
    let changed = false;
    for (const round of state.rounds) for (const memberId of memberIds) {
      for (const guess of round.guesses[memberId] ?? []) {
        if (guess.kana) { guess.solved = guess.kana === round.target; guess.kana = ""; guess.feedback = []; changed = true; }
      }
    }
    if (changed) await tx.kanaRaceMatch.update({ where: { id: row.id }, data: { state: state as Prisma.InputJsonObject } });
  }
}

export async function getRaceAccountExport(db: PrismaClient, userId: number, now: Date) {
  const members = await db.kanaRaceMember.findMany({ where: { userId, anonymizedAt: null }, select: { id: true, roomId: true, nickname: true, joinedAt: true, room: { select: { matches: { where: { expiresAt: { gt: now } }, select: { id: true, state: true } } } } } });
  return members.map((member) => ({ nickname: member.nickname, joinedAt: member.joinedAt,
    matches: member.room.matches.flatMap((row) => {
      const match = MatchSchema.parse(row.state); advance(match, now.getTime());
      if (!match.roster.includes(member.id)) return [];
      return [{ matchId: row.id, score: leaderboard(match, now.getTime()).find((player) => player.memberId === member.id)?.score ?? 0,
        finished: phase(match, now.getTime()).kind === "FINISHED",
        rounds: match.rounds.map((round) => ({ guesses: round.guesses[member.id] ?? [],
          reveal: round.revealAt !== null && now.getTime() >= round.revealAt ? { kana: round.target, sources: round.sources } : null })) }];
    }),
  }));
}

export async function cleanupRace(db: PrismaClient, now: Date) {
  const rooms = await db.kanaRaceRoom.findMany({ where: { OR: [{ expiresAt: { lte: now } }, { idleExpiresAt: { lte: now }, closedAt: null }, { currentMatch: { is: { finishedAt: null } } }, { members: { some: { guestExpiresAt: { lte: now }, anonymizedAt: null } } }] }, orderBy: { createdAt: "asc" }, take: 100, select: { id: true } });
  const expiredMatches = await db.kanaRaceMatch.findMany({ where: { expiresAt: { lte: now } }, orderBy: { expiresAt: "asc" }, take: 100, select: { id: true, roomId: true } });
  return db.$transaction(async (tx) => {
    const ids = [...new Set([...rooms.map((room) => room.id), ...expiredMatches.map((match) => match.roomId)])].sort();
    if (ids.length) await tx.$queryRaw(Prisma.sql`SELECT id FROM "KanaRaceRoom" WHERE id IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))}) ORDER BY id FOR UPDATE`);
    const guests = await tx.kanaRaceMember.findMany({ where: { roomId: { in: ids }, guestExpiresAt: { lte: now }, anonymizedAt: null }, select: { id: true, roomId: true } });
    await redactRaceGuesses(tx, guests.map((member) => member.id), guests.map((member) => member.roomId));
    const anonymized = await tx.kanaRaceMember.updateMany({ where: { id: { in: guests.map((member) => member.id) } }, data: { guestHash: null, guestExpiresAt: null, nickname: "Guest kedaluwarsa", nicknameKey: null, readyRevision: null, anonymizedAt: now } });
    // Recover final deadlines even if every player has left the room.
    for (const room of await tx.kanaRaceRoom.findMany({ where: { id: { in: ids }, currentMatchId: { not: null } }, select: { id: true, currentMatch: { select: { id: true, state: true, finishedAt: true } } } })) {
      if (!room.currentMatch || room.currentMatch.finishedAt) continue;
      const state = MatchSchema.parse(room.currentMatch.state); advance(state, now.getTime());
      if (phase(state, now.getTime()).kind === "FINISHED") {
        const finishedAt = new Date(state.rounds.at(-1)!.revealAt! + 8000);
        await tx.kanaRaceMatch.update({ where: { id: room.currentMatch.id }, data: { state: state as Prisma.InputJsonObject, finishedAt } });
        await tx.kanaRaceRoom.update({ where: { id: room.id }, data: { idleExpiresAt: new Date(finishedAt.getTime() + 30 * 60 * 1000) } });
      }
    }
    const closed = await tx.kanaRaceRoom.updateMany({ where: { id: { in: ids }, idleExpiresAt: { lte: now }, closedAt: null }, data: { closedAt: now } });
    await tx.kanaRaceRoom.updateMany({ where: { currentMatchId: { in: expiredMatches.map((match) => match.id) } }, data: { currentMatchId: null, closedAt: now } });
    const matches = await tx.kanaRaceMatch.deleteMany({ where: { id: { in: expiredMatches.map((match) => match.id) }, expiresAt: { lte: now } } });
    const deleted = await tx.kanaRaceRoom.deleteMany({ where: { id: { in: ids }, expiresAt: { lte: now } } });
    const latest = await tx.kanaRaceDictionary.findFirst({ orderBy: { createdAt: "desc" }, select: { id: true } });
    const releases = await tx.kanaRaceDictionary.deleteMany({ where: { id: { not: latest?.id }, matches: { none: {} }, createdAt: { lt: new Date(now.getTime() - 7 * 86400000) } } });
    return { roomsDeleted: deleted.count, matchesDeleted: matches.count, idleRoomsClosed: closed.count, guestsAnonymized: anonymized.count, releasesDeleted: releases.count };
  }, { timeout: 30_000 });
}
