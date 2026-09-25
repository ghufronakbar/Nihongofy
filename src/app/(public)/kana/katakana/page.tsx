import type { Metadata } from "next";
import { KanaPage } from "@/features/kana/components/kana-page";

export const metadata: Metadata = {
  title: "Belajar Katakana",
  description: "Flashcard katakana interaktif dengan romaji, variasi bunyi, audio, dan review di Nihongofy.",
};

export default function KatakanaPage() {
  return <KanaPage script="katakana" />;
}
