import { z } from "zod";

/**
 * Sasaran sebuah catatan: soal JLPT atau kata flashcard. Satu tabel
 * (`QuestionComment`) melayani keduanya, dengan tepat satu kolom target terisi.
 *
 * Aman untuk client — dipakai form dan pembentuk tautan.
 */
export const CommentTargetSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("question"), questionId: z.number().int().positive() }),
  z.object({ type: z.literal("vocab"), vocabId: z.number().int().positive() }),
]);

export type CommentTarget = z.infer<typeof CommentTargetSchema>;

type TargetColumns = { questionId: number | null; vocabId: number | null };

/** Target dari kolom baris database; null hanya bila CHECK di database dilanggar. */
export function targetOf(row: TargetColumns): CommentTarget | null {
  if (row.questionId !== null) return { type: "question", questionId: row.questionId };
  if (row.vocabId !== null) return { type: "vocab", vocabId: row.vocabId };
  return null;
}

/** Filter Prisma untuk seluruh catatan pada satu target. */
export function targetWhere(target: CommentTarget) {
  return target.type === "question"
    ? { questionId: target.questionId }
    : { vocabId: target.vocabId };
}

/** Halaman penuh seluruh thread pada satu target. */
export function discussionPageHref(target: CommentTarget) {
  return target.type === "question"
    ? `/discussion/question/${target.questionId}`
    : `/flashcard/discussion/${target.vocabId}`;
}

/**
 * Tautan ke satu thread, opsional langsung ke salah satu balasannya. Thread soal
 * punya permalink sendiri; thread kata dibaca di halaman kata dengan anchor,
 * karena satu kata jarang punya banyak thread dan halaman itu juga memuat isi
 * kartunya.
 */
export function discussionThreadHref(
  root: { id: number } & TargetColumns,
  commentId: number = root.id,
) {
  if (root.vocabId !== null) return `/flashcard/discussion/${root.vocabId}#comment-${commentId}`;
  return commentId === root.id
    ? `/discussion/${root.id}`
    : `/discussion/${root.id}#comment-${commentId}`;
}
