import "server-only";

import type { PrismaClient } from "@prisma/client";
import { ClashConfigSchema, ClashIdSchema, ClashQuestionSnapshotSchema, ClashRoomCodeSchema, clashRoomMode } from "../schemas";
import { ClashRoomSnapshotSchema, type ClashRoomSnapshot } from "../contracts";
import { ClashError, type ClashIdentity } from "../domain/ports";
import { phaseAt, rankPlayers, scoreLedger } from "../domain/engine";
import { projectRound } from "../domain/projection";
import { databaseNow, ledgerRoundOf, lockIdentity, lockRoom, requireMember, scheduleOf, PrismaClashRepository } from "./repository";
import { CLASH_LOBBY_IDLE_MS, supportsClashRulesVersion } from "../domain/rules";

export class PrismaClashState {
  constructor(private readonly db: PrismaClient, private readonly repository: PrismaClashRepository) {}

  async read(identity: ClashIdentity, raw: unknown, byCode = false, resultMatchId?: string): Promise<ClashRoomSnapshot> {
    const lookup = byCode ? { code: ClashRoomCodeSchema.parse(raw) } : { id: ClashIdSchema.parse(raw) };
    const found = await this.db.kotobaClashRoom.findUnique({ where: lookup, select: { id: true } });
    if (!found) throw new ClashError("NOT_FOUND");
    const result = await this.db.$transaction(async (tx) => {
      await lockIdentity(tx, identity);
      const room = await lockRoom(tx, found.id);
      const mode = clashRoomMode(room.config);
      if (mode === "solo" && (identity.kind !== "account" || room.hostUserId !== identity.userId)) throw new ClashError("SOLO_PRIVATE");
      const now = await databaseNow(tx);
      const member = await requireMember(tx, identity, room.id, now);
      if (room.expiresAt <= now) throw new ClashError("EXPIRED");
      const match = await tx.kotobaClashMatch.findFirst({ where: { roomId: room.id, expiresAt: { gt: now },
        ...(resultMatchId ? { id: ClashIdSchema.parse(resultMatchId), endsAt: { lte: now } } : {}),
      }, orderBy: { createdAt: "desc" }, select: {
        id: true, status: true, endsAt: true, rulesVersion: true,
        rounds: { orderBy: { position: "asc" }, select: { id: true, position: true, snapshot: true, startsAt: true, endsAt: true, revealEndsAt: true, finalizedAt: true } },
        players: { select: { id: true, memberId: true, member: { select: { nickname: true } }, answers: { select: { roundId: true, choice: true, acceptedAt: true } } } },
      } });
      if (resultMatchId && !match) throw new ClashError("NOT_FOUND");
      if (match && !supportsClashRulesVersion(match.rulesVersion)) throw new ClashError("CLOSED");
      const closed = room.status !== "OPEN" || Math.max(room.updatedAt.getTime(), match?.endsAt.getTime() ?? 0) + CLASH_LOBBY_IDLE_MS <= now.getTime();
      const members = await tx.kotobaClashRoomMember.findMany({
        where: { roomId: room.id, anonymizedAt: null, kickedAt: null, OR: [{ userId: { not: null } }, { guestExpiresAt: { gt: now } }] },
        orderBy: { joinedAt: "asc" },
        select: { id: true, nickname: true, readyRevision: true, spectating: true, userId: true, user: { select: { avatarUrl: true } } },
      });
      const schedule = match?.rounds.map(scheduleOf);
      const phase = schedule && phaseAt(schedule, now.getTime());
      const activeRound = match?.rounds.find((round) => phase && "roundId" in phase && round.id === phase.roundId);
      const ownPlayer = match?.players.find((player) => player.memberId === member.id);
      const ownAnswer = ownPlayer?.answers.find((answer) => answer.roundId === activeRound?.id);
      const scores = match ? rankPlayers(scoreLedger(
        match.players.map((player) => player.id),
        match.rounds.map((round) => ledgerRoundOf(round, match.rulesVersion)),
        match.players.flatMap((player) => player.answers.map((answer) => ({ ...answer, playerId: player.id, acceptedAt: answer.acceptedAt.getTime() }))),
        now.getTime(),
      )) : [];
      const state = ClashRoomSnapshotSchema.parse({
        id: room.id, code: room.code, revision: room.revision, serverNow: now.getTime(), closed,
        mode, configRevision: room.configRevision, config: room.config && room.configRevision > 0 ? ClashConfigSchema.parse(room.config) : null,
        viewer: { memberId: member.id, isHost: identity.kind === "account" && room.hostUserId === identity.userId, spectating: member.spectating },
        members: members.map((row) => ({ id: row.id, nickname: row.nickname, avatarUrl: row.user?.avatarUrl ?? null, ready: room.config !== null && row.readyRevision === room.configRevision,
          spectating: row.spectating, isHost: row.userId !== null && row.userId === room.hostUserId })),
        match: match && {
          id: match.id, questionCount: match.rounds.length, phase, playing: Boolean(ownPlayer),
          ownAnswer: ownAnswer ? { choice: ownAnswer.choice, acceptedAt: ownAnswer.acceptedAt.getTime() } : null,
          round: activeRound ? projectRound(scheduleOf(activeRound), ClashQuestionSnapshotSchema.parse(activeRound.snapshot), now.getTime()) : null,
          leaderboard: scores.map((score) => {
            const player = match.players.find((row) => row.id === score.playerId)!;
            return { ...score, memberId: player.memberId, nickname: player.member.nickname };
          }),
        },
      });
      return { state, reconcile: match && (match.rounds.some((round) => !round.finalizedAt && round.endsAt <= now) || (match.status === "RUNNING" && match.endsAt <= now)) ? match.id : null };
    }, { maxWait: 5000, timeout: 10000 });
    if (result.reconcile) {
      const updated = await this.repository.reconcile(identity, result.state.id, result.reconcile);
      result.state.revision = updated.revision;
    }
    return result.state;
  }

  async results(identity: ClashIdentity, rawCode: unknown, rawMatchId: unknown) {
    const code = ClashRoomCodeSchema.parse(rawCode);
    const matchId = ClashIdSchema.parse(rawMatchId);
    const state = await this.read(identity, code, true, matchId);
    // Recheck membership and retention in the same transaction that reads the completed review.
    const review = await this.db.$transaction(async (tx) => {
      await lockIdentity(tx, identity);
      const room = await lockRoom(tx, state.id);
      const now = await databaseNow(tx);
      const member = await requireMember(tx, identity, room.id, now);
      const match = await tx.kotobaClashMatch.findFirst({ where: { id: matchId, roomId: room.id, endsAt: { lte: now }, expiresAt: { gt: now } }, select: {
        rounds: { orderBy: { position: "asc" }, select: {
          id: true, position: true, snapshot: true, startsAt: true, endsAt: true, revealEndsAt: true,
          answers: { where: { player: { memberId: member.id } }, select: { choice: true } },
        } },
      } });
      if (!match) throw new ClashError("NOT_FOUND");
      return match.rounds.map((round) => ({
        round: projectRound(scheduleOf(round), ClashQuestionSnapshotSchema.parse(round.snapshot), now.getTime())!,
        ownChoice: round.answers[0]?.choice ?? null,
      }));
    });
    return { state, review };
  }
}
