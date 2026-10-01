"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, Loader2, RotateCcw, Undo2 } from "lucide-react";
import { resetCardAction, setCardSuspendedAction } from "../actions";
import type { DeckWordStatus } from "../types";

type Props = {
  vocabId: number;
  word: string;
  status: DeckWordStatus;
  hasCard: boolean;
};

/** Aksi per kata di daftar kata: suspend/lepas suspend dan reset ke kartu baru. */
export function DeckWordActions({ vocabId, word, status, hasCard }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const suspended = status === "suspended";

  const run = (action: () => Promise<{ ok: boolean; message?: string }>, success: string) => {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.message ?? "Gagal menyimpan.");
        return;
      }
      toast.success(success);
      router.refresh();
    });
  };

  const reset = () => {
    if (!window.confirm(`Reset "${word}" menjadi kartu baru? Jadwal belajarnya akan dihapus.`)) return;
    run(() => resetCardAction({ vocabId }), "Kartu direset menjadi kartu baru.");
  };

  return (
    <div className="flex shrink-0 items-center gap-1">
      {pending ? <Loader2 className="size-4 animate-spin" aria-label="Menyimpan" /> : null}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          run(
            () => setCardSuspendedAction({ vocabId, suspended: !suspended }),
            suspended ? "Suspend dilepas." : "Kartu di-suspend.",
          )
        }
        className="neo-button min-h-9 bg-white px-2 py-1 text-xs"
        aria-label={suspended ? `Lepas suspend ${word}` : `Suspend ${word}`}
        title={suspended ? "Lepas suspend" : "Suspend"}
      >
        {suspended ? <Undo2 className="size-4" aria-hidden /> : <Ban className="size-4" aria-hidden />}
      </button>
      {hasCard && status !== "new" ? (
        <button
          type="button"
          disabled={pending}
          onClick={reset}
          className="neo-button min-h-9 bg-white px-2 py-1 text-xs"
          aria-label={`Reset ${word} ke kartu baru`}
          title="Reset ke kartu baru"
        >
          <RotateCcw className="size-4" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
