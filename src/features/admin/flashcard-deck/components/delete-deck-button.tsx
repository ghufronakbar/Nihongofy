"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { deleteSystemDeckAction } from "../actions";

export function DeleteDeckButton({
  id,
  slug,
  noteCount,
}: {
  id: number;
  slug: string;
  noteCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmSlug, setConfirmSlug] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="neo-button self-start bg-white text-xs font-extrabold text-neo-coral"
      >
        <Trash2 className="size-4" />
        Hapus Deck
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 border-[3px] border-neo-ink bg-neo-coral/10 p-4">
      <p className="text-xs font-bold text-foreground/80">
        Menghapus deck ini beserta {noteCount} note-nya dari katalog. Koleksi user yang sudah
        menambahkannya tidak terpengaruh — isinya sudah disalin. Ketik slug untuk melanjutkan:
      </p>
      <p className="font-mono text-xs font-black">{slug}</p>
      <Input
        value={confirmSlug}
        disabled={isPending}
        onChange={(event) => setConfirmSlug(event.target.value)}
        placeholder="Ketik slug deck"
        className="font-mono text-xs"
      />
      {error && <p className="text-xs font-bold text-neo-coral">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={isPending || confirmSlug !== slug}
          onClick={() =>
            startTransition(async () => {
              const result = await deleteSystemDeckAction({ id, confirmSlug });
              if (result.ok) router.push("/admin/flashcard-deck");
              else setError(result.message);
            })
          }
          className="neo-button bg-neo-coral text-xs font-extrabold text-white disabled:opacity-50"
        >
          {isPending ? "Menghapus..." : "Hapus Permanen"}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            setOpen(false);
            setConfirmSlug("");
            setError(null);
          }}
          className="neo-button bg-white text-xs font-extrabold text-black"
        >
          Batal
        </button>
      </div>
    </div>
  );
}
