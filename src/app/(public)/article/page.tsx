import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Bookmark, Search } from "lucide-react";
import { ArticleCard } from "@/features/article/components/article-card";
import { ARTICLE_LEVELS } from "@/features/article/schemas";
import { getArticleFacets, getArticleIndexData } from "@/features/article/queries";
import { pageMetadata } from "@/lib/seo";
export const metadata: Metadata = pageMetadata({
  title: "Artikel & Bacaan Bahasa Jepang",
  description:
    "Temukan bacaan Jepang dengan furigana dan terjemahan Indonesia, budaya Jepang, serta panduan belajar sesuai levelmu.",
  path: "/article",
});
export default async function ArticleIndexPage() {
  const [{ featured, latest }, facets] = await Promise.all([
    getArticleIndexData(),
    getArticleFacets(),
  ]);
  return (
    <div className="bg-[#f5f7fb] pb-20 text-slate-900">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <header className="pt-10 pb-8 sm:pt-14 sm:pb-12">
          <div className="mb-6 flex items-center justify-between gap-4">
            <p className="text-sm font-semibold text-blue-700">Ruang baca Nihongofy</p>
            <Link
              href="/article/saved"
              className="inline-flex min-h-10 items-center gap-2 text-xs font-semibold text-slate-600"
            >
              <Bookmark className="size-4" />
              Artikel tersimpan
            </Link>
          </div>
          <h1 className="max-w-3xl text-4xl leading-[1.1] font-extrabold tracking-[-.045em] sm:text-6xl">
            Bacaan kecil.
            <br />
            Wawasan baru.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-8 text-slate-600 sm:text-lg">
            Jelajahi Jepang lewat cerita. Baca sesuai levelmu, buka furigana, dan temukan kata baru
            di setiap paragraf.
          </p>
          <form action="/article/search" method="get" className="mt-7 max-w-xl">
            <label
              htmlFor="article-query"
              className="mb-2 block text-xs font-semibold text-slate-600"
            >
              Cari bacaan
            </label>
            <div className="flex gap-2 rounded-lg border border-slate-300 bg-white p-1.5">
              <input
                id="article-query"
                name="q"
                type="search"
                maxLength={120}
                placeholder="Topik, judul, atau kata Jepang..."
                className="min-w-0 flex-1 rounded px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              />
              <button
                type="submit"
                aria-label="Cari artikel"
                className="grid size-11 shrink-0 place-items-center rounded-md bg-neo-ink text-white"
              >
                <Search className="size-5" />
              </button>
            </div>
          </form>
        </header>
        <nav
          aria-label="Pilih level bacaan"
          className="mb-9 flex flex-wrap items-center gap-2 border-y border-slate-200 py-5"
        >
          <span className="mr-2 text-xs font-semibold text-slate-500">Mulai dari levelmu</span>
          {ARTICLE_LEVELS.map((level) => (
            <Link
              key={level}
              href={`/article/search?level=${level}`}
              className="rounded-md border border-slate-200 bg-white px-4 py-2 text-xs font-semibold transition-colors hover:border-slate-500"
            >
              {level}
            </Link>
          ))}
          <Link
            href="/article/search"
            className="ml-auto inline-flex items-center gap-2 py-2 text-xs font-semibold text-slate-600"
          >
            Semua bacaan
            <ArrowRight className="size-4" />
          </Link>
        </nav>
        {featured && (
          <section aria-labelledby="featured-story">
            <h2 id="featured-story" className="mb-5 text-xl font-bold">
              Pilihan redaksi
            </h2>
            <ArticleCard article={featured} variant="featured" preload />
          </section>
        )}
        {latest.length > 0 && (
          <section className="mt-12">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-2xl">Baru di ruang baca</h2>
              <Link
                href="/article/search"
                className="text-xs font-semibold underline underline-offset-4"
              >
                Lihat semua
              </Link>
            </div>
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {latest.map((article) => (
                <ArticleCard key={article.id} article={article} variant="compact" />
              ))}
            </div>
          </section>
        )}
        {!featured && latest.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <h2 className="text-2xl">Cerita pertama sedang disiapkan.</h2>
            <p className="mt-3 text-sm text-slate-600">
              Segera kembali untuk menemukan bacaan baru dari redaksi.
            </p>
          </div>
        )}
        {facets.categories.length > 0 && (
          <section className="mt-12 border-t border-slate-200 pt-7">
            <h2 className="mb-4 text-lg">Ikuti rasa ingin tahumu</h2>
            <div className="flex flex-wrap gap-3">
              {facets.categories.map((category) => (
                <Link
                  key={category.categorySlug}
                  href={`/article/search?category=${category.categorySlug}`}
                  className="inline-flex items-center gap-4 rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm font-medium"
                >
                  {category.category}
                  <ArrowRight className="size-4 text-slate-400" />
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
