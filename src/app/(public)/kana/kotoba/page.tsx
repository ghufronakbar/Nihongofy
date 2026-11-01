import type { Metadata } from "next";
import { KOTOBA_BABS } from "@/features/kana/kotoba/data";
import { KotobaQuiz } from "@/features/kana/kotoba/kotoba-quiz";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Tebak Kotoba Minna no Nihongo — Bab 1–25",
  description: "Latihan kosakata Minna no Nihongo I per bab tanpa login. Tampilkan kana atau kanji di depan kartu, tebak artinya, lalu lihat tulisan lengkap di belakang.",
  path: "/kana/kotoba",
});

type SearchParams = { bab?: string | string[]; cakupan?: string | string[] };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** `?bab=13&cakupan=inti` membuka form dengan Bab 13 dan pilihan kata inti. */
export default async function KotobaQuizPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { bab, cakupan } = await searchParams;
  const initialBab = Number(first(bab));
  return <KotobaQuiz initialBabs={[KOTOBA_BABS.includes(initialBab) ? initialBab : KOTOBA_BABS[0]]} initialScope={first(cakupan) === "inti" ? "inti" : "semua"} />;
}
