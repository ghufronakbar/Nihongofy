import Link from "next/link";
import type { Metadata } from "next";
import { ExternalLink, Plus, Search } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { FEATURES } from "@/constants";
import { listAdminArticles } from "@/features/admin/article/queries";
import { AdminArticleStatusSchema } from "@/features/admin/article/schemas";
import { ArticleRowActions } from "@/features/admin/article/components/article-row-actions";
import { formatArticleDate } from "@/features/article/lib/format";

export const metadata: Metadata = { title: "Artikel - Admin" };

const STATUS_TABS = [
  { value: "", label: "Semua" },
  { value: "DRAFT", label: "Draft" },
  { value: "PUBLISHED", label: "Published" },
  { value: "ARCHIVED", label: "Archived" },
] as const;

export default async function AdminArticleListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  await requireAdmin();

  const params = await searchParams;
  const parsedStatus = AdminArticleStatusSchema.safeParse(params.status);
  const status = parsedStatus.success ? parsedStatus.data : undefined;
  const query = (params.q ?? "").trim();

  const { items, counts } = await listAdminArticles({ status, query });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black uppercase text-neo-ink sm:text-3xl">Artikel</h1>
          <p className="mt-1 text-sm font-semibold text-foreground/70">
            {counts.total} artikel · {counts.published} terbit · {counts.draft} draft ·{" "}
            {counts.archived} arsip
          </p>
        </div>
        <Link
          href="/admin/article/new"
          className="neo-button bg-neo-blue text-sm font-extrabold text-white"
        >
          <Plus className="size-4" />
          Artikel Baru
        </Link>
      </div>

      {!FEATURES.article && (
        <p className="border-[3px] border-neo-ink bg-neo-yellow px-4 py-2.5 text-sm font-bold text-black shadow-neo-sm">
          Modul artikel sedang nonaktif untuk publik (FEATURES_ARTICLE=false). Perubahan di sini
          tetap tersimpan, tetapi belum terlihat pengunjung.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {STATUS_TABS.map((tab) => {
            const isActive = (params.status ?? "") === tab.value;
            const href = tab.value
              ? `/admin/article?status=${tab.value}${query ? `&q=${encodeURIComponent(query)}` : ""}`
              : `/admin/article${query ? `?q=${encodeURIComponent(query)}` : ""}`;
            return (
              <Link
                key={tab.label}
                href={href}
                className={`inline-flex items-center border-2 border-neo-ink px-3 py-1 font-mono text-xs font-black uppercase shadow-neo-sm transition-all hover:translate-x-[-1px] hover:translate-y-[-1px] ${
                  isActive ? "bg-neo-ink text-white" : "bg-white text-black"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>

        <form action="/admin/article" className="ml-auto flex items-center gap-2">
          {status && <input type="hidden" name="status" value={status} />}
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Cari judul, slug, kategori"
            className="h-9 w-56 border-2 border-neo-ink bg-white px-3 text-sm font-semibold shadow-neo-sm outline-none focus:bg-neo-paper"
          />
          <button
            type="submit"
            className="neo-button bg-white text-xs font-extrabold text-black"
            aria-label="Cari artikel"
          >
            <Search className="size-4" />
          </button>
        </form>
      </div>

      {items.length === 0 ? (
        <div className="neo-surface border-[3px] border-neo-ink bg-white p-6 text-sm font-semibold text-foreground/70 shadow-neo">
          Tidak ada artikel yang cocok.
        </div>
      ) : (
        <div className="neo-surface min-w-0 overflow-x-auto border-[3px] border-neo-ink bg-white shadow-neo">
          <table className="w-full min-w-3xl border-collapse text-sm">
            <thead>
              <tr className="border-b-[3px] border-neo-ink bg-neo-paper text-left">
                <th className="px-4 py-3 font-mono text-[10px] font-black uppercase">Judul</th>
                <th className="px-4 py-3 font-mono text-[10px] font-black uppercase">Kategori</th>
                <th className="px-4 py-3 font-mono text-[10px] font-black uppercase">Terbit</th>
                <th className="px-4 py-3 font-mono text-[10px] font-black uppercase">Statistik</th>
                <th className="px-4 py-3 font-mono text-[10px] font-black uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b-2 border-neo-ink/15 align-top last:border-b-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/article/${item.id}`}
                      className="font-black text-neo-ink underline-offset-4 hover:underline"
                    >
                      {item.title}
                    </Link>
                    <p className="mt-0.5 font-mono text-[11px] text-foreground/60">/{item.slug}</p>
                    {item.tags.length > 0 && (
                      <p className="mt-1 text-[11px] font-semibold text-foreground/60">
                        {item.tags.join(" · ")}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 font-semibold">{item.category}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-foreground/70">
                    {item.publishedAt ? formatArticleDate(item.publishedAt) : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold tabular-nums text-foreground/70">
                    {item.viewCount} dilihat · {item.favoriteCount} favorit
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-2">
                      <ArticleRowActions
                        id={item.id}
                        status={item.status}
                        isFeatured={item.isFeatured}
                        title={item.title}
                      />
                      {item.status === "PUBLISHED" && (
                        <Link
                          href={`/article/${item.slug}`}
                          target="_blank"
                          className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-foreground/60 hover:text-neo-blue"
                        >
                          <ExternalLink className="size-3" />
                          Lihat publik
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
