import type { Metadata } from "next";
import { KanaPage } from "@/features/kana/components/kana-page";

export const metadata: Metadata = {
  title: "Belajar Hiragana | JLPT Exam",
  description: "Flashcard hiragana interaktif dengan romaji, variasi bunyi, audio, dan review.",
};

export default function HiraganaPage() {
  return <KanaPage script="hiragana" />;
}
