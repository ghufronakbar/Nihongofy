import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { VocabularyDeckList } from "@/features/vocabulary/components/vocabulary-deck-list";

export const metadata: Metadata = {
  title: "Vocabulary Deck | JLPT Exam",
  description: "Pilih deck kosakata JLPT dan lanjutkan antrean review yang tersimpan.",
};

export default function VocabularyPage() {
  return (
    <main className="mx-auto w-full max-w-7xl pb-12">
      <header className="relative mb-8 overflow-hidden border-[3px] border-black bg-neo-yellow p-6 shadow-neo-lg md:p-9">
        <div className="absolute -right-8 -bottom-12 font-japanese text-[11rem] leading-none font-black opacity-15" aria-hidden="true">語</div>
        <Link href="/dashboard" className="neo-button relative z-10 mb-8 w-fit bg-white"><ArrowLeft className="size-5" /> Dashboard</Link>
        <span className="neo-kicker relative z-10 bg-neo-green">Vocabulary / 語彙</span>
        <h1 className="relative z-10 mt-5 max-w-5xl text-5xl leading-[0.9] uppercase sm:text-6xl lg:text-8xl">Pilih deck. Bangun ingatan.</h1>
        <p className="relative z-10 mt-5 max-w-2xl text-base font-semibold md:text-lg">
          Jelajahi kartu dengan bebas atau kerjakan antrean review. Due dan progres dihitung dari data akunmu, bukan dari state sementara browser.
        </p>
      </header>
      <VocabularyDeckList />
    </main>
  );
}
