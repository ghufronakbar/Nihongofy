import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { getAdminArticle, listArticleTagLabels } from "@/features/admin/article/queries";
import { ArticleForm } from "@/features/admin/article/components/article-form";

export const metadata: Metadata = { title: "Edit Artikel - Admin" };

export default async function AdminArticleEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();

  const { id } = await params;
  const articleId = Number(id);
  if (!Number.isInteger(articleId) || articleId <= 0) notFound();

  const [article, knownTags] = await Promise.all([
    getAdminArticle(articleId),
    listArticleTagLabels(),
  ]);
  if (!article) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/admin/article"
          className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-foreground/60 hover:text-neo-blue"
        >
          <ArrowLeft className="size-3.5" />
          Kembali ke daftar
        </Link>
        <h1 className="mt-2 text-2xl font-black uppercase text-neo-ink sm:text-3xl">
          {article.values.title}
        </h1>
        <p className="mt-1 text-xs font-semibold text-foreground/60">
          {article.viewCount} dilihat · {article.favoriteCount} suka ·{" "}
          {article.publishedAt
            ? `terbit ${article.publishedAt.toISOString().slice(0, 10)}`
            : "belum pernah terbit"}
          {article.liveStatus === "PUBLISHED" && (
            <>
              {" · "}
              <Link
                href={`/article/${article.values.slug}`}
                target="_blank"
                className="inline-flex items-center gap-1 hover:text-neo-blue"
              >
                <ExternalLink className="size-3" />
                lihat publik
              </Link>
            </>
          )}
        </p>
      </div>
      <ArticleForm
        articleId={article.id}
        defaultValues={article.values}
        knownTags={knownTags}
        liveStatus={article.liveStatus}
        slugLocked={Boolean(article.publishedAt)}
        hasDraft={article.hasDraft}
      />
    </div>
  );
}
