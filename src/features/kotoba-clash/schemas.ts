import { z } from "zod";
import { CLASH_LEVELS, CLASH_MONDAI_TYPES } from "./domain/rules";

export const ClashIdSchema = z.uuid();
export const ClashRoomCodeSchema = z.string().trim().toUpperCase().regex(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/);
export const ClashNicknameSchema = z.string()
  .transform((value) => value.normalize("NFKC").trim().replace(/\s+/gu, " "))
  .pipe(z.string().min(2).max(24).regex(/^[\p{L}\p{N} _.-]+$/u));

export function nicknameKey(nickname: string) {
  return ClashNicknameSchema.parse(nickname).toLowerCase();
}

export const ClashModeSchema = z.enum(["multiplayer", "solo"]);
export type ClashMode = z.infer<typeof ClashModeSchema>;

// Before the first configure, room JSON holds only mode; legacy null/configs are multiplayer.
export function clashRoomMode(config: unknown): ClashMode {
  return z.object({ mode: ClashModeSchema.default("multiplayer") }).parse(config ?? {}).mode;
}

export const ClashConfigSchema = z.strictObject({
  mode: ClashModeSchema.optional(),
  jlptLevel: z.enum(CLASH_LEVELS),
  mondaiTypes: z.array(z.enum(CLASH_MONDAI_TYPES)).min(1).max(CLASH_MONDAI_TYPES.length)
    .refine((types) => new Set(types).size === types.length, "Tipe soal tidak boleh duplikat."),
  questionCount: z.union([z.literal(5), z.literal(10), z.literal(15), z.literal(20)]),
});
export type ClashConfig = z.infer<typeof ClashConfigSchema>;

const imageSchema = z.url().nullable();
export const ClashQuestionContentSchema = z.strictObject({
  instruction: z.string().nullable(),
  text: z.string(),
  image: imageSchema,
  context: z.strictObject({ text: z.string().nullable(), image: imageSchema }).nullable(),
  choices: z.array(z.strictObject({
    code: z.number().int().min(1).max(4),
    text: z.string(),
    image: imageSchema,
  }).refine((choice) => choice.text.trim().length > 0 || choice.image !== null))
    .min(2).max(4)
    .refine((choices) => new Set(choices.map((choice) => choice.code)).size === choices.length),
});

// Private persistence contract. Never serialize this object directly to a client.
export const ClashQuestionSnapshotSchema = z.strictObject({
  sourceQuestionId: z.number().int().positive(),
  mondaiType: z.enum(CLASH_MONDAI_TYPES),
  content: ClashQuestionContentSchema,
  correctChoice: z.number().int().min(1).max(4),
  explanation: z.string().nullable(),
}).refine((question) => question.content.choices.some((choice) => choice.code === question.correctChoice));
export type ClashQuestionSnapshot = z.infer<typeof ClashQuestionSnapshotSchema>;

export const ClashRoomInputSchema = z.strictObject({ roomId: ClashIdSchema });
export const ClashCreateSchema = z.strictObject({ nickname: ClashNicknameSchema, requestId: ClashIdSchema.optional(), mode: ClashModeSchema.default("multiplayer") });
export const ClashJoinSchema = z.strictObject({ code: ClashRoomCodeSchema, nickname: ClashNicknameSchema });
export const ClashRenameSchema = ClashRoomInputSchema.extend({ nickname: ClashNicknameSchema });
export const ClashKickSchema = ClashRoomInputSchema.extend({ memberId: ClashIdSchema });
export const ClashConfigureSchema = ClashRoomInputSchema.extend({
  configRevision: z.number().int().nonnegative(),
  config: ClashConfigSchema,
});
export const ClashReadySchema = ClashRoomInputSchema.extend({
  configRevision: z.number().int().nonnegative(),
  ready: z.boolean(),
});
export const ClashStartSchema = ClashRoomInputSchema.extend({
  configRevision: z.number().int().nonnegative(),
  requestId: z.uuid(),
});
export const ClashAnswerSchema = ClashRoomInputSchema.extend({
  matchId: ClashIdSchema,
  roundId: ClashIdSchema,
  requestId: z.uuid(),
  choice: z.number().int().min(1).max(4),
});

const envelope = { protocolVersion: z.literal(1), requestId: z.uuid() };
export const ClashClientMessageSchema = z.discriminatedUnion("type", [
  z.strictObject({ ...envelope, type: z.literal("subscribe"), roomId: ClashIdSchema }),
  z.strictObject({ ...envelope, type: z.literal("sync"), roomId: ClashIdSchema, revision: z.number().int().nonnegative() }),
  ClashAnswerSchema.extend({ protocolVersion: z.literal(1), type: z.literal("submit_answer") }),
]);
export type ClashClientMessage = z.infer<typeof ClashClientMessageSchema>;
