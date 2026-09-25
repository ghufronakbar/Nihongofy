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

  // `id` dikirim terpisah sebagai prop, bukan sebagai field form — lihat
  // catatan di ArticleForm soal resolver tunggal.
  const { id: currentId, viewCount, favoriteCount, publishedAt, ...formValues } = article;

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
          {article.title}
        </h1>
        <p className="mt-1 text-xs font-semibold text-foreground/60">
          {viewCount} dilihat · {favoriteCount} favorit ·{" "}
          {publishedAt ? `terbit ${publishedAt.toISOString().slice(0, 10)}` : "belum pernah terbit"}
          {article.status === "PUBLISHED" && (
            <>
              {" · "}
              <Link
                href={`/article/${article.slug}`}
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
      <ArticleForm articleId={currentId} defaultValues={formValues} knownTags={knownTags} />
    </div>
  );
}
