import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Bookmark } from "lucide-react";
import { getSession } from "@/lib/auth";
import { privateMetadata } from "@/lib/seo";
import { getSavedArticles } from "@/features/article/queries";
import { ArticleCard } from "@/features/article/components/article-card";
export const metadata = privateMetadata(
  "Artikel tersimpan",
  "Koleksi bacaan pribadi untuk dibaca kembali.",
);
export default async function SavedArticlePage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login?next=%2Farticle%2Fsaved");
  const params = await searchParams;
  const cursor = Number(params.cursor);
  const { articles, nextCursor } = await getSavedArticles(
    session.userId,
    Number.isSafeInteger(cursor) && cursor > 0 ? cursor : undefined,
  );
  return (
    <div className="min-h-[60dvh] bg-[#f5f7fb] py-10">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <Link
          href="/article"
          className="mb-7 inline-flex items-center gap-2 text-sm font-semibold"
        >
          <ArrowLeft className="size-4" />
          Ruang baca
        </Link>
        <h1 className="flex items-center gap-3 text-3xl">
          <Bookmark className="size-7" />
          Disimpan untuk nanti
        </h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          Bacaan pilihanmu, siap saat kamu punya waktu.
        </p>
        {articles.length ? (
          <div className="mt-8 grid gap-5">
            {articles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <Bookmark className="mx-auto mb-4 size-10 text-slate-400" />
            <h2 className="text-xl">Belum ada bacaan tersimpan.</h2>
            <p className="mt-3 text-sm text-slate-600">
              Tekan Simpan di artikel yang ingin kamu baca kembali.
            </p>
            <Link href="/article" className="neo-button mt-6 bg-white text-sm">
              Temukan bacaan
            </Link>
          </div>
        )}
        {nextCursor && (
          <Link
            href={`/article/saved?cursor=${nextCursor}`}
            className="mt-7 inline-block text-sm font-semibold underline underline-offset-4"
          >
            Bacaan tersimpan berikutnya
          </Link>
        )}
      </div>
    </div>
  );
}
