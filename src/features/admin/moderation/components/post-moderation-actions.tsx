"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { RotateCcw, ShieldX } from "lucide-react";
import { restorePostAction, takedownPostAction } from "../actions";
import type { PostModerationState } from "../queries";

export function PostModerationActions({
  postId,
  state,
  canRestore,
}: {
  postId: number;
  state: PostModerationState;
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

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-2">
        {state === "VISIBLE" && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              if (
                !window.confirm(
                  "Takedown postingan ini?\n\nBaris tidak dihapus dari database, jadi masih dapat dipulihkan. Komentar dan like tetap ada; bila ada komentar, postingan tampil sebagai keterangan \"telah dihapus\".",
                )
              )
                return;
              run(() => takedownPostAction({ postId }));
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
            onClick={() => run(() => restorePostAction({ postId }))}
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
