import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { listArticleTagLabels } from "@/features/admin/article/queries";
import { ArticleForm } from "@/features/admin/article/components/article-form";

export const metadata: Metadata = { title: "Artikel Baru - Admin" };

export default async function AdminArticleNewPage() {
  await requireAdmin();
  const knownTags = await listArticleTagLabels();

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
          Artikel Baru
        </h1>
      </div>
      <ArticleForm knownTags={knownTags} />
    </div>
  );
}
