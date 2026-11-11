import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Bookmark, Clock3, MessageCircle } from "lucide-react";
import { FEATURES } from "@/constants";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { JapaneseText } from "@/components/japanese-text";
import { ArticleActions } from "@/features/article/components/article-actions";
import { ArticleReader } from "@/features/article/components/article-reader";
import { ArticleDiscussion } from "@/features/article/components/article-discussion";
import { ArticleCard } from "@/features/article/components/article-card";
import { formatArticleDate } from "@/features/article/lib/format";
import {
  ARTICLE_COMMENT_PAGE_SIZE,
  getArticleDetail,
  getArticleViewerState,
} from "@/features/article/queries";
import {
  getDiscussion,
  isPostingSuspended,
  withViewerVotes,
} from "@/features/question-comment/queries";
import { ReportButton } from "@/features/report/components/report-button";
import { DictionaryBoundary } from "@/features/dictionary/components/dictionary-boundary";
import { JsonLd } from "@/components/seo/json-ld";
import { articleJsonLd, breadcrumbJsonLd } from "@/lib/json-ld";
import { pageMetadata, privateMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticleDetail(slug);
  if (!article)
    return privateMetadata("Artikel tidak ditemukan", "Bacaan ini sudah tidak tersedia.");
  return pageMetadata({
    title: article.title,
    description: article.excerpt,
    path: `/article/${article.slug}`,
    images: [
      {
        url: article.coverImage,
        width: 1200,
        height: 675,
        alt: article.coverAlt,
      },
    ],
    keywords: article.tags.map((tag) => tag.label),
    article: {
      publishedTime: article.publishedAt?.toISOString(),
      modifiedTime: article.updatedAt.toISOString(),
      authors: [article.authorName],
      tags: article.tags.map((tag) => tag.label),
    },
  });
}
export default async function ArticleDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ slug }, search, session] = await Promise.all([params, searchParams, getSessionUser()]);
  const article = await getArticleDetail(slug);
  if (!article) notFound();
  const currentUserId = session?.userId ?? null;
  const rawPage = Number(search.comments ?? 1);
  const page = Number.isInteger(rawPage) && rawPage > 0 && rawPage <= 1000 ? rawPage : 1;
  const [viewer, roots, postingSuspended, commentCount] = await Promise.all([
    getArticleViewerState(article.id),
    getDiscussion(
      { type: "article", articleId: article.id },
      {
        take: ARTICLE_COMMENT_PAGE_SIZE + 1,
        skip: (page - 1) * ARTICLE_COMMENT_PAGE_SIZE,
      },
    ),
    isPostingSuspended(currentUserId),
    prisma.questionComment.count({
      where: { articleId: article.id, deletedAt: null, visibility: "PUBLIC" },
    }),
  ]);
  const threads = await withViewerVotes(roots.slice(0, ARTICLE_COMMENT_PAGE_SIZE), currentUserId);
  return (
    <div className="bg-[#f5f7fb] pb-16 text-slate-900">
      <JsonLd
        data={[
          articleJsonLd({
            slug: article.slug,
            title: article.title,
            excerpt: article.excerpt,
            coverImage: article.coverImage,
            authorName: article.authorName,
            publishedAt: article.publishedAt,
            updatedAt: article.updatedAt,
            category: article.category,
            tags: article.tags.map((tag) => tag.label),
            readTime: article.readTime,
            hasJapanese: article.hasJapanese,
          }),
          breadcrumbJsonLd([
            { name: "Beranda", path: "/" },
            { name: "Artikel", path: "/article" },
            { name: article.title, path: `/article/${article.slug}` },
          ]),
        ]}
      />
      <div className="mx-auto max-w-6xl px-4 pt-7 sm:px-6 lg:px-8">
        <nav
          aria-label="Navigasi artikel"
          className="flex flex-wrap items-center justify-between gap-4 text-xs font-semibold text-slate-600"
        >
          <Link
            href="/article"
            className="inline-flex min-h-10 items-center gap-2 hover:text-slate-900"
          >
            <ArrowLeft className="size-4" />
            Semua bacaan
          </Link>
          <Link
            href="/article/saved"
            className="inline-flex min-h-10 items-center gap-2 hover:text-slate-900"
          >
            <Bookmark className="size-4" />
            Artikel tersimpan
          </Link>
        </nav>
        <article>
          <header className="mx-auto max-w-4xl py-7 sm:py-10">
            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
              <Link
                href={`/article/search?category=${article.categorySlug}`}
                className="rounded border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-blue-800"
              >
                {article.category}
              </Link>
              {article.readingLevel && (
                <span
                  className="rounded border border-slate-300 bg-white px-2.5 py-1.5"
                  title="Perkiraan tingkat kesulitan bacaan Jepang"
                >
                  Bacaan {article.readingLevel}
                </span>
              )}
              <span className="text-slate-500">
                {article.hasJapanese ? "Indonesia & 日本語" : "Bahasa Indonesia"}
              </span>
            </div>
            <h1 className="mt-5 max-w-[25ch] text-4xl leading-[1.15] font-extrabold tracking-[-0.04em] sm:text-5xl">
              {article.title}
            </h1>
            {article.titleJa && (
              <p
                lang="ja"
                className="mt-4 font-[family-name:var(--font-article-japanese)] text-lg leading-10 text-slate-600 [&_rt]:hidden"
              >
                <JapaneseText text={article.titleJa} />
              </p>
            )}
            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
              {article.excerpt}
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500">
              <span className="font-semibold text-slate-800">{article.authorName}</span>
              <span>{formatArticleDate(article.publishedAt ?? article.updatedAt)}</span>
              <span className="inline-flex items-center gap-1.5">
                <Clock3 className="size-3.5" />
                {article.readTime} menit baca
              </span>
              <a href="#diskusi" className="inline-flex items-center gap-1.5 hover:text-slate-900">
                <MessageCircle className="size-3.5" />
                {commentCount} komentar
              </a>
            </div>
          </header>
          <figure className="mb-8">
            <div className="relative aspect-[16/8] overflow-hidden rounded-xl border border-slate-200 sm:aspect-[16/6.5]">
              <Image
                src={article.coverImage}
                alt={article.coverAlt}
                fill
                sizes="(max-width: 1152px) 100vw, 1088px"
                preload
                unoptimized={article.coverImage.startsWith("https://")}
                className="object-cover object-[center_58%]"
              />
            </div>
            {article.coverCredit && (
              <figcaption className="mt-2 text-right text-[11px] leading-5 text-slate-500">
                {article.coverCreditUrl ? (
                  <a
                    href={article.coverCreditUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2"
                  >
                    {article.coverCredit}
                  </a>
                ) : (
                  article.coverCredit
                )}
              </figcaption>
            )}
          </figure>
          <div className="mx-auto mb-5 max-w-5xl">
            <ArticleActions
              key={article.slug}
              slug={article.slug}
              title={article.title}
              excerpt={article.excerpt}
              initialSaved={viewer.saved}
              initialFavorited={viewer.favorited}
              initialFavoriteCount={article.favoriteCount}
              isAuthenticated={viewer.isAuthenticated}
            />
          </div>
          {article.body ? (
            <DictionaryBoundary scope={false} contextKey={`article:${article.slug}`}>
              <ArticleReader
                key={article.slug}
                blocks={article.body}
                hasJapanese={article.hasJapanese}
                glossary={article.glossary}
                contextKey={article.slug}
              />
            </DictionaryBoundary>
          ) : (
            <p className="rounded-xl border border-slate-200 bg-white p-8">
              Isi bacaan sedang diperbaiki. Silakan kembali beberapa saat lagi.
            </p>
          )}
          <footer className="mx-auto mt-7 flex max-w-5xl flex-wrap items-center justify-between gap-5 text-xs">
            <div className="flex flex-wrap gap-2">
              {article.tags.map((tag) => (
                <Link
                  key={tag.slug}
                  href={`/article/search?tags=${encodeURIComponent(tag.slug)}`}
                  className="rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-600 hover:border-slate-400"
                >
                  #{tag.label}
                </Link>
              ))}
            </div>
            {FEATURES.report && (
              <ReportButton
                target={{ targetType: "ARTICLE", articleId: article.id }}
                variant="link"
                label="Laporkan kekeliruan"
              />
            )}
          </footer>
        </article>
        <div className="mx-auto mt-12 max-w-5xl">
          <ArticleDiscussion
            key={article.id}
            articleId={article.id}
            slug={article.slug}
            roots={threads}
            currentUserId={currentUserId}
            isAdmin={session?.user.role === "ADMIN"}
            postingSuspended={postingSuspended}
            enabled={article.discussionEnabled}
            reportEnabled={FEATURES.report}
            total={commentCount}
          />
          <nav
            aria-label="Halaman komentar"
            className="mt-5 flex justify-between gap-4 text-sm font-semibold"
          >
            {page > 1 ? (
              <Link href={`/article/${slug}?comments=${page - 1}#diskusi`}>
                Komentar sebelumnya
              </Link>
            ) : (
              <span />
            )}
            {roots.length > ARTICLE_COMMENT_PAGE_SIZE && (
              <Link href={`/article/${slug}?comments=${page + 1}#diskusi`}>
                Komentar berikutnya →
              </Link>
            )}
          </nav>
        </div>
        {article.related.length > 0 && (
          <section className="mt-16">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <h2 className="text-2xl">Masih ingin membaca?</h2>
              <Link
                href="/article"
                className="inline-flex items-center gap-2 text-xs font-semibold"
              >
                Jelajahi bacaan
                <ArrowRight className="size-4" />
              </Link>
            </div>
            <div className="grid gap-5 md:grid-cols-3">
              {article.related.map((related) => (
                <ArticleCard key={related.id} article={related} variant="compact" />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
