import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Search, SlidersHorizontal, Tag, X } from "lucide-react";
import { PageContainer } from "@/components/marketing/page-container";
import { ArticleCard } from "@/features/article/components/article-card";
import {
  buildArticleSearchHref,
  getArticleFacets,
  parseArticleSearchParams,
  searchArticles,
} from "@/features/article/queries";

export const metadata: Metadata = {
  title: "Cari artikel",
  description: "Cari artikel belajar bahasa Jepang berdasarkan kata kunci, kategori, dan tag.",
  alternates: { canonical: "/article/search" },
  robots: { index: false, follow: true },
};

export default async function ArticleSearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const input = parseArticleSearchParams(await searchParams);
  const [facets, results] = await Promise.all([getArticleFacets(), searchArticles(input)]);
  const hasFilters = Boolean(
    input.query || input.category || input.tags.length > 0 || input.sort !== "newest",
  );

  return (
    <>
      <section className="neo-grid-paper border-b-[3px] border-neo-ink py-12 md:py-16">
        <PageContainer>
          <Link
            href="/article"
            className="inline-flex items-center gap-2 font-bold underline decoration-2 underline-offset-4"
          >
            <ArrowLeft className="size-5" aria-hidden="true" />
            Kembali ke artikel
          </Link>
          <div className="mt-7 flex items-start gap-4">
            <div className="grid size-14 shrink-0 place-items-center border-[3px] border-neo-ink bg-neo-yellow shadow-neo-sm">
              <Search className="size-7" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-4xl leading-none font-black sm:text-6xl">Cari artikel</h1>
              <p className="mt-3 max-w-[55ch] text-lg leading-8 text-foreground/70">
                Gunakan kata kunci, kategori, dan tag untuk mempersempit bacaan.
              </p>
            </div>
          </div>
        </PageContainer>
      </section>

      <section className="border-b-[3px] border-neo-ink bg-white py-10">
        <PageContainer>
          <form action="/article/search" method="get" className="grid gap-7">
            <div>
              <label htmlFor="article-search-query" className="font-black">
                Kata kunci
              </label>
              <div className="relative mt-2">
                <Search
                  className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-slate-600"
                  aria-hidden="true"
                />
                <input
                  id="article-search-query"
                  name="q"
                  type="search"
                  maxLength={120}
                  defaultValue={input.query}
                  className="neo-input pl-12"
                  placeholder="Cari judul, isi, atau penulis"
                />
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label htmlFor="article-category" className="flex items-center gap-2 font-black">
                  <SlidersHorizontal className="size-4" aria-hidden="true" />
                  Kategori
                </label>
                <select
                  id="article-category"
                  name="category"
                  defaultValue={input.category}
                  className="neo-input mt-2 appearance-auto"
                >
                  <option value="">Semua kategori</option>
                  {facets.categories.map((category) => (
                    <option key={category.categorySlug} value={category.categorySlug}>
                      {category.category}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="article-sort" className="font-black">
                  Urutkan
                </label>
                <select
                  id="article-sort"
                  name="sort"
                  defaultValue={input.sort}
                  className="neo-input mt-2 appearance-auto"
                >
                  <option value="newest">Terbaru</option>
                  <option value="oldest">Terlama</option>
                  <option value="popular">Paling banyak dibaca</option>
                  <option value="mostLiked">Paling banyak difavoritkan</option>
                </select>
              </div>
            </div>

            <fieldset>
              <legend className="flex items-center gap-2 font-black">
                <Tag className="size-4" aria-hidden="true" />
                Tag, pilih satu atau lebih
              </legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {facets.tags.map((tag) => {
                  const selected = input.tags.includes(tag.slug);
                  return (
                    <label
                      key={tag.slug}
                      className="cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        name="tags"
                        value={tag.slug}
                        defaultChecked={selected}
                        className="peer sr-only"
                      />
                      <span
                        className={`block border-2 border-neo-ink px-3 py-1.5 text-sm font-bold transition-[transform,box-shadow,background-color] peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-3 peer-focus-visible:outline-neo-blue ${selected ? "bg-neo-yellow shadow-neo-sm" : "bg-background hover:-translate-y-0.5"}`}
                      >
                        #{tag.label}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div className="flex flex-wrap gap-3">
              <button type="submit" className="neo-button bg-neo-blue px-7">
                Terapkan filter
                <Search className="size-5" aria-hidden="true" />
              </button>
              {hasFilters ? (
                <Link href="/article/search" className="neo-button bg-white">
                  <X className="size-5" aria-hidden="true" />
                  Bersihkan
                </Link>
              ) : null}
            </div>
          </form>
        </PageContainer>
      </section>

      <section className="bg-background py-14 md:py-18">
        <PageContainer>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-3xl font-black">Hasil pencarian</h2>
              <p className="mt-2 font-bold text-foreground/65">
                {results.total.toLocaleString("id-ID")} artikel ditemukan
                {input.query ? ` untuk “${input.query}”` : ""}.
              </p>
            </div>
          </div>

          {results.articles.length > 0 ? (
            <div className="mt-8 grid gap-6">
              {results.articles.map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </div>
          ) : (
            <div className="neo-surface mt-8 grid gap-6 bg-white p-8 text-center sm:p-12">
              <Search className="mx-auto size-12" aria-hidden="true" />
              <div>
                <h3 className="text-3xl">Belum ada artikel yang cocok</h3>
                <p className="mx-auto mt-3 max-w-[55ch] leading-7 text-foreground/70">
                  Coba kurangi jumlah tag, ganti kategori, atau gunakan kata kunci yang lebih pendek.
                </p>
              </div>
              <Link href="/article/search" className="neo-button mx-auto bg-neo-yellow">
                Bersihkan filter
              </Link>
            </div>
          )}

          {results.nextCursor ? (
            <div className="mt-9 flex justify-center">
              <Link
                href={buildArticleSearchHref(input, { cursor: results.nextCursor })}
                className="neo-button bg-neo-yellow px-8"
              >
                Muat artikel berikutnya
                <ArrowRight className="size-5" aria-hidden="true" />
              </Link>
            </div>
          ) : null}
        </PageContainer>
      </section>
    </>
  );
}
