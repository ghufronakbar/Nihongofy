import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getArticleCommentLocation } from "@/features/article/queries";
export default async function ArticleByIdPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ comment?: string }>;
}) {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  const articleId = Number(id);
  if (!Number.isSafeInteger(articleId) || articleId <= 0) notFound();
  const article = await prisma.article.findFirst({
    where: {
      id: articleId,
      status: "PUBLISHED",
      publishedAt: { lte: new Date() },
    },
    select: { slug: true },
  });
  if (!article) notFound();
  const comment = Number(search.comment);
  const location =
    Number.isSafeInteger(comment) && comment > 0
      ? await getArticleCommentLocation(articleId, comment)
      : null;
  redirect(
    `/article/${article.slug}${location ? `?comments=${location.page}#comment-${location.commentId}` : "#diskusi"}`,
  );
}
