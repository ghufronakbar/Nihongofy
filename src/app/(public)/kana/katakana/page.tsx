import type { Metadata } from "next";
import { KanaPage } from "@/features/kana/components/kana-page";

export const metadata: Metadata = {
  title: "Belajar Katakana",
  description: "Flashcard katakana interaktif dengan romaji, variasi bunyi, audio, dan review di Tanoshii Japanese.",
};

export default function KatakanaPage() {
  return <KanaPage script="katakana" />;
}
