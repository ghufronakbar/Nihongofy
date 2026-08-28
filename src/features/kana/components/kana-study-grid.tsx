"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, RotateCcw, Search, Volume2 } from "lucide-react";
import { recordKanaProgressAction } from "../actions";
import {
  KANA_GROUPS,
  KANA_ROW_DEFINITIONS,
  KANA_VOWELS,
  type KanaCard,
} from "../data/kana";
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
        className={`kana-flip-card group block h-36 sm:h-48 md:h-52 w-full text-left cursor-pointer ${isFlipped ? "is-flipped" : ""}`}
      >
        <span className="kana-flip-card-inner">
          <span className="kana-flip-face neo-surface flex flex-col items-center justify-center bg-white p-2 sm:p-4 hover:border-neo-blue transition-colors">
            <span className="font-japanese text-4xl sm:text-6xl md:text-7xl leading-none font-black select-none">
              {kana.char}
            </span>
            <span className="absolute right-2 bottom-2 sm:right-3 sm:bottom-3 flex items-center gap-1 font-mono text-[9px] sm:text-[10px] font-bold tracking-wider uppercase text-foreground/60">
              <Volume2 className="size-3.5 sm:size-4" aria-hidden="true" />
              <span className="hidden sm:inline">buka</span>
            </span>
          </span>
          <span className="kana-flip-face kana-flip-back neo-surface flex flex-col items-center justify-center bg-neo-blue p-2 sm:p-4 text-black">
            <span className="text-2xl sm:text-3xl md:text-4xl font-black uppercase">{kana.romaji}</span>
            <span className="mt-0.5 sm:mt-1 font-mono text-[9px] sm:text-[10px] font-bold tracking-wider uppercase text-black/70">
              Grup {kana.group}
            </span>
            {kana.variations.length > 0 ? (
              <span className="mt-2 sm:mt-3 flex w-full flex-wrap justify-center gap-1 sm:gap-1.5 border-t-2 border-black/30 pt-1.5 sm:pt-2">
                {kana.variations.map((variation) => (
                  <span
                    key={variation.romaji}
                    className="border border-black bg-white px-1 sm:px-1.5 py-0.5 text-center shadow-[1.5px_1.5px_0_#111]"
                  >
                    <span className="font-japanese block text-base sm:text-xl font-black">{variation.char}</span>
                    <span className="block text-[7px] sm:text-[9px] font-bold uppercase">{variation.romaji}</span>
                  </span>
                ))}
              </span>
            ) : null}
          </span>
        </span>
      </button>

      {reviewMode && isFlipped ? (
        <div className="mt-2 sm:mt-3 grid grid-cols-2 gap-1.5 sm:gap-2" aria-label={`Nilai ${kana.char}`}>
          <button
            type="button"
            disabled={isPending}
            onClick={() => grade("AGAIN")}
            className="neo-button min-h-8 sm:min-h-10 bg-neo-coral px-2 sm:px-3 py-1 sm:py-2 text-[10px] sm:text-xs"
          >
            <RotateCcw className="size-3.5 sm:size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Ulangi</span>
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => grade("CORRECT")}
            className="neo-button min-h-8 sm:min-h-10 bg-neo-green px-2 sm:px-3 py-1 sm:py-2 text-[10px] sm:text-xs"
          >
            <Check className="size-3.5 sm:size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Ingat</span>
          </button>
        </div>
      ) : null}

      {reviewMode && progress ? (
        <p className="mt-1.5 sm:mt-2 text-center font-mono text-[9px] sm:text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
          {progress.correctCount} ✓ / {progress.againCount} ✗
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

  const cardsByPosition = useMemo(() => {
    const map = new Map<string, KanaCard>();
    for (const card of cards) {
      map.set(`${card.group}-${card.columnIndex}`, card);
    }
    return map;
  }, [cards]);

  const filteredCards = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return cards.filter((card) => {
      const matchesGroup = group === "Semua" || card.group === group;
      const searchValues = [card.char, card.romaji, ...card.variations.flatMap((item) => [item.char, item.romaji])];
      return matchesGroup && (!normalizedQuery || searchValues.some((value) => value.toLowerCase().includes(normalizedQuery)));
    });
  }, [cards, group, query]);

  const visibleRows = useMemo(() => {
    if (group === "Semua") return KANA_ROW_DEFINITIONS;
    return KANA_ROW_DEFINITIONS.filter((row) => row.group === group);
  }, [group]);

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
  const isSearchActive = query.trim().length > 0;

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

      {isSearchActive ? (
        filteredCards.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
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
            <h2 className="mt-4 text-2xl font-black">Tidak ada kana yang cocok</h2>
            <p className="mt-2 text-muted-foreground">Ubah pencarian atau pilih grup bunyi lain.</p>
          </div>
        )
      ) : (
        <div className="space-y-6">
          {/* Gojuon 5-column vowel header */}
          <div className="grid grid-cols-5 gap-2.5 sm:gap-4 md:gap-5 text-center select-none" aria-hidden="true">
            {KANA_VOWELS.map((vowel) => (
              <div
                key={vowel}
                className="border-2 border-neo-ink bg-neo-yellow py-1.5 font-mono text-xs sm:text-sm font-black shadow-neo-sm uppercase"
              >
                Kolom {vowel.toUpperCase()}
              </div>
            ))}
          </div>

          {/* Gojuon Rows */}
          <div className="space-y-5 sm:space-y-6">
            {visibleRows.map((row) => (
              <div key={row.group} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="border-2 border-neo-ink bg-white px-2.5 py-0.5 font-mono text-[11px] sm:text-xs font-black uppercase shadow-neo-sm">
                    Baris {row.group}
                  </span>
                  <div className="h-0.5 flex-1 bg-neo-ink/15" aria-hidden="true" />
                </div>

                <div className="grid grid-cols-5 gap-2.5 sm:gap-4 md:gap-5">
                  {row.slots.map((romaji, colIdx) => {
                    if (!romaji) {
                      return (
                        <div
                          key={`empty-${row.group}-${colIdx}`}
                          className="h-36 sm:h-48 md:h-52 rounded-lg border-2 border-dashed border-neo-ink/15 bg-neo-paper/25 flex items-center justify-center select-none"
                          aria-hidden="true"
                        >
                          <span className="font-mono text-xs font-bold text-foreground/20">—</span>
                        </div>
                      );
                    }

                    const card = cardsByPosition.get(`${row.group}-${colIdx}`);
                    if (!card) return null;

                    return (
                      <KanaFlashcard
                        key={card.key}
                        kana={card}
                        reviewMode={reviewMode}
                        progress={progress.get(card.key)}
                        onProgress={updateProgress}
                        onSpeechMessage={setSpeechMessage}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
