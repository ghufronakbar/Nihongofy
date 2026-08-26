import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { getKanaProgress } from "../actions";
import { getKanaByScript, type KanaScript } from "../data/kana";
import { KanaStudyGrid } from "./kana-study-grid";

export async function KanaPage({ script }: { script: KanaScript }) {
  const cards = getKanaByScript(script);
  const progress = await getKanaProgress();
  const isHiragana = script === "hiragana";

  return (
    <main className="mx-auto w-full max-w-7xl pb-12">
      <div className="relative mb-8 overflow-hidden border-[3px] border-black bg-neo-blue p-6 shadow-neo-lg md:p-9">
        <div className="absolute -top-10 -right-7 size-32 rotate-12 border-[3px] border-black bg-neo-coral shadow-neo" aria-hidden="true" />
        <Link href="/dashboard" className="neo-button relative z-10 mb-8 w-fit bg-white">
          <ArrowLeft className="size-5" aria-hidden="true" /> Dashboard
        </Link>
        <span className="neo-kicker relative z-10">Kana lab / 五十音</span>
        <div className="relative z-10 mt-5 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <h1 className="max-w-4xl text-5xl leading-[0.9] uppercase sm:text-6xl lg:text-8xl">
              {isHiragana ? "Hiragana" : "Katakana"}
            </h1>
            <p className="mt-5 max-w-2xl text-base font-semibold md:text-lg">
              Buka kartu dengan klik, Enter, atau Space. Cari berdasarkan bunyi, dengarkan pelafalan, lalu nilai ingatanmu dalam mode review.
            </p>
          </div>
          <Link href={isHiragana ? "/kana/katakana" : "/kana/hiragana"} className="neo-button bg-neo-yellow">
            {isHiragana ? "Lanjut Katakana" : "Kembali Hiragana"}
            <ArrowRight className="size-5" aria-hidden="true" />
          </Link>
        </div>
      </div>

      <KanaStudyGrid cards={cards} initialProgress={progress} />
    </main>
  );
}
