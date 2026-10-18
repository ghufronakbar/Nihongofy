import { z } from "zod";

export const ModeSchema = z.enum(["multiplayer", "solo"]);
export type RaceMode = z.infer<typeof ModeSchema>;
export const ConfigSchema = z.strictObject({
  mode: ModeSchema.default("multiplayer"),
  length: z.union([z.literal(0), z.literal(3), z.literal(4), z.literal(5), z.literal(6), z.literal(7)]),
  rounds: z.union([z.literal(3), z.literal(5), z.literal(10)]),
  pace: z.enum(["normal", "relaxed"]), category: z.boolean(),
});
export type RaceConfig = z.infer<typeof ConfigSchema>;
export const DEFAULT_CONFIG: RaceConfig = { mode: "multiplayer", length: 5, rounds: 3, pace: "normal", category: false };
export const NicknameSchema = z.string().transform((value) => value.normalize("NFKC").trim().replace(/\s+/g, " ")).pipe(z.string().min(2).max(24).regex(/^[\p{L}\p{N} ._-]+$/u));
export const CodeSchema = z.string().trim().toUpperCase().regex(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/);
export const EntrySchema = z.object({ nickname: NicknameSchema });
export const CreateSchema = EntrySchema.extend({ requestId: z.uuid(), mode: ModeSchema.default("multiplayer") });
export const JoinSchema = EntrySchema.extend({ code: CodeSchema });
export const CommandSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("sync"), roomId: z.uuid(), requestId: z.uuid() }),
  z.strictObject({ type: z.literal("ready"), roomId: z.uuid(), requestId: z.uuid(), revision: z.number().int(), ready: z.boolean() }),
  z.strictObject({ type: z.literal("configure"), roomId: z.uuid(), requestId: z.uuid(), revision: z.number().int(), config: ConfigSchema }),
  z.strictObject({ type: z.literal("start"), roomId: z.uuid(), requestId: z.uuid(), revision: z.number().int() }),
  z.strictObject({ type: z.literal("guess"), roomId: z.uuid(), requestId: z.uuid(), matchId: z.uuid(), round: z.number().int().min(0).max(9), kana: z.string().min(1).max(32) }),
  z.strictObject({ type: z.literal("rematch"), roomId: z.uuid(), requestId: z.uuid() }),
  z.strictObject({ type: z.literal("close"), roomId: z.uuid(), requestId: z.uuid() }),
]);
export type RaceCommand = z.infer<typeof CommandSchema>;
export const SourceSchema = z.object({ key: z.string(), word: z.string(), meaning: z.string(), level: z.string() });
export const DictionarySchema = z.object({ version: z.literal(1), guesses: z.array(z.string()), answers: z.array(z.object({ kana: z.string(), category: z.string(), sources: z.array(SourceSchema).min(1) })) });
export type RaceDictionary = z.infer<typeof DictionarySchema>;
export const FeedbackSchema = z.enum(["correct", "present", "absent"]);
export type Feedback = z.infer<typeof FeedbackSchema>;
export const GuessSchema = z.object({ requestId: z.uuid(), kana: z.string(), at: z.number(), feedback: z.array(FeedbackSchema), solved: z.boolean().optional() });
export const RoundSchema = z.object({
  target: z.string(), category: z.string(), sources: z.array(SourceSchema),
  startsAt: z.number(), deadline: z.number(), revealAt: z.number().nullable(),
  guesses: z.record(z.string(), z.array(GuessSchema).max(6)),
});
export const MatchSchema = z.object({ version: z.literal(1), roster: z.array(z.uuid()), config: ConfigSchema, rounds: z.array(RoundSchema) });
export type RaceMatch = z.infer<typeof MatchSchema>;
export type RaceRound = z.infer<typeof RoundSchema>;
export type RaceStatus = "PLAYING" | "SOLVED" | "EXHAUSTED" | "TIMED_OUT";
export const SnapshotSchema = z.object({
  roomId: z.uuid(), code: CodeSchema, revision: z.number(), serverNow: z.number(), closed: z.boolean(),
  viewer: z.object({ memberId: z.uuid(), host: z.boolean() }), config: ConfigSchema,
  stock: z.record(z.string(), z.number()),
  members: z.array(z.object({ id: z.uuid(), nickname: z.string(), ready: z.boolean() })),
  match: z.object({
    id: z.uuid(), phase: z.enum(["COUNTDOWN", "PLAYING", "REVEAL", "FINISHED"]), round: z.number(), count: z.number(),
    endsAt: z.number(), length: z.number(), category: z.string().nullable(), status: z.enum(["PLAYING", "SOLVED", "EXHAUSTED", "TIMED_OUT"]).nullable(),
    guesses: z.array(GuessSchema), reveal: z.object({ kana: z.string(), sources: z.array(SourceSchema) }).nullable(),
    players: z.array(z.object({ memberId: z.uuid(), status: z.enum(["PLAYING", "SOLVED", "EXHAUSTED", "TIMED_OUT"]), attempts: z.number(), score: z.number(), rank: z.number() })),
    review: z.array(z.object({ kana: z.string(), sources: z.array(SourceSchema), guesses: z.array(GuessSchema) })),
  }).nullable(),
});
export type RaceSnapshot = z.infer<typeof SnapshotSchema>;
export const ServerMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("snapshot"), state: SnapshotSchema, online: z.array(z.string()) }),
  z.object({ type: z.literal("ack"), requestId: z.uuid() }),
  z.object({ type: z.literal("error"), requestId: z.string().nullable(), message: z.string(), terminal: z.boolean() }),
]);
