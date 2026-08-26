"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, RotateCcw, Search, Volume2 } from "lucide-react";
import { recordKanaProgressAction } from "../actions";
import { KANA_GROUPS, type KanaCard } from "../data/kana";
import { speakJapanese } from "@/features/study/lib/tts";

type ProgressItem = {
  kanaKey: string;
  viewCount: number;
  correctCount: number;
  againCount: number;
};

function KanaFlashcard({
  kana,
  reviewMode,
  progress,
  onProgress,
  onSpeechMessage,
}: {
  kana: KanaCard;
  reviewMode: boolean;
  progress?: ProgressItem;
  onProgress: (kanaKey: string, grade: "VIEWED" | "AGAIN" | "CORRECT") => void;
  onSpeechMessage: (message: string) => void;
}) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [isPending, startTransition] = useTransition();

  function flipCard() {
    const nextFlipped = !isFlipped;
    setIsFlipped(nextFlipped);
    if (!nextFlipped) return;

    const speech = speakJapanese(kana.char);
    onSpeechMessage(speech.ok ? "" : speech.message);
    if (reviewMode) onProgress(kana.key, "VIEWED");
  }

  function grade(grade: "AGAIN" | "CORRECT") {
    onProgress(kana.key, grade);
    setIsFlipped(false);
    startTransition(async () => {
      await recordKanaProgressAction({ kanaKey: kana.key, grade });
    });
  }

  return (
    <article className="min-w-0">
      <button
        type="button"
        aria-pressed={isFlipped}
        aria-label={`${kana.char}, ${isFlipped ? `romaji ${kana.romaji}` : "buka kartu"}`}
        onClick={flipCard}
        className={`kana-flip-card group block h-52 w-full text-left ${isFlipped ? "is-flipped" : ""}`}
      >
        <span className="kana-flip-card-inner">
          <span className="kana-flip-face neo-surface flex flex-col items-center justify-center bg-white p-4">
            <span className="font-japanese text-7xl leading-none font-black">{kana.char}</span>
            <span className="absolute right-4 bottom-4 flex items-center gap-1 font-mono text-[10px] font-bold tracking-widest uppercase">
              <Volume2 className="size-4" aria-hidden="true" /> buka
            </span>
          </span>
          <span className="kana-flip-face kana-flip-back neo-surface flex flex-col items-center justify-center bg-neo-blue p-4 text-black">
            <span className="text-3xl font-black uppercase">{kana.romaji}</span>
            <span className="mt-1 font-mono text-[10px] font-bold tracking-widest uppercase">Grup {kana.group}</span>
            {kana.variations.length > 0 ? (
              <span className="mt-4 flex w-full flex-wrap justify-center gap-2 border-t-2 border-black pt-3">
                {kana.variations.map((variation) => (
                  <span key={variation.romaji} className="border-2 border-black bg-white px-2 py-1 text-center shadow-[2px_2px_0_#111]">
                    <span className="font-japanese block text-2xl font-black">{variation.char}</span>
                    <span className="block text-[10px] font-bold uppercase">{variation.romaji}</span>
                  </span>
                ))}
              </span>
            ) : null}
          </span>
        </span>
      </button>

      {reviewMode && isFlipped ? (
        <div className="mt-3 grid grid-cols-2 gap-2" aria-label={`Nilai ${kana.char}`}>
          <button
            type="button"
            disabled={isPending}
            onClick={() => grade("AGAIN")}
            className="neo-button min-h-10 bg-neo-coral px-3 py-2 text-xs"
          >
            <RotateCcw className="size-4" aria-hidden="true" /> Ulangi
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => grade("CORRECT")}
            className="neo-button min-h-10 bg-neo-green px-3 py-2 text-xs"
          >
            <Check className="size-4" aria-hidden="true" /> Ingat
          </button>
        </div>
      ) : null}

      {reviewMode && progress ? (
        <p className="mt-2 text-center font-mono text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
          {progress.correctCount} ingat / {progress.againCount} ulangi
        </p>
      ) : null}
    </article>
  );
}

export function KanaStudyGrid({
  cards,
  initialProgress,
}: {
  cards: KanaCard[];
  initialProgress: ProgressItem[];
}) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("Semua");
  const [reviewMode, setReviewMode] = useState(false);
  const [speechMessage, setSpeechMessage] = useState("");
  const [progress, setProgress] = useState(() => new Map(initialProgress.map((item) => [item.kanaKey, item])));

  const filteredCards = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return cards.filter((card) => {
      const matchesGroup = group === "Semua" || card.group === group;
      const searchValues = [card.char, card.romaji, ...card.variations.flatMap((item) => [item.char, item.romaji])];
      return matchesGroup && (!normalizedQuery || searchValues.some((value) => value.toLowerCase().includes(normalizedQuery)));
    });
  }, [cards, group, query]);

  function updateProgress(kanaKey: string, grade: "VIEWED" | "AGAIN" | "CORRECT") {
    setProgress((current) => {
      const next = new Map(current);
      const previous = next.get(kanaKey) ?? { kanaKey, viewCount: 0, correctCount: 0, againCount: 0 };
      next.set(kanaKey, {
        ...previous,
        viewCount: previous.viewCount + (grade === "VIEWED" ? 1 : 0),
        correctCount: previous.correctCount + (grade === "CORRECT" ? 1 : 0),
        againCount: previous.againCount + (grade === "AGAIN" ? 1 : 0),
      });
      return next;
    });

    if (grade === "VIEWED") {
      void recordKanaProgressAction({ kanaKey, grade });
    }
  }

  const gradedCount = [...progress.values()].filter((item) => item.correctCount + item.againCount > 0).length;

  return (
    <section>
      <div className="neo-surface mb-8 grid gap-4 bg-white p-4 md:grid-cols-[1fr_auto_auto] md:items-end md:p-5">
        <label className="block">
          <span className="mb-2 block text-sm font-extrabold">Cari kana atau romaji</span>
          <span className="relative block">
            <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Contoh: し atau shi"
              className="neo-input pl-12"
            />
          </span>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-extrabold">Grup bunyi</span>
          <select value={group} onChange={(event) => setGroup(event.target.value)} className="neo-input min-w-44">
            <option>Semua</option>
            {KANA_GROUPS.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>

        <button
          type="button"
          role="switch"
          aria-checked={reviewMode}
          onClick={() => setReviewMode((current) => !current)}
          className={`neo-button ${reviewMode ? "bg-neo-green" : "bg-white"}`}
        >
          {reviewMode ? "Review aktif" : "Mulai review"}
        </button>
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-xs font-bold tracking-widest uppercase">
          {filteredCards.length} kartu terlihat
        </p>
        {reviewMode ? (
          <p className="border-2 border-black bg-neo-yellow px-3 py-1 font-mono text-xs font-bold shadow-neo-sm">
            {gradedCount} / {cards.length} sudah dinilai
          </p>
        ) : null}
      </div>

      {speechMessage ? (
        <p role="status" className="mb-5 border-2 border-black bg-neo-yellow px-4 py-3 text-sm font-bold shadow-neo-sm">
          {speechMessage}
        </p>
      ) : null}

      {filteredCards.length > 0 ? (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {filteredCards.map((kana) => (
            <KanaFlashcard
              key={kana.key}
              kana={kana}
              reviewMode={reviewMode}
              progress={progress.get(kana.key)}
              onProgress={updateProgress}
              onSpeechMessage={setSpeechMessage}
            />
          ))}
        </div>
      ) : (
        <div className="neo-surface bg-white p-10 text-center">
          <p className="font-japanese text-6xl font-black">空</p>
          <h2 className="mt-4 text-2xl">Tidak ada kana yang cocok</h2>
          <p className="mt-2 text-muted-foreground">Ubah pencarian atau pilih grup bunyi lain.</p>
        </div>
      )}
    </section>
  );
}
