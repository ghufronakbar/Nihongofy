import { cn } from "@/lib/utils";
import type { MouthShape } from "../lib/mora-lipsync";
import type { CharacterState, ConversationPersona } from "../types";
import { ACCENT_CLASSES } from "./accent";
import { PersonaCharacter } from "./persona-character";

const STATE_ANIMATION: Record<CharacterState, string> = {
  idle: "motion-safe:animate-[persona-idle_3.2s_ease-in-out_infinite]",
  // Mode aset punya lip-sync sendiri, jadi badannya tidak ikut memantul —
  // gerak mulut yang membawa kesan bicara.
  talking: "motion-safe:animate-[persona-talking_0.55s_ease-in-out_infinite]",
  listening: "motion-safe:animate-[persona-listening_1.6s_ease-in-out_infinite]",
  happy: "motion-safe:animate-[persona-happy_0.9s_ease-in-out_infinite]",
  thinking: "motion-safe:animate-[persona-idle_3.2s_ease-in-out_infinite]",
  tsun: "motion-safe:animate-[persona-idle_3.2s_ease-in-out_infinite]",
};

const SIZE_CLASSES = {
  sm: "size-12 rounded-lg",
  md: "size-20 rounded-lg",
  lg: "size-40 rounded-2xl sm:size-56",
  xl: "size-56 rounded-2xl sm:size-72",
} as const;

export function PersonaAvatar({
  persona,
  state = "idle",
  mouth,
  size = "md",
  className,
}: {
  persona: ConversationPersona;
  state?: CharacterState;
  mouth?: MouthShape;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}) {
  // Ukuran kecil memotong ke kepala; ukuran besar menampilkan setengah badan.
  const crop = size === "sm" || size === "md" ? "head" : "bust";

  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden border-[3px] border-neo-ink shadow-neo-sm",
        SIZE_CLASSES[size],
        persona.art ? "bg-white" : ACCENT_CLASSES[persona.accent],
        STATE_ANIMATION[state],
        className,
      )}
    >
      <PersonaCharacter persona={persona} state={state} mouth={mouth} crop={crop} />
    </span>
  );
}
