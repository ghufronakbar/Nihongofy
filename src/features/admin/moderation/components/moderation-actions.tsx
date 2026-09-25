"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { EyeOff, RotateCcw, ShieldX } from "lucide-react";
import {
  hideDiscussionRootAction,
  restoreCommentAction,
  takedownCommentAction,
} from "../actions";
import type { ModerationEntryState } from "../queries";

export function ModerationActions({
  commentId,
  kind,
  state,
  canRestore,
}: {
  commentId: number;
  kind: "root" | "reply";
  state: ModerationEntryState;
  canRestore: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(work: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await work();
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Aksi gagal.");
      }
    });
  }

  const isRemoved = state === "TAKEN_DOWN" || state === "REMOVED_BY_OWNER";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-2">
        {kind === "root" && state === "VISIBLE" && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              if (
                !window.confirm(
                  "Sembunyikan catatan ini dari diskusi?\n\nIsinya berhenti tampil, tetapi balasan orang lain tetap ada. Tidak ada tombol untuk menerbitkannya kembali — keputusan membagikan catatan adalah milik penulisnya.",
                )
              )
                return;
              run(() => hideDiscussionRootAction({ commentId }));
            }}
            className="neo-button bg-white text-[11px] font-extrabold text-black"
          >
            <EyeOff className="size-3.5" />
            Sembunyikan
          </button>
        )}

        {!isRemoved && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              if (
                !window.confirm(
                  "Takedown entri ini?\n\nBaris tidak dihapus dari database, jadi masih dapat dipulihkan dan tetap terhitung dalam riwayat user. File gambar di Cloudinary tidak ikut dihapus.",
                )
              )
                return;
              run(() => takedownCommentAction({ commentId }));
            }}
            className="neo-button bg-neo-coral text-[11px] font-extrabold text-white"
          >
            <ShieldX className="size-3.5" />
            Takedown
          </button>
        )}

        {canRestore && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(() => restoreCommentAction({ commentId }))}
            className="neo-button bg-neo-yellow text-[11px] font-extrabold text-black"
          >
            <RotateCcw className="size-3.5" />
            Pulihkan
          </button>
        )}

        {state === "REMOVED_BY_OWNER" && (
          <span className="font-mono text-[10px] font-bold text-foreground/50">
            dihapus pemiliknya — tidak dapat dipulihkan admin
          </span>
        )}
      </div>

      {error && <p className="text-[11px] font-bold text-neo-coral">{error}</p>}
    </div>
  );
}
