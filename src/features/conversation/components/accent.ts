import type { ConversationAccent } from "../types";

// Aksen persona dipetakan ke token neo yang sudah ada di globals.css, bukan
// warna hex baru — supaya modul ini tidak memperkenalkan palet sendiri.
export const ACCENT_CLASSES: Record<ConversationAccent, string> = {
  blue: "bg-neo-blue text-neo-ink",
  coral: "bg-neo-coral text-white",
  yellow: "bg-neo-yellow text-neo-ink",
  green: "bg-neo-green text-neo-ink",
};
