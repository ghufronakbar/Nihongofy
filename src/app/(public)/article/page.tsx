import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpenText, Search, Tag } from "lucide-react";
import { PageContainer } from "@/components/marketing/page-container";
import { ArticleCard } from "@/features/article/components/article-card";
import { getArticleFacets, getArticleIndexData } from "@/features/article/queries";

export const metadata: Metadata = {
  title: "Artikel belajar bahasa Jepang",
  description:
    "Panduan belajar, strategi JLPT, tata bahasa, kosakata, dan latihan bahasa Jepang yang bisa langsung dipraktikkan.",
  alternates: { canonical: "/article" },
  openGraph: {
    title: "Artikel belajar bahasa Jepang | JLPT Exam",
    description:
      "Panduan belajar, strategi JLPT, tata bahasa, kosakata, dan latihan bahasa Jepang.",
    url: "/article",
    type: "website",
    locale: "id_ID",
  },
};

export default async function ArticleIndexPage() {
  const [{ featured, latest }, facets] = await Promise.all([
    getArticleIndexData(),
    getArticleFacets(),
  ]);

  return (
    <>
      <section className="neo-grid-paper border-b-[3px] border-neo-ink py-14 md:py-20">
        <PageContainer className="grid items-end gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <div className="neo-kicker page-reveal">
              <BookOpenText className="size-4" aria-hidden="true" />
              Bacaan untuk sesi berikutnya
            </div>
            <h1 className="page-reveal page-reveal-delay-1 mt-6 max-w-4xl text-5xl leading-[0.9] font-black tracking-[-0.065em] sm:text-7xl">
              BACA. COBA.
              <span className="block text-neo-blue [text-shadow:3px_3px_0_#111]">PAHAMI POLANYA.</span>
            </h1>
            <p className="page-reveal page-reveal-delay-2 mt-6 max-w-[58ch] text-lg leading-8 font-semibold text-foreground/70">
              Panduan belajar bahasa Jepang yang singkat, konkret, dan terhubung dengan latihan di JLPT Exam.
            </p>
          </div>

          <form
            action="/article/search"
            method="get"
            className="neo-surface page-reveal page-reveal-delay-2 -rotate-1 bg-white p-5 sm:p-6"
          >
            <label htmlFor="article-index-search" className="text-lg font-black">
              Cari topik yang sedang kamu pelajari
            </label>
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-slate-600"
                  aria-hidden="true"
                />
                <input
                  id="article-index-search"
                  name="q"
                  type="search"
                  maxLength={120}
                  className="neo-input pl-12"
                  placeholder="Hiragana, grammar, listening..."
                />
              </div>
              <button type="submit" className="neo-button bg-neo-yellow px-6">
                Cari artikel
                <ArrowRight className="size-5" aria-hidden="true" />
              </button>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {facets.tags.slice(0, 6).map((tag) => (
                <Link
                  key={tag.slug}
                  href={`/article/search?tags=${encodeURIComponent(tag.slug)}`}
                  className="border-2 border-neo-ink bg-background px-2.5 py-1 text-xs font-bold transition-colors hover:bg-neo-yellow"
                >
                  #{tag.label}
                </Link>
              ))}
            </div>
          </form>
        </PageContainer>
      </section>

      <section className="border-b-[3px] border-neo-ink bg-background py-16 md:py-22">
        <PageContainer>
          <div className="mb-9 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-4xl leading-none font-black sm:text-5xl">Pilihan utama</h2>
              <p className="mt-3 max-w-[55ch] leading-7 text-foreground/70">
                Mulai dari satu panduan, lalu buka alat belajar yang paling relevan.
              </p>
            </div>
            <Link href="/article/search" className="neo-button w-fit bg-white">
              Telusuri semua
              <ArrowRight className="size-5" aria-hidden="true" />
            </Link>
          </div>

          {featured ? (
            <ArticleCard article={featured} variant="featured" preload />
          ) : (
            <div className="neo-surface grid items-center gap-5 bg-white p-7 sm:grid-cols-[auto_1fr]">
              <div className="grid size-14 place-items-center border-[3px] border-neo-ink bg-neo-yellow shadow-neo-sm">
                <BookOpenText className="size-7" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-2xl">Belum ada artikel pilihan</h3>
                <p className="mt-2 text-foreground/70">
                  Artikel terbaru tetap dapat dibaca dari daftar di halaman ini.
                </p>
              </div>
            </div>
          )}
        </PageContainer>
      </section>

      <section className="border-b-[3px] border-neo-ink bg-white py-16 md:py-22">
        <PageContainer className="grid gap-12 lg:grid-cols-[1fr_18rem]">
          <div>
            <h2 className="text-4xl leading-none font-black sm:text-5xl">Terbit terbaru</h2>
            {latest.length > 0 ? (
              <div className="mt-9 grid gap-6">
                {latest.map((article) => (
                  <ArticleCard key={article.id} article={article} />
                ))}
              </div>
            ) : (
              <div className="neo-surface mt-9 bg-background p-8">
                <h3 className="text-2xl">Belum ada artikel lain</h3>
                <p className="mt-2 text-foreground/70">Kembali lagi setelah konten berikutnya diterbitkan.</p>
              </div>
            )}
          </div>

          <aside className="lg:sticky lg:top-28 lg:self-start">
            <div className="neo-surface bg-neo-yellow p-5">
              <Tag className="size-7" aria-hidden="true" />
              <h2 className="mt-4 text-2xl">Jelajahi kategori</h2>
              <nav className="mt-5 grid gap-2" aria-label="Kategori artikel">
                {facets.categories.map((category) => (
                  <Link
                    key={category.categorySlug}
                    href={`/article/search?category=${encodeURIComponent(category.categorySlug)}`}
                    className="flex items-center justify-between border-2 border-neo-ink bg-white px-3 py-2 font-bold transition-transform hover:-translate-y-0.5"
                  >
                    {category.category}
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                ))}
              </nav>
            </div>
          </aside>
        </PageContainer>
      </section>
    </>
  );
}
