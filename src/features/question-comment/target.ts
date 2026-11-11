import { z } from "zod";

/**
 * Sasaran catatan/diskusi: soal JLPT, kata flashcard, pola bunpou, postingan,
 * atau artikel. Satu tabel melayani kelimanya dengan tepat satu target terisi.
 * Artikel dan postingan hanya menerima komentar publik.
 *
 * Aman untuk client — dipakai form dan pembentuk tautan.
 */
export const CommentTargetSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("question"),
    questionId: z.number().int().positive(),
  }),
  z.object({ type: z.literal("vocab"), vocabId: z.number().int().positive() }),
  z.object({
    type: z.literal("bunpou"),
    bunpouPointId: z.number().int().positive(),
  }),
  z.object({ type: z.literal("post"), postId: z.number().int().positive() }),
  z.object({
    type: z.literal("article"),
    articleId: z.number().int().positive(),
  }),
]);

export type CommentTarget = z.infer<typeof CommentTargetSchema>;

export type CommentTargetColumns = {
  questionId: number | null;
  vocabId: number | null;
  bunpouPointId: number | null;
  postId: number | null;
  articleId?: number | null;
};

/** Target dari kolom baris database; null hanya bila CHECK di database dilanggar. */
export function targetOf(row: CommentTargetColumns): CommentTarget | null {
  if (row.questionId !== null) return { type: "question", questionId: row.questionId };
  if (row.vocabId !== null) return { type: "vocab", vocabId: row.vocabId };
  if (row.bunpouPointId !== null) return { type: "bunpou", bunpouPointId: row.bunpouPointId };
  if (row.articleId != null) return { type: "article", articleId: row.articleId };
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
    articleId: target.type === "article" ? target.articleId : null,
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
    case "article":
      return { articleId: target.articleId };
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
    case "article":
      return `/article/read/${target.articleId}`;
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
  if (root.articleId != null) return `/article/read/${root.articleId}?comment=${commentId}`;
  if (root.vocabId !== null) return `/flashcard/discussion/${root.vocabId}#comment-${commentId}`;
  if (root.bunpouPointId !== null) return bunpouDiscussionHref(root.bunpouPointId, commentId);
  // Komentar postingan dibaca di permalink postingannya.
  if (root.postId !== null) return `/post/${root.postId}#comment-${commentId}`;
  return commentId === root.id
    ? `/discussion/${root.id}`
    : `/discussion/${root.id}#comment-${commentId}`;
}
