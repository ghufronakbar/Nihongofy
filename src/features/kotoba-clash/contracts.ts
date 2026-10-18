import { z } from "zod";
import { ClashConfigSchema, ClashQuestionContentSchema, ClashExplanationSchema, ClashIdSchema, ClashModeSchema } from "./schemas";
import { CLASH_MONDAI_TYPES } from "./domain/rules";

const phase = z.discriminatedUnion("type", [
  z.object({ type: z.literal("COUNTDOWN"), endsAt: z.number() }),
  z.object({ type: z.enum(["QUESTION", "REVEAL"]), roundId: ClashIdSchema, position: z.number(), endsAt: z.number() }),
  z.object({ type: z.literal("FINISHED") }),
]);

export const ClashRoomSnapshotSchema = z.object({
  id: ClashIdSchema, code: z.string(), revision: z.number().int().nonnegative(), serverNow: z.number(),
  closed: z.boolean(), configRevision: z.number().int().nonnegative(), config: ClashConfigSchema.nullable(),
  mode: ClashModeSchema.default("multiplayer"),
  viewer: z.object({ memberId: ClashIdSchema, isHost: z.boolean(), spectating: z.boolean() }),
  members: z.array(z.object({ id: ClashIdSchema, nickname: z.string(), avatarUrl: z.url().nullable().optional(), ready: z.boolean(), spectating: z.boolean(), isHost: z.boolean() })).max(25),
  match: z.object({
    id: ClashIdSchema, questionCount: z.number(), phase, playing: z.boolean(),
    ownAnswer: z.object({ choice: z.number(), acceptedAt: z.number() }).nullable(),
    round: z.object({
      id: ClashIdSchema, position: z.number(), startsAt: z.number(), endsAt: z.number(), revealEndsAt: z.number(),
      mondaiType: z.enum(CLASH_MONDAI_TYPES), content: ClashQuestionContentSchema,
      correctChoice: z.number().optional(), explanation: z.string().nullable().optional(),
      explanationDetails: ClashExplanationSchema.nullable().optional(),
    }).nullable(),
    leaderboard: z.array(z.object({
      playerId: ClashIdSchema, memberId: ClashIdSchema, nickname: z.string(), rank: z.number(), score: z.number(),
      correctCount: z.number(), wrongCount: z.number(), skippedCount: z.number(), bestStreak: z.number(), correctTimeMs: z.number(),
    })).max(20),
  }).nullable(),
});
export type ClashRoomSnapshot = z.infer<typeof ClashRoomSnapshotSchema>;

export const ClashServerMessageSchema = z.discriminatedUnion("type", [
  z.object({ protocolVersion: z.literal(1), type: z.literal("snapshot"), state: ClashRoomSnapshotSchema, online: z.array(ClashIdSchema).max(25) }),
  z.object({ protocolVersion: z.literal(1), type: z.literal("answer_ack"), requestId: ClashIdSchema, roundId: ClashIdSchema, acceptedAt: z.number() }),
  z.object({ protocolVersion: z.literal(1), type: z.literal("command_error"), requestId: ClashIdSchema.nullable(), code: z.string(), message: z.string() }),
]);
