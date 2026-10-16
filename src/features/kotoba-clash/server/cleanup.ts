import "server-only";

import { Prisma, type PrismaClient } from "@prisma/client";
import { CLASH_LOBBY_IDLE_MS } from "../domain/rules";

export async function cleanupClash(db: PrismaClient, now: Date) {
  const idleWhere = {
    status: "OPEN" as const, updatedAt: { lte: new Date(now.getTime() - CLASH_LOBBY_IDLE_MS) },
    matches: { none: { endsAt: { gt: new Date(now.getTime() - CLASH_LOBBY_IDLE_MS) } } },
  };
  const [rooms, matches, guests, idle] = await Promise.all([
    db.kotobaClashRoom.findMany({ where: { expiresAt: { lte: now } }, orderBy: { expiresAt: "asc" }, take: 100, select: { id: true } }),
    db.kotobaClashMatch.findMany({ where: { expiresAt: { lte: now } }, orderBy: { expiresAt: "asc" }, take: 100, select: { id: true, roomId: true } }),
    db.kotobaClashRoomMember.findMany({ where: { guestExpiresAt: { lte: now }, anonymizedAt: null }, orderBy: { guestExpiresAt: "asc" }, take: 100, select: { id: true, roomId: true } }),
    db.kotobaClashRoom.findMany({ where: idleWhere, take: 100, select: { id: true } }),
  ]);
  return db.$transaction(async (tx) => {
    const roomIds = [...new Set([...rooms.map((room) => room.id), ...matches.map((match) => match.roomId), ...guests.map((guest) => guest.roomId), ...idle.map((room) => room.id)])];
    if (roomIds.length) await tx.$queryRaw(Prisma.sql`SELECT id FROM "KotobaClashRoom" WHERE id IN (${Prisma.join(roomIds.map((id) => Prisma.sql`${id}::uuid`))}) ORDER BY id FOR UPDATE`);
    // Recheck after room locks so a concurrent Start cannot be closed by a stale idle scan.
    const closed = await tx.kotobaClashRoom.updateMany({ where: { ...idleWhere, id: { in: idle.map((room) => room.id) } }, data: { status: "CLOSED", revision: { increment: 1 } } });
    const anonymized = await tx.kotobaClashRoomMember.updateMany({
      where: { id: { in: guests.map((guest) => guest.id) }, guestExpiresAt: { lte: now }, anonymizedAt: null },
      data: { guestHash: null, guestExpiresAt: null, nickname: "Guest kedaluwarsa", nicknameKey: null, readyRevision: null, anonymizedAt: now },
    });
    const guestRoomIds = [...new Set(guests.map((guest) => guest.roomId))];
    if (anonymized.count && guestRoomIds.length) {
      // Identity cleanup must not extend the lobby's activity deadline.
      await tx.$executeRaw(Prisma.sql`UPDATE "KotobaClashRoom" SET revision = revision + 1 WHERE id IN (${Prisma.join(guestRoomIds.map((id) => Prisma.sql`${id}::uuid`))})`);
    }
    const deletedMatches = await tx.kotobaClashMatch.deleteMany({ where: { id: { in: matches.map((row) => row.id) }, expiresAt: { lte: now } } });
    const deletedRooms = await tx.kotobaClashRoom.deleteMany({ where: { id: { in: rooms.map((row) => row.id) }, expiresAt: { lte: now } } });
    return { roomsDeleted: deletedRooms.count, matchesDeleted: deletedMatches.count, idleRoomsClosed: closed.count, guestsAnonymized: anonymized.count };
  });
}
