import "server-only";

import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import { ClashAnswerSchema, ClashConfigSchema, ClashIdSchema, ClashQuestionSnapshotSchema, ClashStartSchema } from "../schemas";
import { acceptsAnswer, createSchedule, scoreLedger, type LedgerRound } from "../domain/engine";
import { ClashError, type ClashAssignment, type ClashIdentity } from "../domain/ports";
import { CLASH_MAX_PLAYERS, CLASH_MIN_PLAYERS, CLASH_RETENTION_MS, CLASH_RULES_VERSION } from "../domain/rules";

type Tx = Prisma.TransactionClient;

const memberSelect = { id: true, userId: true, guestHash: true, guestExpiresAt: true, anonymizedAt: true, readyRevision: true, spectating: true } as const;
const roundSelect = { id: true, position: true, snapshot: true, startsAt: true, endsAt: true, revealEndsAt: true, finalizedAt: true } as const;

async function databaseNow(tx: Tx) {
  const rows: unknown = await tx.$queryRaw`SELECT date_trunc('milliseconds', clock_timestamp()) AS now`;
  return z.array(z.object({ now: z.date() })).length(1).parse(rows)[0]!.now;
}

async function lockIdentity(tx: Tx, identity: ClashIdentity) {
  if (identity.kind === "account") {
    const rows = await tx.$queryRaw<{ id: number }[]>`
      SELECT id FROM "User" WHERE id = ${identity.userId} AND "anonymizedAt" IS NULL FOR SHARE`;
    if (rows.length !== 1) throw new ClashError("UNAUTHORIZED");
  }
}

async function lockRoom(tx: Tx, roomId: string) {
  await tx.$queryRaw`SELECT id FROM "KotobaClashRoom" WHERE id = ${roomId}::uuid FOR UPDATE`;
  const room = await tx.kotobaClashRoom.findUnique({
    where: { id: roomId },
    select: { id: true, hostUserId: true, status: true, expiresAt: true, config: true, configRevision: true, revision: true },
  });
  if (!room) throw new ClashError("NOT_FOUND");
  return room;
}

async function lockMatch(tx: Tx, roomId: string, matchId: string) {
  await tx.$queryRaw`SELECT id FROM "KotobaClashMatch" WHERE id = ${matchId}::uuid AND "roomId" = ${roomId}::uuid FOR UPDATE`;
  const match = await tx.kotobaClashMatch.findFirst({
    where: { id: matchId, roomId },
    select: { id: true, status: true, expiresAt: true, endsAt: true, rulesVersion: true },
  });
  if (!match) throw new ClashError("NOT_FOUND");
  if (match.rulesVersion !== CLASH_RULES_VERSION) throw new ClashError("CLOSED");
  return match;
}

async function requireMember(tx: Tx, identity: ClashIdentity, roomId: string, now: Date) {
  const member = await tx.kotobaClashRoomMember.findFirst({
    where: { roomId, anonymizedAt: null, ...(identity.kind === "account" ? { userId: identity.userId } : { guestHash: identity.hash }) },
    select: memberSelect,
  });
  if (!member) throw new ClashError("UNAUTHORIZED");
  if (identity.kind === "guest" && (identity.expiresAt <= now.getTime() || !member.guestExpiresAt || member.guestExpiresAt <= now)) {
    throw new ClashError("EXPIRED");
  }
  return member;
}

function requireHost(identity: ClashIdentity, hostUserId: number | null) {
  if (identity.kind !== "account" || hostUserId !== identity.userId) throw new ClashError("HOST_REQUIRED");
}

function scheduleOf(round: { id: string; position: number; startsAt: Date; endsAt: Date; revealEndsAt: Date }) {
  return { id: round.id, position: round.position, startsAt: round.startsAt.getTime(), endsAt: round.endsAt.getTime(), revealEndsAt: round.revealEndsAt.getTime() };
}

// Internal server repository. Adapters must authenticate each command before supplying identity.
export class PrismaClashRepository {
  constructor(private readonly db: PrismaClient) {}

  async start(identity: ClashIdentity, raw: unknown, assignments: ClashAssignment[]) {
    const input = ClashStartSchema.parse(raw);
    const questions = assignments.map((assignment) => ({ id: ClashIdSchema.parse(assignment.id), question: ClashQuestionSnapshotSchema.parse(assignment.question) }));
    return this.db.$transaction(async (tx) => {
      await lockIdentity(tx, identity);
      const room = await lockRoom(tx, input.roomId);
      requireHost(identity, room.hostUserId);
      const now = await databaseNow(tx);
      await requireMember(tx, identity, room.id, now);
      const previous = await tx.kotobaClashMatch.findUnique({
        where: { roomId_startRequestId: { roomId: room.id, startRequestId: input.requestId } },
        select: { id: true, expiresAt: true },
      });
      if (previous) {
        if (previous.expiresAt <= now) throw new ClashError("EXPIRED");
        return { matchId: previous.id, revision: room.revision, duplicate: true };
      }
      if (room.status !== "OPEN") throw new ClashError("CLOSED");
      if (room.expiresAt <= now) throw new ClashError("EXPIRED");
      if (room.configRevision !== input.configRevision) throw new ClashError("STALE_CONFIG");
      const config = ClashConfigSchema.parse(room.config);
      if (questions.length !== config.questionCount || new Set(questions.map((q) => q.id)).size !== questions.length ||
        new Set(questions.map((q) => q.question.sourceQuestionId)).size !== questions.length ||
        questions.some((q) => !config.mondaiTypes.includes(q.question.mondaiType))) throw new ClashError("INVALID_QUESTIONS");
      const active = await tx.kotobaClashMatch.findFirst({ where: { roomId: room.id, status: "RUNNING" }, select: { id: true } });
      if (active) throw new ClashError("ACTIVE_MATCH");
      const members = await tx.kotobaClashRoomMember.findMany({
        where: { roomId: room.id, spectating: false, anonymizedAt: null, OR: [{ userId: { not: null } }, { guestExpiresAt: { gt: now } }] },
        select: memberSelect,
      });
      if (members.length < CLASH_MIN_PLAYERS || members.length > CLASH_MAX_PLAYERS ||
        !members.some((member) => member.userId === room.hostUserId) ||
        members.some((member) => member.readyRevision !== room.configRevision)) throw new ClashError("NOT_READY");
      const schedule = createSchedule(now.getTime(), questions.map((q) => ({ id: q.id, mondaiType: q.question.mondaiType })));
      const endsAt = new Date(schedule.at(-1)!.revealEndsAt);
      const expiresAt = new Date(endsAt.getTime() + CLASH_RETENTION_MS);
      const match = await tx.kotobaClashMatch.create({
        data: { roomId: room.id, startRequestId: input.requestId, config, startsAt: now, endsAt, expiresAt },
        select: { id: true },
      });
      await tx.kotobaClashMatchPlayer.createMany({ data: members.map((member) => ({ matchId: match.id, roomId: room.id, memberId: member.id })) });
      await tx.kotobaClashRound.createMany({ data: schedule.map((round, index) => ({
        id: round.id, matchId: match.id, position: round.position, snapshot: questions[index]!.question,
        startsAt: new Date(round.startsAt), endsAt: new Date(round.endsAt), revealEndsAt: new Date(round.revealEndsAt),
      })) });
      await tx.kotobaClashRoomMember.updateMany({ where: { roomId: room.id }, data: { readyRevision: null } });
      const updated = await tx.kotobaClashRoom.update({ where: { id: room.id }, data: { expiresAt, revision: { increment: 1 } }, select: { revision: true } });
      return { matchId: match.id, revision: updated.revision, duplicate: false };
    }, { maxWait: 5_000, timeout: 10_000 });
  }

  async submitAnswer(identity: ClashIdentity, raw: unknown) {
    const input = ClashAnswerSchema.parse(raw);
    return this.db.$transaction(async (tx) => {
      await lockIdentity(tx, identity);
      const room = await lockRoom(tx, input.roomId);
      const match = await lockMatch(tx, room.id, input.matchId);
      const member = await requireMember(tx, identity, room.id, await databaseNow(tx));
      const player = await tx.kotobaClashMatchPlayer.findUnique({
        where: { matchId_memberId: { matchId: match.id, memberId: member.id } }, select: { id: true },
      });
      if (!player) throw new ClashError("NOT_PLAYING");
      const round = await tx.kotobaClashRound.findFirst({ where: { id: input.roundId, matchId: match.id }, select: roundSelect });
      if (!round) throw new ClashError("NOT_FOUND");
      const previous = await tx.kotobaClashAnswer.findUnique({
        where: { roundId_playerId: { roundId: round.id, playerId: player.id } }, select: { choice: true, acceptedAt: true },
      });
      const acceptedAt = await databaseNow(tx);
      if (match.expiresAt <= acceptedAt) throw new ClashError("EXPIRED");
      if (previous) {
        if (previous.choice !== input.choice) throw new ClashError("ALREADY_ANSWERED");
        return { roundId: round.id, acceptedAt: previous.acceptedAt.getTime(), duplicate: true, revision: room.revision };
      }
      if (room.status !== "OPEN") throw new ClashError("CLOSED");
      if (match.status !== "RUNNING" || round.finalizedAt || !acceptsAnswer(scheduleOf(round), acceptedAt.getTime())) throw new ClashError("OUTSIDE_WINDOW");
      const question = ClashQuestionSnapshotSchema.parse(round.snapshot);
      if (!question.content.choices.some((choice) => choice.code === input.choice)) throw new ClashError("INVALID_CHOICE");
      await tx.kotobaClashAnswer.create({ data: { matchId: match.id, roundId: round.id, playerId: player.id, choice: input.choice, acceptedAt }, select: { id: true } });
      const updated = await tx.kotobaClashRoom.update({ where: { id: room.id }, data: { revision: { increment: 1 } }, select: { revision: true } });
      return { roundId: round.id, acceptedAt: acceptedAt.getTime(), duplicate: false, revision: updated.revision };
    }, { maxWait: 5_000, timeout: 10_000 });
  }

  async reconcile(identity: ClashIdentity, rawRoomId: unknown, rawMatchId: unknown) {
    const roomId = ClashIdSchema.parse(rawRoomId);
    const matchId = ClashIdSchema.parse(rawMatchId);
    return this.db.$transaction(async (tx) => {
      await lockIdentity(tx, identity);
      const room = await lockRoom(tx, roomId);
      const match = await lockMatch(tx, room.id, matchId);
      const now = await databaseNow(tx);
      await requireMember(tx, identity, room.id, now);
      if (match.expiresAt <= now) throw new ClashError("EXPIRED");
      const rounds = await tx.kotobaClashRound.findMany({ where: { matchId }, orderBy: { position: "asc" }, select: roundSelect });
      const due = rounds.filter((round) => !round.finalizedAt && round.endsAt <= now);
      const finished = match.endsAt <= now;
      if (due.length === 0 && (match.status === "FINISHED" || !finished)) return { revision: room.revision, changed: false };
      const players = await tx.kotobaClashMatchPlayer.findMany({ where: { matchId }, select: { id: true } });
      const answers = await tx.kotobaClashAnswer.findMany({ where: { matchId }, select: { roundId: true, playerId: true, choice: true, acceptedAt: true } });
      const ledger: LedgerRound[] = rounds.map((round) => ({ ...scheduleOf(round), correctChoice: ClashQuestionSnapshotSchema.parse(round.snapshot).correctChoice }));
      const results = scoreLedger(players.map((player) => player.id), ledger, answers.map((answer) => ({ ...answer, acceptedAt: answer.acceptedAt.getTime() })), now.getTime());
      for (const { playerId, ...data } of results) {
        await tx.kotobaClashMatchPlayer.update({ where: { id: playerId }, data, select: { id: true } });
      }
      await tx.kotobaClashRound.updateMany({ where: { matchId, endsAt: { lte: now }, finalizedAt: null }, data: { finalizedAt: now } });
      if (finished) await tx.kotobaClashMatch.update({ where: { id: matchId }, data: { status: "FINISHED" }, select: { id: true } });
      const updated = await tx.kotobaClashRoom.update({ where: { id: room.id }, data: { revision: { increment: 1 } }, select: { revision: true } });
      return { revision: updated.revision, changed: true };
    }, { maxWait: 5_000, timeout: 10_000 });
  }
}
