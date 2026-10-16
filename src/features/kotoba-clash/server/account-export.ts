import "server-only";

import type { PrismaClient } from "@prisma/client";
import { scoreLedger } from "../domain/engine";
import { ClashQuestionSnapshotSchema } from "../schemas";
import { scheduleOf } from "./repository";

export async function getClashAccountExport(db: PrismaClient, userId: number, now: Date) {
  const members = await db.kotobaClashRoomMember.findMany({
    where: { userId },
    orderBy: { joinedAt: "asc" },
    select: {
      nickname: true, joinedAt: true,
      players: {
        where: { match: { endsAt: { lte: now }, expiresAt: { gt: now }, rulesVersion: 1 } },
        select: {
          id: true, matchId: true,
          answers: { select: { roundId: true, choice: true, acceptedAt: true } },
          match: { select: { rounds: { orderBy: { position: "asc" }, select: {
            id: true, position: true, startsAt: true, endsAt: true, revealEndsAt: true, snapshot: true,
          } } } },
        },
      },
    },
  });
  // A completed schedule can still be persisted as RUNNING when everyone went offline.
  // Rebuild only this account's completed results without exporting private snapshots.
  return members.map((member) => ({
    nickname: member.nickname, joinedAt: member.joinedAt,
    players: member.players.map((player) => {
      const score = scoreLedger([player.id], player.match.rounds.map((round) => ({
        ...scheduleOf(round), correctChoice: ClashQuestionSnapshotSchema.parse(round.snapshot).correctChoice,
      })), player.answers.map((answer) => ({ ...answer, playerId: player.id, acceptedAt: answer.acceptedAt.getTime() })), now.getTime())[0]!;
      return {
        matchId: player.matchId, score: score.score, correctCount: score.correctCount,
        wrongCount: score.wrongCount, skippedCount: score.skippedCount,
        bestStreak: score.bestStreak, correctTimeMs: score.correctTimeMs, answers: player.answers,
      };
    }),
  }));
}
