import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock3, Eye, Tag } from "lucide-react";
import { PageContainer } from "@/components/marketing/page-container";
import { ArticleActions } from "@/features/article/components/article-actions";
import { ArticleBody } from "@/features/article/components/article-body";
import { ArticleCard } from "@/features/article/components/article-card";
import { formatArticleCount, formatArticleDate } from "@/features/article/lib/format";
import { getArticleDetail, getArticleViewerState } from "@/features/article/queries";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticleDetail(slug);
  if (!article) return { title: "Artikel tidak ditemukan" };

  return {
    title: article.title,
    description: article.excerpt,
    authors: [{ name: article.authorName }],
    alternates: { canonical: `/article/${article.slug}` },
    openGraph: {
      title: article.title,
      description: article.excerpt,
      type: "article",
      locale: "id_ID",
      url: `/article/${article.slug}`,
      publishedTime: article.publishedAt?.toISOString(),
      modifiedTime: article.updatedAt.toISOString(),
      authors: [article.authorName],
      tags: article.tags.map((tag) => tag.label),
      images: [
        {
          url: article.coverImage,
          width: 1200,
          height: 675,
          alt: article.coverAlt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: article.excerpt,
      images: [article.coverImage],
    },
  };
}

export default async function ArticleDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await getArticleDetail(slug);
  if (!article) notFound();

  const viewerState = await getArticleViewerState(article.id);
  const authorInitials = article.authorName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <>
      <article>
        <header className="border-b-[3px] border-neo-ink bg-white py-10 md:py-14">
          <PageContainer>
            <Link
              href="/article"
              className="inline-flex items-center gap-2 font-bold underline decoration-2 underline-offset-4"
            >
              <ArrowLeft className="size-5" aria-hidden="true" />
              Semua artikel
            </Link>

            <div className="mt-8 grid gap-10 lg:grid-cols-[1.03fr_0.97fr] lg:items-center">
              <div className="order-2 lg:order-1">
                <div className="flex flex-wrap items-center gap-3 font-mono text-sm font-bold">
                  <span className="border-2 border-neo-ink bg-neo-yellow px-3 py-1.5 text-black">
                    {article.category}
                  </span>
                  <span>{formatArticleDate(article.publishedAt ?? article.updatedAt)}</span>
                </div>
                <h1 className="mt-6 max-w-4xl text-4xl leading-[0.94] font-black tracking-[-0.055em] sm:text-6xl">
                  {article.title}
                </h1>
                <p className="mt-6 max-w-[60ch] text-lg leading-8 font-semibold text-foreground/70">
                  {article.excerpt}
                </p>
                <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-bold text-foreground/65">
                  <span>{article.authorName}</span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock3 className="size-4" aria-hidden="true" />
                    {article.readTime} menit baca
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Eye className="size-4" aria-hidden="true" />
                    {formatArticleCount(article.viewCount)} pembaca akun
                  </span>
                </div>
              </div>

              <div className="neo-surface relative order-1 aspect-[16/10] overflow-hidden bg-neo-blue lg:order-2 lg:rotate-1">
                <Image
                  src={article.coverImage}
                  alt={article.coverAlt}
                  fill
                  sizes="(max-width: 1024px) 100vw, 48vw"
                  preload
                  className="object-cover"
                />
              </div>
            </div>
          </PageContainer>
        </header>

        <section className="border-b-[3px] border-neo-ink bg-background py-6">
          <PageContainer>
            <ArticleActions
              slug={article.slug}
              title={article.title}
              excerpt={article.excerpt}
              initialSaved={viewerState.saved}
              initialFavorited={viewerState.favorited}
              initialFavoriteCount={article.favoriteCount}
              isAuthenticated={viewerState.isAuthenticated}
            />
          </PageContainer>
        </section>

        <section className="bg-background py-12 md:py-18">
          <PageContainer className="grid gap-10 lg:grid-cols-[minmax(0,46rem)_17rem] lg:justify-center">
            <div className="neo-surface bg-white p-6 sm:p-9 md:p-12">
              {article.body ? (
                <ArticleBody blocks={article.body} />
              ) : (
                <div className="border-[3px] border-neo-ink bg-neo-yellow p-6">
                  <h2 className="text-2xl">Isi artikel sedang diperbaiki</h2>
                  <p className="mt-2">Metadata artikel tetap tersedia. Silakan kembali beberapa saat lagi.</p>
                </div>
              )}

              <div className="mt-12 border-t-[3px] border-neo-ink pt-7">
                <div className="flex flex-wrap items-center gap-2">
                  <Tag className="size-5" aria-hidden="true" />
                  {article.tags.map((tag) => (
                    <Link
                      key={tag.slug}
                      href={`/article/search?tags=${encodeURIComponent(tag.slug)}`}
                      className="border-2 border-neo-ink bg-background px-3 py-1.5 text-sm font-bold transition-colors hover:bg-neo-yellow"
                    >
                      #{tag.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            <aside className="lg:sticky lg:top-28 lg:self-start">
              <div className="neo-surface bg-neo-blue p-5 text-neo-ink">
                <div className="grid size-16 place-items-center border-[3px] border-neo-ink bg-white text-xl font-black shadow-neo-sm">
                  {authorInitials}
                </div>
                <p className="mt-5 font-mono text-xs font-bold uppercase">Ditulis oleh</p>
                <h2 className="mt-2 text-2xl">{article.authorName}</h2>
                {article.authorRole ? <p className="mt-2 leading-7">{article.authorRole}</p> : null}
              </div>
            </aside>
          </PageContainer>
        </section>
      </article>

      {article.related.length > 0 ? (
        <section className="border-t-[3px] border-neo-ink bg-white py-16 md:py-22">
          <PageContainer>
            <h2 className="text-4xl leading-none font-black sm:text-5xl">Lanjutkan membaca</h2>
            <div className="mt-9 grid gap-6 md:grid-cols-12">
              {article.related.map((related, index) => (
                <div key={related.id} className={index === 0 ? "md:col-span-7 md:row-span-2" : "md:col-span-5"}>
                  <ArticleCard article={related} variant="compact" />
                </div>
              ))}
            </div>
          </PageContainer>
        </section>
      ) : null}
    </>
  );
}
