"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { NativeSelect } from "@/components/ui/native-select";
import { deleteArticleAction, setArticleFeaturedAction, setArticleStatusAction } from "../actions";
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
          if (next === "PUBLISHED") {
            router.push(`/admin/article/${id}`);
            return;
          }
          startTransition(async () => {
            try {
              const result = await setArticleStatusAction({ id, status: next });
              if (!result.ok) {
                toast.error(result.message);
                return;
              }
              toast.success(
                next === "ARCHIVED" ? "Artikel diarsipkan." : "Artikel ditarik ke draf.",
              );
              router.refresh();
            } catch {
              toast.error("Status belum tersimpan. Coba lagi.");
            }
          });
        }}
        className="h-8 w-32 text-xs font-bold"
      >
        <option value="DRAFT">Draf</option>
        <option value="PUBLISHED">
          {status === "PUBLISHED" ? "Terbit" : "Terbitkan lewat editor"}
        </option>
        <option value="ARCHIVED">Arsip</option>
      </NativeSelect>

      <button
        type="button"
        disabled={isPending}
        aria-label={isFeatured ? `Lepas featured ${title}` : `Jadikan featured ${title}`}
        aria-pressed={isFeatured}
        onClick={() =>
          startTransition(async () => {
            try {
              const result = await setArticleFeaturedAction({
                id,
                isFeatured: !isFeatured,
              });
              if (!result.ok) return;
              router.refresh();
            } catch {
              toast.error("Pilihan redaksi belum tersimpan. Coba lagi.");
            }
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
          if (status === "PUBLISHED") {
            toast.error("Arsipkan artikel terbit agar diskusi dan tautannya tetap tersimpan.");
            return;
          }
          const confirmed = window.confirm(
            `Hapus permanen draf "${title}"?\n\nHanya draf yang belum pernah terbit dan tidak memiliki diskusi yang bisa dihapus. Untuk artikel lainnya, gunakan Arsip.`,
          );
          if (!confirmed) return;
          startTransition(async () => {
            try {
              const result = await deleteArticleAction({ id });
              if (!result.ok) {
                toast.error(result.message);
                return;
              }
              toast.success("Draf dihapus.");
              router.refresh();
            } catch {
              toast.error("Draf belum terhapus. Coba lagi.");
            }
          });
        }}
        className="grid size-8 shrink-0 place-items-center rounded-md border-2 border-neo-ink bg-white text-neo-coral shadow-neo-sm transition-all hover:bg-neo-coral hover:text-white"
      >
        <Trash2 className="size-4 stroke-[2.5]" />
      </button>
    </div>
  );
}
