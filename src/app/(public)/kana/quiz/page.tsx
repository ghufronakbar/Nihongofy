import type { Metadata } from "next";
import { KanaQuiz } from "@/features/kana/quiz/kana-quiz";
import { absoluteUrl, pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Quiz 46 Kana — Hiragana & Katakana",
  description: "Uji penguasaan 46 hiragana atau katakana tanpa login. Empat pilihan romaji, waktu setiap jawaban, dan laporan hasil yang bisa dibagikan ke pengajar.",
  path: "/kana/quiz",
});

export default async function KanaQuizPage({ searchParams }: { searchParams: Promise<{ script?: string | string[] }> }) {
  const { script } = await searchParams;
  return <KanaQuiz initialScript={script === "katakana" ? "katakana" : "hiragana"} quizUrl={absoluteUrl("/kana/quiz")} />;
}
