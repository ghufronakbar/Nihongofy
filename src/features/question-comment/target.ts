import { z } from "zod";

/**
 * Sasaran sebuah catatan: soal JLPT, kata flashcard, pola bunpou, atau postingan
 * komunitas. Satu tabel (`QuestionComment`) melayani keempatnya, dengan tepat
 * satu kolom target terisi. Postingan hanya menerima komentar publik — tidak ada
 * catatan privat pada postingan.
 *
 * Aman untuk client — dipakai form dan pembentuk tautan.
 */
export const CommentTargetSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("question"), questionId: z.number().int().positive() }),
  z.object({ type: z.literal("vocab"), vocabId: z.number().int().positive() }),
  z.object({ type: z.literal("bunpou"), bunpouPointId: z.number().int().positive() }),
  z.object({ type: z.literal("post"), postId: z.number().int().positive() }),
]);

export type CommentTarget = z.infer<typeof CommentTargetSchema>;

export type CommentTargetColumns = {
  questionId: number | null;
  vocabId: number | null;
  bunpouPointId: number | null;
  postId: number | null;
};

/** Target dari kolom baris database; null hanya bila CHECK di database dilanggar. */
export function targetOf(row: CommentTargetColumns): CommentTarget | null {
  if (row.questionId !== null) return { type: "question", questionId: row.questionId };
  if (row.vocabId !== null) return { type: "vocab", vocabId: row.vocabId };
  if (row.bunpouPointId !== null) return { type: "bunpou", bunpouPointId: row.bunpouPointId };
  if (row.postId !== null) return { type: "post", postId: row.postId };
  return null;
}

/** Kolom target untuk baris baru; tepat satu terisi. */
export function targetColumns(target: CommentTarget): CommentTargetColumns {
  return {
    questionId: target.type === "question" ? target.questionId : null,
    vocabId: target.type === "vocab" ? target.vocabId : null,
    bunpouPointId: target.type === "bunpou" ? target.bunpouPointId : null,
    postId: target.type === "post" ? target.postId : null,
  };
}

/** Filter Prisma untuk seluruh catatan pada satu target. */
export function targetWhere(target: CommentTarget) {
  switch (target.type) {
    case "question":
      return { questionId: target.questionId };
    case "vocab":
      return { vocabId: target.vocabId };
    case "bunpou":
      return { bunpouPointId: target.bunpouPointId };
    case "post":
      return { postId: target.postId };
  }
}

/**
 * Halaman pola memakai `key` di URL, sedangkan baris catatan hanya membawa id.
 * Route ini mengalihkan id ke `/bunpou/<key>#diskusi` (atau ke satu entri bila
 * `comment` diisi), supaya pembentuk tautan di sini tidak perlu ikut memuat key.
 */
function bunpouDiscussionHref(bunpouPointId: number, commentId?: number) {
  const base = `/bunpou/discussion/${bunpouPointId}`;
  return commentId === undefined ? base : `${base}?comment=${commentId}`;
}

/** Halaman penuh seluruh thread pada satu target. */
export function discussionPageHref(target: CommentTarget) {
  switch (target.type) {
    case "question":
      return `/discussion/question/${target.questionId}`;
    case "vocab":
      return `/flashcard/discussion/${target.vocabId}`;
    case "bunpou":
      return bunpouDiscussionHref(target.bunpouPointId);
    case "post":
      return `/post/${target.postId}`;
  }
}

/**
 * Tautan ke satu thread, opsional langsung ke salah satu balasannya. Thread soal
 * punya permalink sendiri; thread kata dan pola dibaca di halaman target dengan
 * anchor, karena satu target jarang punya banyak thread dan halaman itu juga
 * memuat isinya.
 */
export function discussionThreadHref(
  root: { id: number } & CommentTargetColumns,
  commentId: number = root.id,
) {
  if (root.vocabId !== null) return `/flashcard/discussion/${root.vocabId}#comment-${commentId}`;
  if (root.bunpouPointId !== null) return bunpouDiscussionHref(root.bunpouPointId, commentId);
  // Komentar postingan dibaca di permalink postingannya.
  if (root.postId !== null) return `/post/${root.postId}#comment-${commentId}`;
  return commentId === root.id
    ? `/discussion/${root.id}`
    : `/discussion/${root.id}#comment-${commentId}`;
}
