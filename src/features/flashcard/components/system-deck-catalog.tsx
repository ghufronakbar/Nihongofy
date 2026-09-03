"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Loader2, Plus } from "lucide-react";
import { addSystemDeckAction } from "../system-deck-actions";

export type CatalogDeck = {
  slug: string;
  name: string;
  description: string;
  jlptLevel: string | null;
  noteTypeLabel: string;
  license: string;
  noteCount: number;
  /** Sudah pernah ditambahkan ke koleksi user. */
  alreadyAdded: boolean;
};

export function SystemDeckCatalog({ decks }: { decks: CatalogDeck[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());

  const add = (slug: string) => {
    setBusySlug(slug);
    startTransition(async () => {
      const result = await addSystemDeckAction({ slug });
      setBusySlug(null);

      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setAdded((current) => new Set(current).add(slug));
      toast.success(
        `Deck ditambahkan: ${result.data.noteCount} note, ${result.data.cardCount} kartu.`,
      );
      router.refresh();
    });
  };

  if (decks.length === 0) {
    return (
      <p className="neo-surface p-6 font-bold text-muted-foreground">
        Belum ada deck bawaan di katalog.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {decks.map((deck) => {
        const isAdded = deck.alreadyAdded || added.has(deck.slug);
        const isBusy = pending && busySlug === deck.slug;

        return (
          <li key={deck.slug} className="neo-surface p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-black">{deck.name}</h2>
                  {deck.jlptLevel ? (
                    <span className="rounded border-2 border-neo-ink bg-neo-yellow px-1.5 text-xs font-black text-black">
                      {deck.jlptLevel}
                    </span>
                  ) : null}
                  <span className="text-xs font-bold text-muted-foreground">
                    {deck.noteTypeLabel}
                  </span>
                </div>
                <p className="mt-1 text-sm font-semibold text-muted-foreground">
                  {deck.description}
                </p>
                <p className="mt-2 text-xs font-bold tabular-nums text-muted-foreground">
                  {deck.noteCount} note
                </p>
              </div>

              <button
                type="button"
                onClick={() => add(deck.slug)}
                disabled={isAdded || isBusy}
                className={`neo-button shrink-0 ${isAdded ? "bg-neo-green" : "bg-neo-yellow"}`}
              >
                {isBusy ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : isAdded ? (
                  <Check className="size-4" aria-hidden />
                ) : (
                  <Plus className="size-4" aria-hidden />
                )}
                {isAdded ? "Sudah ditambahkan" : "Tambahkan"}
              </button>
            </div>

            {/* Atribusi lisensi wajib tampil, bukan hanya tersimpan di database. */}
            <p className="mt-3 border-t-2 border-dashed border-neo-ink pt-2 text-xs font-semibold text-muted-foreground">
              {deck.license}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
