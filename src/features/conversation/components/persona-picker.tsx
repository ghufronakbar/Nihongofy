"use client";

import { Check, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PERSONALITY_BADGE_CLASSES,
  PERSONALITY_LABELS,
  VOICE_TYPE_LABELS,
} from "../data/personas";
import type { ConversationPersona } from "../types";
import { PersonaAvatar } from "./persona-avatar";

export type GenderFilter = "all" | "female" | "male";

export const GENDER_FILTER_LABELS: Record<GenderFilter, string> = {
  all: "Semua",
  female: "Perempuan",
  male: "Laki-laki",
};

export function GenderFilterBar({
  value,
  onChange,
}: {
  value: GenderFilter;
  onChange: (next: GenderFilter) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-bold text-foreground/65">Filter:</span>
      {(["all", "female", "male"] as const).map((gender) => (
        <button
          key={gender}
          type="button"
          onClick={() => onChange(gender)}
          aria-pressed={value === gender}
          className={cn(
            "min-h-11 rounded-lg border-[3px] border-neo-ink px-4 text-sm font-bold shadow-neo-sm transition-transform",
            value === gender ? "bg-neo-blue text-neo-ink" : "bg-white hover:-translate-y-0.5",
          )}
        >
          {GENDER_FILTER_LABELS[gender]}
        </button>
      ))}
    </div>
  );
}

export function PersonaCard({
  persona,
  selected,
  onSelect,
  onPlaySample,
}: {
  persona: ConversationPersona;
  selected: boolean;
  onSelect: () => void;
  onPlaySample?: () => void;
}) {
  return (
    <div
      className={cn(
        "neo-surface relative p-5 transition-transform",
        selected ? "-translate-y-1 ring-4 ring-neo-blue" : "hover:-translate-y-0.5",
      )}
    >
      {selected && (
        <span className="absolute top-3 right-3 grid size-7 place-items-center rounded-full border-2 border-neo-ink bg-neo-green">
          <Check className="size-4" aria-hidden="true" />
        </span>
      )}

      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className="w-full text-left"
      >
        <div className="flex items-start gap-3">
          <PersonaAvatar persona={persona} size="md" state={selected ? "happy" : "idle"} />
          <div className="min-w-0 pr-6">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="font-black">{persona.name}</span>
              <span lang="ja" className="font-japanese text-sm font-bold text-foreground/60">
                {persona.nameJapanese}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "border-2 border-neo-ink px-2 py-0.5 text-xs font-black",
                  PERSONALITY_BADGE_CLASSES[persona.personality] ?? "bg-white",
                )}
              >
                {PERSONALITY_LABELS[persona.personality] ?? persona.personality}
              </span>
              <span className="flex items-center gap-1 text-xs font-bold text-foreground/60">
                <Volume2 className="size-3" aria-hidden="true" />
                {VOICE_TYPE_LABELS[persona.voiceType] ?? persona.voiceType}
              </span>
            </div>
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 font-semibold text-foreground/70">
          {persona.description}
        </p>

        <ul className="mt-3 flex flex-wrap gap-2">
          {persona.tags.map((tag) => (
            <li
              key={tag}
              className="border border-neo-ink/25 bg-background px-2 py-0.5 text-xs font-bold text-foreground/70"
            >
              {tag}
            </li>
          ))}
        </ul>
      </button>

      {onPlaySample && (
        <button
          type="button"
          onClick={onPlaySample}
          className="mt-4 flex min-h-10 items-center gap-2 rounded-md border-2 border-neo-ink bg-background px-3 text-xs font-bold"
        >
          <Volume2 className="size-4" aria-hidden="true" />
          Dengar contoh suara
        </button>
      )}
    </div>
  );
}
