"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, Loader2, MessageSquareText, RotateCcw, Undo2 } from "lucide-react";
import { ReportButton } from "@/features/report/components/report-button";
import { resetCardAction, setCardSuspendedAction } from "../actions";
import type { DeckWordStatus } from "../types";

type Props = {
  /** Jumlah catatan pribadi dan entri diskusi kata ini; null bila fiturnya mati. */
  discussion: { notes: number; entries: number } | null;
  deckSlug: string;
  /** Suspend dan reset hanya untuk deck yang sedang ditambahkan. */
  cardActions: boolean;
  vocabId: number;
  word: string;
  status: DeckWordStatus;
  hasCard: boolean;
  /** Status `FEATURES.report` dari halaman; komponen client tidak membaca `@/constants`. */
  reportEnabled: boolean;
};

/**
 * Aksi per kata di daftar kata: suspend/lepas suspend, reset ke kartu baru, dan
 * laporan bila isi kartunya keliru. Suspend dan reset hanya mengenai kartu di
 * deck ini; kartu kata yang sama di deck lain tidak tersentuh.
 */
export function DeckWordActions({
  discussion,
  deckSlug,
  cardActions,
  vocabId,
  word,
  status,
  hasCard,
  reportEnabled,
}: Props) {
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
    run(() => resetCardAction({ deckSlug, vocabId }), "Kartu direset menjadi kartu baru.");
  };

  return (
    <div className="flex shrink-0 items-center gap-1">
      {pending ? <Loader2 className="size-4 animate-spin" aria-label="Menyimpan" /> : null}
      {discussion ? (
        <Link
          href={`/flashcard/discussion/${vocabId}`}
          className="neo-button min-h-9 gap-1 bg-white px-2 py-1 text-xs tabular-nums"
          aria-label={`Catatan dan diskusi ${word}: ${discussion.notes} catatanku, ${discussion.entries} diskusi`}
          title="Catatan dan diskusi"
        >
          <MessageSquareText className="size-4" aria-hidden />
          {discussion.notes + discussion.entries > 0 ? (
            <span>
              {discussion.notes > 0 ? `${discussion.notes}✎` : null}
              {discussion.notes > 0 && discussion.entries > 0 ? " · " : null}
              {discussion.entries > 0 ? discussion.entries : null}
            </span>
          ) : null}
        </Link>
      ) : null}
      {cardActions ? (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(
              () => setCardSuspendedAction({ deckSlug, vocabId, suspended: !suspended }),
              suspended ? "Suspend dilepas." : "Kartu di-suspend.",
            )
          }
          className="neo-button min-h-9 bg-white px-2 py-1 text-xs"
          aria-label={suspended ? `Lepas suspend ${word}` : `Suspend ${word}`}
          title={suspended ? "Lepas suspend" : "Suspend"}
        >
          {suspended ? <Undo2 className="size-4" aria-hidden /> : <Ban className="size-4" aria-hidden />}
        </button>
      ) : null}
      {cardActions && hasCard && status !== "new" ? (
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
      {reportEnabled ? (
        <ReportButton
          target={{ targetType: "FLASHCARD_VOCAB", vocabId }}
          variant="neo-icon"
          label={`Laporkan kartu ${word}`}
          subject={
            <span lang="ja" className="font-japanese">
              {word}
            </span>
          }
          className="min-h-9 px-2 py-1 text-xs"
        />
      ) : null}
    </div>
  );
}
