import "server-only";

import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { ClashConfigureSchema, ClashCreateSchema, ClashJoinSchema, ClashReadySchema, ClashRoomInputSchema, nicknameKey } from "../schemas";
import { ClashError, type ClashIdentity } from "../domain/ports";
import { CLASH_LOBBY_IDLE_MS, CLASH_MAX_PLAYERS } from "../domain/rules";
import { createRoomCode } from "./guest-credential";
import { databaseNow, lockIdentity, lockRoom, requireHost, requireMember, type Tx } from "./repository";

const CLASH_ROOM_LIMITS = { spectatorsPerRoom: 5 } as const;

async function requireLobby(tx: Tx, roomId: string) {
  if (await tx.kotobaClashMatch.findFirst({ where: { roomId, status: "RUNNING" }, select: { id: true } })) throw new ClashError("ACTIVE_MATCH");
}

export async function requireOpenRoom(tx: Tx, room: Awaited<ReturnType<typeof lockRoom>>, now: Date) {
  if (room.status !== "OPEN") throw new ClashError("CLOSED");
  if (room.expiresAt <= now) throw new ClashError("EXPIRED");
  if (room.updatedAt.getTime() + CLASH_LOBBY_IDLE_MS <= now.getTime()) {
    const running = await tx.kotobaClashMatch.findFirst({ where: { roomId: room.id, endsAt: { gt: new Date(now.getTime() - CLASH_LOBBY_IDLE_MS) } }, select: { id: true } });
    if (!running) throw new ClashError("EXPIRED");
  }
}

async function touch(tx: Tx, room: Awaited<ReturnType<typeof lockRoom>>, now: Date) {
  return tx.kotobaClashRoom.update({ where: { id: room.id }, data: {
    revision: { increment: 1 }, updatedAt: now,
    expiresAt: new Date(Math.max(room.expiresAt.getTime(), now.getTime() + CLASH_LOBBY_IDLE_MS)),
  }, select: { revision: true } });
}

function identityWhere(identity: ClashIdentity) {
  return identity.kind === "account" ? { userId: identity.userId } : { guestHash: identity.hash };
}

export class PrismaClashLobbyRepository {
  constructor(private readonly db: PrismaClient) {}

  async create(identity: ClashIdentity, raw: unknown) {
    const input = ClashCreateSchema.parse(raw);
    if (identity.kind !== "account") throw new ClashError("HOST_REQUIRED");
    const roomId = input.requestId ?? randomUUID();
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.db.$transaction(async (tx) => {
          await lockIdentity(tx, identity);
          // Only this host's replacements serialize; other hosts create independently.
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('kotoba-clash-host-room'), ${identity.userId}::integer)`;
          if (await tx.kotobaClashRoom.findUnique({ where: { id: roomId }, select: { id: true } })) {
            const previous = await lockRoom(tx, roomId);
            requireHost(identity, previous.hostUserId);
            await requireOpenRoom(tx, previous, await databaseNow(tx));
            return { id: previous.id, code: previous.code, revision: previous.revision, closedRooms: [], duplicate: true };
          }
          const previous = await tx.$queryRaw<{ id: string; revision: number }[]>`
            SELECT id, revision FROM "KotobaClashRoom"
            WHERE "hostUserId" = ${identity.userId} AND status = 'OPEN'
            ORDER BY id FOR UPDATE`;
          const now = await databaseNow(tx);
          await tx.kotobaClashRoom.updateMany({ where: { id: { in: previous.map((room) => room.id) } },
            data: { status: "CLOSED", revision: { increment: 1 }, updatedAt: now } });
          const room = await tx.kotobaClashRoom.create({ data: {
            id: roomId, code: createRoomCode(), hostUserId: identity.userId, expiresAt: new Date(now.getTime() + CLASH_LOBBY_IDLE_MS),
            members: { create: { userId: identity.userId, nickname: input.nickname, nicknameKey: nicknameKey(input.nickname) } },
          }, select: { id: true, code: true, revision: true } });
          return { ...room, closedRooms: previous.map((old) => ({ id: old.id, revision: old.revision + 1 })), duplicate: false };
        }, { maxWait: 5_000, timeout: 10_000 });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") || attempt === 2) throw error;
      }
    }
    throw new ClashError("UNAVAILABLE");
  }

  async join(identity: ClashIdentity, raw: unknown) {
    const input = ClashJoinSchema.parse(raw);
    return this.db.$transaction(async (tx) => {
      await lockIdentity(tx, identity);
      const found = await tx.kotobaClashRoom.findUnique({ where: { code: input.code }, select: { id: true } });
      if (!found) throw new ClashError("NOT_FOUND");
      const room = await lockRoom(tx, found.id);
      const now = await databaseNow(tx);
      await requireOpenRoom(tx, room, now);
      if (identity.kind === "guest" && identity.expiresAt <= now.getTime()) throw new ClashError("EXPIRED");
      const previous = await tx.kotobaClashRoomMember.findFirst({ where: { roomId: room.id, ...identityWhere(identity), anonymizedAt: null }, select: { id: true } });
      if (previous) return { roomId: room.id, code: room.code, memberId: previous.id, revision: room.revision };
      if (await tx.kotobaClashRoomMember.findUnique({ where: { roomId_nicknameKey: { roomId: room.id, nicknameKey: nicknameKey(input.nickname) } }, select: { id: true } })) throw new ClashError("NICKNAME_TAKEN");
      const active = await tx.kotobaClashMatch.findFirst({ where: { roomId: room.id, status: "RUNNING" }, select: { id: true } });
      const spectating = Boolean(active);
      const count = await tx.kotobaClashRoomMember.count({ where: { roomId: room.id, spectating, anonymizedAt: null,
        OR: [{ userId: { not: null } }, { guestExpiresAt: { gt: now } }] } });
      if (count >= (spectating ? CLASH_ROOM_LIMITS.spectatorsPerRoom : CLASH_MAX_PLAYERS)) throw new ClashError("CAPACITY");
      const member = await tx.kotobaClashRoomMember.create({ data: {
        roomId: room.id, ...identityWhere(identity),
        ...(identity.kind === "guest" ? { guestExpiresAt: new Date(identity.expiresAt) } : {}),
        nickname: input.nickname, nicknameKey: nicknameKey(input.nickname), spectating,
      }, select: { id: true } });
      const updated = await touch(tx, room, now);
      return { roomId: room.id, code: room.code, memberId: member.id, revision: updated.revision };
    });
  }

  async configure(identity: ClashIdentity, raw: unknown) {
    const input = ClashConfigureSchema.parse(raw);
    return this.db.$transaction(async (tx) => {
      await lockIdentity(tx, identity);
      const room = await lockRoom(tx, input.roomId);
      requireHost(identity, room.hostUserId);
      const now = await databaseNow(tx);
      await requireOpenRoom(tx, room, now);
      await requireMember(tx, identity, room.id, now);
      await requireLobby(tx, room.id);
      if (room.configRevision !== input.configRevision) throw new ClashError("STALE_CONFIG");
      await tx.kotobaClashRoomMember.updateMany({ where: { roomId: room.id }, data: { readyRevision: null } });
      return tx.kotobaClashRoom.update({ where: { id: room.id }, data: {
        config: input.config, configRevision: { increment: 1 }, revision: { increment: 1 },
        expiresAt: new Date(Math.max(room.expiresAt.getTime(), now.getTime() + CLASH_LOBBY_IDLE_MS)),
      }, select: { revision: true } });
    });
  }

  async ready(identity: ClashIdentity, raw: unknown) {
    const input = ClashReadySchema.parse(raw);
    return this.db.$transaction(async (tx) => {
      await lockIdentity(tx, identity);
      const room = await lockRoom(tx, input.roomId);
      const now = await databaseNow(tx);
      await requireOpenRoom(tx, room, now);
      const member = await requireMember(tx, identity, room.id, now);
      await requireLobby(tx, room.id);
      if (!room.config || room.configRevision !== input.configRevision) throw new ClashError("STALE_CONFIG");
      if (member.spectating) throw new ClashError("NOT_PLAYING");
      await tx.kotobaClashRoomMember.update({ where: { id: member.id }, data: { readyRevision: input.ready ? room.configRevision : null } });
      return touch(tx, room, now);
    });
  }

  async close(identity: ClashIdentity, raw: unknown) {
    const input = ClashRoomInputSchema.parse(raw);
    return this.db.$transaction(async (tx) => {
      await lockIdentity(tx, identity);
      const room = await lockRoom(tx, input.roomId);
      requireHost(identity, room.hostUserId);
      await requireLobby(tx, room.id);
      return tx.kotobaClashRoom.update({ where: { id: room.id }, data: { status: "CLOSED", revision: { increment: 1 } }, select: { revision: true } });
    });
  }

  async participate(identity: ClashIdentity, raw: unknown) {
    const input = ClashRoomInputSchema.parse(raw);
    return this.db.$transaction(async (tx) => {
      await lockIdentity(tx, identity);
      const room = await lockRoom(tx, input.roomId);
      const now = await databaseNow(tx);
      await requireOpenRoom(tx, room, now);
      const member = await requireMember(tx, identity, room.id, now);
      await requireLobby(tx, room.id);
      if (member.spectating) {
        const count = await tx.kotobaClashRoomMember.count({ where: { roomId: room.id, spectating: false, anonymizedAt: null,
          OR: [{ userId: { not: null } }, { guestExpiresAt: { gt: now } }] } });
        if (count >= CLASH_MAX_PLAYERS) throw new ClashError("CAPACITY");
        await tx.kotobaClashRoomMember.update({ where: { id: member.id }, data: { spectating: false, readyRevision: null } });
      }
      return touch(tx, room, now);
    });
  }
}
