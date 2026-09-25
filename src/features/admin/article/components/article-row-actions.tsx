"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Star, Trash2 } from "lucide-react";
import { NativeSelect } from "@/components/ui/native-select";
import {
  deleteArticleAction,
  setArticleFeaturedAction,
  setArticleStatusAction,
} from "../actions";
import type { AdminArticleStatus } from "../schemas";

export function ArticleRowActions({
  id,
  status,
  isFeatured,
  title,
}: {
  id: number;
  status: AdminArticleStatus;
  isFeatured: boolean;
  title: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <NativeSelect
        aria-label={`Status ${title}`}
        value={status}
        disabled={isPending}
        onChange={(event) => {
          const next = event.target.value as AdminArticleStatus;
          startTransition(async () => {
            await setArticleStatusAction({ id, status: next });
            router.refresh();
          });
        }}
        className="h-8 w-32 text-xs font-bold"
      >
        <option value="DRAFT">Draft</option>
        <option value="PUBLISHED">Published</option>
        <option value="ARCHIVED">Archived</option>
      </NativeSelect>

      <button
        type="button"
        disabled={isPending}
        aria-label={isFeatured ? `Lepas featured ${title}` : `Jadikan featured ${title}`}
        aria-pressed={isFeatured}
        onClick={() =>
          startTransition(async () => {
            await setArticleFeaturedAction({ id, isFeatured: !isFeatured });
            router.refresh();
          })
        }
        className={`grid size-8 shrink-0 place-items-center rounded-md border-2 border-neo-ink shadow-neo-sm transition-all hover:translate-x-[-1px] hover:translate-y-[-1px] ${
          isFeatured ? "bg-neo-yellow" : "bg-white"
        }`}
      >
        <Star className={`size-4 stroke-[2.5] ${isFeatured ? "fill-black" : ""}`} />
      </button>

      <button
        type="button"
        disabled={isPending}
        aria-label={`Hapus ${title}`}
        onClick={() => {
          // Hard delete dan ikut menghapus interaction user lewat cascade, jadi
          // konfirmasinya menyebut alternatif yang hampir selalu lebih tepat.
          const confirmed = window.confirm(
            `Hapus permanen "${title}"?\n\nInteraksi user (tersimpan/favorit) ikut terhapus dan tidak bisa dikembalikan. Untuk sekadar menurunkannya dari publik, pilih status Archived.`,
          );
          if (!confirmed) return;
          startTransition(async () => {
            await deleteArticleAction({ id });
            router.refresh();
          });
        }}
        className="grid size-8 shrink-0 place-items-center rounded-md border-2 border-neo-ink bg-white text-neo-coral shadow-neo-sm transition-all hover:bg-neo-coral hover:text-white"
      >
        <Trash2 className="size-4 stroke-[2.5]" />
      </button>
    </div>
  );
}
