import type { Metadata } from "next";
import { KOTOBA_BABS } from "@/features/kana/kotoba/data";
import { KotobaQuiz } from "@/features/kana/kotoba/kotoba-quiz";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Tebak Kotoba Minna no Nihongo — Bab 1–15",
  description: "Latihan kosakata Minna no Nihongo I per bab tanpa login. Tampilkan kana atau kanji di depan kartu, tebak artinya, lalu lihat tulisan lengkap di belakang.",
  path: "/kana/kotoba",
});

export default async function KotobaQuizPage({ searchParams }: { searchParams: Promise<{ bab?: string | string[] }> }) {
  const { bab } = await searchParams;
  const initialBab = Number(Array.isArray(bab) ? bab[0] : bab);
  return <KotobaQuiz initialBabs={[KOTOBA_BABS.includes(initialBab) ? initialBab : KOTOBA_BABS[0]]} />;
}
