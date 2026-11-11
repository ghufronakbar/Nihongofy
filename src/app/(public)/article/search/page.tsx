import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Search, SlidersHorizontal } from "lucide-react";
import { ARTICLE_LEVELS } from "@/features/article/schemas";
import { ArticleCard } from "@/features/article/components/article-card";
import {
  buildArticleSearchHref,
  getArticleFacets,
  parseArticleSearchParams,
  searchArticles,
} from "@/features/article/queries";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Cari artikel",
  description: "Temukan bacaan Indonesia dan Jepang berdasarkan topik, kategori, dan level bahasa.",
  path: "/article/search",
  noindex: "follow",
});

const fieldClass =
  "mt-2 min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20";
export default async function ArticleSearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const input = parseArticleSearchParams(await searchParams);
  const [facets, results] = await Promise.all([getArticleFacets(), searchArticles(input)]);
  const hasFilters = Boolean(
    input.query ||
      input.category ||
      input.tags.length ||
      input.level ||
      input.language ||
      input.sort !== "newest",
  );

  return (
    <div className="bg-[#f5f7fb] pb-16 text-slate-900">
      <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-6 lg:px-8">
        <Link
          href="/article"
          className="inline-flex min-h-10 items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Semua bacaan
        </Link>
        <header className="mt-5 mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Temukan bacaanmu</h1>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            Ikuti rasa ingin tahu, atau mulai dari level yang terasa nyaman.
          </p>
        </header>

        <div className="grid items-start gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">
          <form
            action="/article/search"
            method="get"
            className="rounded-xl border border-slate-200 bg-white p-5"
          >
            <details open>
              <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-bold">
                <SlidersHorizontal className="size-4" aria-hidden="true" />
                Sesuaikan bacaan
              </summary>
              <div className="mt-5 grid gap-5">
                <div>
                  <label htmlFor="article-search-query" className="text-xs font-semibold">
                    Kata kunci
                  </label>
                  <input
                    id="article-search-query"
                    name="q"
                    type="search"
                    maxLength={120}
                    defaultValue={input.query}
                    className={fieldClass}
                    placeholder="Judul atau kata Jepang..."
                  />
                </div>
                <div>
                  <label htmlFor="article-level" className="text-xs font-semibold">
                    Level bacaan Jepang
                  </label>
                  <select
                    id="article-level"
                    name="level"
                    defaultValue={input.level}
                    className={fieldClass}
                  >
                    <option value="">Semua level</option>
                    <option value="general">Tanpa level</option>
                    {ARTICLE_LEVELS.map((level) => (
                      <option key={level}>{level}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="article-language" className="text-xs font-semibold">
                    Bahasa tersedia
                  </label>
                  <select
                    id="article-language"
                    name="language"
                    defaultValue={input.language}
                    className={fieldClass}
                  >
                    <option value="">Semua bahasa</option>
                    <option value="bilingual">Jepang + Indonesia</option>
                    <option value="id">Indonesia saja</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="article-category" className="text-xs font-semibold">
                    Kategori
                  </label>
                  <select
                    id="article-category"
                    name="category"
                    defaultValue={input.category}
                    className={fieldClass}
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
                  <label htmlFor="article-sort" className="text-xs font-semibold">
                    Urutkan
                  </label>
                  <select
                    id="article-sort"
                    name="sort"
                    defaultValue={input.sort}
                    className={fieldClass}
                  >
                    <option value="newest">Terbaru</option>
                    <option value="oldest">Terlama</option>
                    <option value="mostLiked">Paling banyak disukai</option>
                    <option value="popular">Paling banyak dibaca</option>
                  </select>
                </div>
                {facets.tags.length > 0 && (
                  <fieldset>
                    <legend className="text-xs font-semibold">Tag topik</legend>
                    <p className="mt-1 text-[11px] leading-5 text-slate-500">
                      Bacaan memuat semua tag yang dipilih.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {facets.tags.map((tag) => (
                        <label key={tag.slug} className="cursor-pointer">
                          <input
                            type="checkbox"
                            name="tags"
                            value={tag.slug}
                            defaultChecked={input.tags.includes(tag.slug)}
                            className="peer sr-only"
                          />
                          <span className="block rounded-md border border-slate-200 px-2.5 py-2 text-xs text-slate-600 peer-checked:border-blue-600 peer-checked:bg-blue-50 peer-checked:text-blue-900 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-blue-600">
                            #{tag.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                )}
                <button
                  type="submit"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
                >
                  <Search className="size-4" aria-hidden="true" />
                  Terapkan filter
                </button>
                {hasFilters && (
                  <Link
                    href="/article/search"
                    className="text-center text-xs font-semibold text-slate-600 underline underline-offset-4"
                  >
                    Bersihkan filter
                  </Link>
                )}
              </div>
            </details>
          </form>

          <section aria-labelledby="article-search-results" className="min-w-0">
            <h2 id="article-search-results" className="text-xl">
              Hasil pencarian
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {results.total.toLocaleString("id-ID")} bacaan ditemukan
              {input.query ? ` untuk “${input.query}”` : ""}.
            </p>
            {results.articles.length > 0 ? (
              <div className="mt-6 grid gap-5">
                {results.articles.map((article) => (
                  <ArticleCard key={article.id} article={article} />
                ))}
              </div>
            ) : (
              <div className="mt-6 rounded-xl border border-slate-200 bg-white px-6 py-14 text-center">
                <Search className="mx-auto size-7 text-slate-400" aria-hidden="true" />
                <h3 className="mt-5 text-xl">Belum ada bacaan yang cocok</h3>
                <p className="mx-auto mt-3 max-w-sm text-sm leading-7 text-slate-600">
                  Coba ganti level atau kurangi tag. Bacaan baru akan terus ditambahkan.
                </p>
                <Link
                  href="/article/search"
                  className="mt-5 inline-flex min-h-10 items-center gap-2 text-sm font-semibold underline underline-offset-4"
                >
                  Lihat semua bacaan
                  <ArrowRight className="size-4" />
                </Link>
              </div>
            )}
            {results.nextCursor && (
              <Link
                href={buildArticleSearchHref(input, {
                  cursor: results.nextCursor,
                })}
                className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-300 bg-white px-5 text-sm font-semibold"
              >
                Bacaan berikutnya
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
