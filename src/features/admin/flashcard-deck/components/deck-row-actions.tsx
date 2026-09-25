"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Download, Eye, EyeOff } from "lucide-react";
import { exportSystemDeckAction, setSystemDeckPublishedAction } from "../actions";

export function DeckRowActions({
  id,
  slug,
  isPublished,
}: {
  id: number;
  slug: string;
  isPublished: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-2">
        <button
          type="button"
          disabled={isPending}
          aria-pressed={isPublished}
          onClick={() =>
            startTransition(async () => {
              const result = await setSystemDeckPublishedAction({ id, isPublished: !isPublished });
              if (result.ok) router.refresh();
              else setError(result.message);
            })
          }
          className={`neo-button text-[11px] font-extrabold ${
            isPublished ? "bg-neo-paper text-black" : "bg-white text-black"
          }`}
        >
          {isPublished ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
          {isPublished ? "Tampil" : "Tersembunyi"}
        </button>

        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              const result = await exportSystemDeckAction({ id });
              if (!result.ok) {
                setError(result.message);
                return;
              }
              // Diunduh sebagai file supaya dapat langsung ditimpakan ke
              // src/flashcard-deck-data/, yang tetap menjadi sumber kebenaran seed.
              const url = URL.createObjectURL(
                new Blob([result.json], { type: "application/json" }),
              );
              const link = document.createElement("a");
              link.href = url;
              link.download = result.fileName;
              link.click();
              URL.revokeObjectURL(url);
            })
          }
          className="neo-button bg-white text-[11px] font-extrabold text-black"
          title={`Unduh ${slug}.json untuk ditimpakan ke src/flashcard-deck-data/`}
        >
          <Download className="size-3.5" />
          Fixture
        </button>
      </div>
      {error && <p className="text-[11px] font-bold text-neo-coral">{error}</p>}
    </div>
  );
}
