"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, EyeOff, MoveRight, RotateCcw, Trash2 } from "lucide-react";
import type { BrowseCard } from "../browse-data";
import {
  bulkBuryAction,
  bulkDeleteNotesAction,
  bulkForgetAction,
  bulkMoveDeckAction,
  bulkSuspendAction,
  repositionAction,
} from "../browse-actions";

type Props = {
  cards: BrowseCard[];
  decks: { id: number; name: string }[];
};

const QUEUE_LABELS: Record<string, { label: string; tone: string }> = {
  NEW: { label: "Baru", tone: "bg-neo-blue" },
  LEARNING: { label: "Belajar", tone: "bg-neo-coral" },
  DAY_LEARN: { label: "Belajar (hari)", tone: "bg-neo-coral" },
  REVIEW: { label: "Ulang", tone: "bg-neo-green" },
  SUSPENDED: { label: "Suspend", tone: "bg-neutral-300" },
  BURIED_USER: { label: "Ditunda", tone: "bg-neutral-300" },
  BURIED_SIBLING: { label: "Ditunda (sibling)", tone: "bg-neutral-300" },
};

export function CardBrowser({ cards, decks }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const ids = [...selected];
  const allSelected = cards.length > 0 && selected.size === cards.length;

  function toggle(cardId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(cards.map((card) => card.cardId)));
  }

  function run(
    label: string,
    action: () => Promise<{ ok: true } | { ok: false; message: string }>,
  ) {
    if (ids.length === 0) return;
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(label);
      setSelected(new Set());
      router.refresh();
    });
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-black tabular-nums">{selected.size} dipilih</span>

        <button
          type="button"
          disabled={isPending || ids.length === 0}
          onClick={() => run("Kartu di-suspend.", () => bulkSuspendAction({ cardIds: ids, suspend: true }))}
          className="neo-button bg-white px-3 py-2 text-xs"
        >
          <Ban className="size-4" aria-hidden /> Suspend
        </button>
        <button
          type="button"
          disabled={isPending || ids.length === 0}
          onClick={() => run("Suspend dilepas.", () => bulkSuspendAction({ cardIds: ids, suspend: false }))}
          className="neo-button bg-white px-3 py-2 text-xs"
        >
          Lepas suspend
        </button>
        <button
          type="button"
          disabled={isPending || ids.length === 0}
          onClick={() => run("Kartu ditunda.", () => bulkBuryAction({ cardIds: ids }))}
          className="neo-button bg-white px-3 py-2 text-xs"
        >
          <EyeOff className="size-4" aria-hidden /> Tunda
        </button>
        <button
          type="button"
          disabled={isPending || ids.length === 0}
          onClick={() => {
            if (!window.confirm(`Reset ${ids.length} kartu jadi baru? Jadwal dan memory state FSRS-nya hilang.`)) return;
            run("Kartu direset jadi baru.", () => bulkForgetAction({ cardIds: ids }));
          }}
          className="neo-button bg-white px-3 py-2 text-xs"
        >
          <RotateCcw className="size-4" aria-hidden /> Reset
        </button>

        <select
          disabled={isPending || ids.length === 0}
          value=""
          onChange={(event) => {
            const deckId = Number(event.target.value);
            if (!deckId) return;
            run("Kartu dipindah.", () => bulkMoveDeckAction({ cardIds: ids, deckId }));
          }}
          className="h-9 rounded-lg border-[3px] border-neo-ink bg-white px-2 text-xs font-bold text-black shadow-neo-sm"
        >
          <option value="">Pindah ke deck…</option>
          {decks.map((deck) => (
            <option key={deck.id} value={deck.id}>
              {deck.name}
            </option>
          ))}
        </select>

        <button
          type="button"
          disabled={isPending || ids.length === 0}
          onClick={() => {
            const start = window.prompt("Posisi awal untuk kartu baru terpilih:", "0");
            if (start === null) return;
            run("Posisi diperbarui.", () =>
              repositionAction({ cardIds: ids, startPosition: Number(start) || 0 }),
            );
          }}
          className="neo-button bg-white px-3 py-2 text-xs"
        >
          <MoveRight className="size-4" aria-hidden /> Reposisi
        </button>

        <button
          type="button"
          disabled={isPending || ids.length === 0}
          onClick={() => {
            if (!window.confirm(`Hapus note dari ${ids.length} kartu terpilih? Kartu bersaudaranya ikut terhapus.`)) return;
            run("Note dihapus.", () => bulkDeleteNotesAction({ cardIds: ids }));
          }}
          className="neo-button bg-neo-coral px-3 py-2 text-xs"
        >
          <Trash2 className="size-4" aria-hidden /> Hapus note
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-max text-sm">
          <thead>
            <tr className="border-b-[3px] border-neo-ink text-left">
              <th className="px-2 py-2">
                <input
                  type="checkbox"
                  className="size-4 accent-black"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Pilih semua"
                />
              </th>
              <th className="px-2 py-2 font-black">Kartu</th>
              <th className="px-2 py-2 font-black">Jawaban</th>
              <th className="px-2 py-2 font-black">Deck</th>
              <th className="px-2 py-2 font-black">Status</th>
              <th className="px-2 py-2 text-right font-black">Interval</th>
              <th className="px-2 py-2 text-right font-black">Lapse</th>
              <th className="px-2 py-2 font-black">Due</th>
            </tr>
          </thead>
          <tbody>
            {cards.map((card) => {
              const queue = QUEUE_LABELS[card.queue] ?? { label: card.queue, tone: "bg-white" };
              return (
                <tr key={card.cardId} className="border-b border-dashed border-neo-ink/40">
                  <td className="px-2 py-2">
                    <input
                      type="checkbox"
                      className="size-4 accent-black"
                      checked={selected.has(card.cardId)}
                      onChange={() => toggle(card.cardId)}
                      aria-label={`Pilih ${card.sortField}`}
                    />
                  </td>
                  <td className="max-w-56 px-2 py-2">
                    <span className="block truncate font-bold">{card.sortField}</span>
                    <span className="block truncate text-xs font-semibold text-muted-foreground">
                      {card.templateName}
                    </span>
                  </td>
                  <td className="max-w-56 truncate px-2 py-2 font-semibold">
                    {card.answerPreview || "—"}
                  </td>
                  <td className="max-w-40 truncate px-2 py-2 font-semibold">{card.deckName}</td>
                  <td className="px-2 py-2">
                    <span
                      className={`inline-block rounded border-2 border-neo-ink px-1.5 text-xs font-black text-black ${queue.tone}`}
                    >
                      {queue.label}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-right font-bold tabular-nums">
                    {card.queue === "NEW" ? `#${card.position}` : `${card.intervalDays}h`}
                  </td>
                  <td className="px-2 py-2 text-right font-bold tabular-nums">{card.lapses}</td>
                  <td className="px-2 py-2 font-semibold tabular-nums">
                    {card.queue === "NEW"
                      ? "—"
                      : card.due.toISOString().slice(0, 10)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {cards.length === 0 ? (
        <p className="neo-surface p-6 text-center font-bold text-muted-foreground">
          Tidak ada kartu yang cocok dengan filter ini.
        </p>
      ) : null}
    </div>
  );
}
