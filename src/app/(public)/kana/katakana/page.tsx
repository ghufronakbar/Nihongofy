import type { Metadata } from "next";
import { KanaPage } from "@/features/kana/components/kana-page";

export const metadata: Metadata = {
  title: "Belajar Katakana | JLPT Exam",
  description: "Flashcard katakana interaktif dengan romaji, variasi bunyi, audio, dan review.",
};

export default function KatakanaPage() {
  return <KanaPage script="katakana" />;
}
