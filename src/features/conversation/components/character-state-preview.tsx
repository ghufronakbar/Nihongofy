"use client";

import { useState } from "react";
import { Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { CHARACTER_STATES, type CharacterState, type ConversationPersona } from "../types";
import { PersonaAvatar } from "./persona-avatar";

const STATE_LABELS: Record<CharacterState, string> = {
  idle: "Diam",
  talking: "Bicara",
  listening: "Mendengar",
  happy: "Senang",
  thinking: "Berpikir",
  tsun: "Tsun",
};

// Pratinjau karakter supaya user dapat melihat-lihat persona sebelum memilih.
// Pemilih state hanya ditampilkan pada mode suara, tempat keempat state itu
// benar-benar dipakai runner.
export function CharacterStatePreview({
  persona,
  onPlaySample,
  showStates = true,
  speaking = false,
}: {
  persona: ConversationPersona;
  onPlaySample: () => void;
  showStates?: boolean;
  speaking?: boolean;
}) {
  const [previewState, setPreviewState] = useState<CharacterState>("idle");
  const state: CharacterState = speaking ? "talking" : previewState;

  return (
    <div className="rounded-lg border-[3px] border-neo-ink bg-background p-4">
      <div className="grid place-items-center gap-3">
        <PersonaAvatar persona={persona} state={state} mouth={state === "talking" ? "a" : "closed"} size="lg" />
        <div className="text-center">
          <p className="font-black">{persona.name}</p>
          <p lang="ja" className="font-japanese text-sm font-bold text-foreground/60">
            {persona.nameJapanese}
          </p>
        </div>
        {showStates && (
          <p className="text-xs font-black tracking-wider uppercase">{STATE_LABELS[state]}</p>
        )}
      </div>

      {showStates && (
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {CHARACTER_STATES.filter(
          (candidate) => candidate !== "tsun" || persona.personality === "tsundere",
        ).map((candidate) => (
            <button
              key={candidate}
              type="button"
              onClick={() => setPreviewState(candidate)}
              aria-pressed={previewState === candidate}
              className={cn(
                "min-h-9 rounded-md border-2 border-neo-ink px-3 text-xs font-bold",
                previewState === candidate ? "bg-neo-ink text-white" : "bg-white text-neo-ink",
              )}
            >
              {STATE_LABELS[candidate]}
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={onPlaySample}
        className="mt-4 flex min-h-10 w-full items-center justify-center gap-2 rounded-md border-2 border-neo-ink bg-white px-3 text-xs font-bold"
      >
        <Volume2 className="size-4" aria-hidden="true" />
        Dengar contoh suara
      </button>
    </div>
  );
}
