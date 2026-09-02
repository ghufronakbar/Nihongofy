import type { Metadata } from "next";
import { KanaPage } from "@/features/kana/components/kana-page";

export const metadata: Metadata = {
  title: "Belajar Hiragana",
  description: "Flashcard hiragana interaktif dengan romaji, variasi bunyi, audio, dan review di Tanoshii Japanese.",
};

export default function HiraganaPage() {
  return <KanaPage script="hiragana" />;
}
