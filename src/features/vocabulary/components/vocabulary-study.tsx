"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  RotateCcw,
  Sparkles,
  Volume2,
  Zap,
} from "lucide-react";
import { rateFlashcardAction } from "../actions";
import type { FlashcardRatingInput, UsageExample } from "../schemas";
import { speakJapanese } from "@/features/study/lib/tts";

export type VocabularyStudyCard = {
  id: number;
  order: number;
  word: string;
  reading: string;
  romaji: string;
  meaning: string;
  jlptLevel: string;
  audioText: string;
  audioUrl: string | null;
  usageExamples: UsageExample[];
  tags: { slug: string; label: string }[];
  isNew: boolean;
  isDue: boolean;
  dueAt: string | null;
  intervalDays: number;
  repetitions: number;
};

type Deck = {
  slug: string;
  title: string;
  description: string;
  jlptLevel: string;
  cards: VocabularyStudyCard[];
  reviewCardIds: number[];
  dueCount: number;
  newCount: number;
  dailyQueue: {
    remainingReviews: number;
    remainingNew: number;
    completedReviewsToday: number;
    completedNewToday: number;
    limitReached: boolean;
  };
};

const RATING_OPTIONS: {
  rating: FlashcardRatingInput;
  label: string;
  hint: string;
  className: string;
  icon: typeof RotateCcw;
}[] = [
  { rating: "AGAIN", label: "Again", hint: "ulang cepat", className: "bg-neo-coral", icon: RotateCcw },
  { rating: "HARD", label: "Hard", hint: "lebih dekat", className: "bg-neo-yellow", icon: Clock3 },
  { rating: "GOOD", label: "Good", hint: "normal", className: "bg-neo-blue", icon: Check },
  { rating: "EASY", label: "Easy", hint: "lebih jauh", className: "bg-neo-green", icon: Zap },
];

export function VocabularyStudy({ deck, mode }: { deck: Deck; mode: "browse" | "review" }) {
  const reviewCards = useMemo(() => {
    const cardsById = new Map(deck.cards.map((card) => [card.id, card]));
    return deck.reviewCardIds.flatMap((id) => {
      const card = cardsById.get(id);
      return card ? [card] : [];
    });
  }, [deck.cards, deck.reviewCardIds]);
  const activeCards = mode === "review" ? reviewCards : deck.cards;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [speechMessage, setSpeechMessage] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [completedReviews, setCompletedReviews] = useState(0);
  const [isPending, startTransition] = useTransition();
  const currentCard = activeCards[currentIndex];

  function playAudio(event?: React.MouseEvent) {
    event?.stopPropagation();
    if (!currentCard) return;

    if (currentCard.audioUrl) {
      const audio = new Audio(currentCard.audioUrl);
      void audio.play().catch(() => {
        const speech = speakJapanese(currentCard.audioText);
        setSpeechMessage(speech.ok ? "Audio file gagal, jadi browser memakai suara sintetis." : speech.message);
      });
      return;
    }

    const speech = speakJapanese(currentCard.audioText);
    setSpeechMessage(speech.ok ? "" : speech.message);
  }

  function move(direction: -1 | 1) {
    setCurrentIndex((current) => Math.min(Math.max(current + direction, 0), activeCards.length - 1));
    setIsFlipped(false);
    setActionMessage("");
  }

  function rate(rating: FlashcardRatingInput) {
    if (!currentCard) return;
    setActionMessage("");

    startTransition(async () => {
      const result = await rateFlashcardAction({
        flashcardId: currentCard.id,
        deckSlug: deck.slug,
        rating,
      });
      if (!result.ok) {
        setActionMessage(result.message);
        return;
      }

      setCompletedReviews((count) => count + 1);
      setIsFlipped(false);
      setCurrentIndex((index) => index + 1);
    });
  }

  if (deck.cards.length === 0) {
    return (
      <div className="neo-surface bg-white p-10 text-center">
        <p className="font-japanese text-6xl font-black">空</p>
        <h2 className="mt-4 text-3xl">Deck ini masih kosong</h2>
        <p className="mt-3 text-muted-foreground">Kembali ke daftar deck untuk memilih materi lain.</p>
        <Link href="/vocab" className="neo-button mt-6 bg-neo-yellow"><ArrowLeft className="size-5" /> Daftar deck</Link>
      </div>
    );
  }

  if (mode === "review" && (!currentCard || reviewCards.length === 0)) {
    return (
      <div className="neo-surface overflow-hidden bg-white">
        <div className="border-b-[3px] border-black bg-neo-green p-6 text-center">
          <Sparkles className="mx-auto size-14" aria-hidden="true" />
          <h2 className="mt-3 text-4xl uppercase">Antrean selesai</h2>
        </div>
        <div className="p-8 text-center">
          <p className="mx-auto max-w-xl text-muted-foreground">
            {completedReviews > 0
              ? `${completedReviews} kartu sudah dijadwalkan ulang dan tersimpan pada akunmu.`
              : deck.dailyQueue.limitReached
                ? "Batas belajar hari ini sudah tercapai. Kamu tetap bisa menjelajahi deck atau mengubah batas harian."
              : "Tidak ada kartu baru atau jatuh tempo saat ini. Kembali lagi sesuai jadwal berikutnya."}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href={`/vocab/${deck.slug}?mode=browse`} className="neo-button bg-white">Jelajahi deck</Link>
            {deck.dailyQueue.limitReached ? (
              <Link href="/profile/flashcard-settings" className="neo-button bg-neo-blue">Atur batas harian</Link>
            ) : null}
            <Link href="/vocab" className="neo-button bg-neo-yellow">Pilih deck lain</Link>
          </div>
        </div>
      </div>
    );
  }

  if (!currentCard) return null;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-xs font-black tracking-widest uppercase">
          {mode === "review" ? `Review ${currentIndex + 1} / ${reviewCards.length}` : `Kartu ${currentIndex + 1} / ${activeCards.length}`}
        </p>
        <div className="flex flex-wrap gap-2">
          {currentCard.isNew ? <span className="border-2 border-black bg-neo-green px-3 py-1 text-xs font-black shadow-neo-sm">BARU</span> : null}
          {currentCard.isDue ? <span className="border-2 border-black bg-neo-yellow px-3 py-1 text-xs font-black shadow-neo-sm">DUE</span> : null}
          <span className="border-2 border-black bg-white px-3 py-1 text-xs font-black shadow-neo-sm">{currentCard.jlptLevel}</span>
        </div>
      </div>

      <button
        type="button"
        aria-pressed={isFlipped}
        onClick={() => setIsFlipped((value) => !value)}
        className={`kana-flip-card block h-[31rem] w-full text-left sm:h-[29rem] ${isFlipped ? "is-flipped" : ""}`}
      >
        <span className="kana-flip-card-inner">
          <span className="kana-flip-face neo-surface flex flex-col items-center justify-center bg-white p-7 text-center sm:p-10">
            <span className="font-japanese text-6xl leading-tight font-black sm:text-8xl">{currentCard.word}</span>
            <span className="font-japanese mt-5 text-2xl font-bold text-muted-foreground sm:text-3xl">{currentCard.reading}</span>
            <span className="mt-2 font-mono text-sm font-bold tracking-widest uppercase">{currentCard.romaji}</span>
            <span className="mt-7 flex flex-wrap justify-center gap-2">
              {currentCard.tags.map((tag) => (
                <span key={tag.slug} className="border-2 border-black bg-neo-blue px-3 py-1 text-xs font-black shadow-neo-sm">{tag.label}</span>
              ))}
            </span>
            <span className="absolute right-5 bottom-5 font-mono text-[10px] font-bold tracking-widest uppercase">Klik untuk melihat arti</span>
          </span>

          <span className="kana-flip-face kana-flip-back neo-surface flex flex-col overflow-y-auto bg-neo-yellow p-7 sm:p-10">
            <span className="text-center text-4xl font-black sm:text-5xl">{currentCard.meaning}</span>
            <span className="mt-2 text-center font-mono text-sm font-bold tracking-widest uppercase">{currentCard.romaji}</span>
            <span className="mt-6 block border-t-[3px] border-black pt-5">
              <span className="mb-3 block text-sm font-black tracking-widest uppercase">Contoh penggunaan</span>
              <span className="grid gap-3">
                {currentCard.usageExamples.map((example) => (
                  <span key={`${example.sentence}-${example.meaning}`} className="block border-2 border-black bg-white p-4 shadow-neo-sm">
                    <span className="font-japanese block text-xl font-black">{example.sentence}</span>
                    <span className="mt-1 block text-sm text-muted-foreground">{example.meaning}</span>
                  </span>
                ))}
              </span>
            </span>
          </span>
        </span>
      </button>

      <div className="mt-5 flex justify-center">
        <button type="button" onClick={playAudio} className="neo-button bg-white">
          <Volume2 className="size-5" aria-hidden="true" /> Dengarkan pelafalan
        </button>
      </div>

      {speechMessage ? <p role="status" className="mt-4 border-2 border-black bg-neo-yellow px-4 py-3 text-sm font-bold shadow-neo-sm">{speechMessage}</p> : null}
      {actionMessage ? <p role="alert" className="mt-4 border-2 border-black bg-neo-coral px-4 py-3 text-sm font-bold shadow-neo-sm">{actionMessage}</p> : null}

      {mode === "browse" ? (
        <div className="mt-7 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <button type="button" disabled={currentIndex === 0} onClick={() => move(-1)} className="neo-button justify-self-start bg-white px-3 sm:px-5">
            <ChevronLeft className="size-5" aria-hidden="true" /> <span className="hidden sm:inline">Sebelumnya</span>
          </button>
          <span className="font-mono text-xs font-black">{currentIndex + 1} / {activeCards.length}</span>
          <button type="button" disabled={currentIndex === activeCards.length - 1} onClick={() => move(1)} className="neo-button justify-self-end bg-white px-3 sm:px-5">
            <span className="hidden sm:inline">Berikutnya</span> <ChevronRight className="size-5" aria-hidden="true" />
          </button>
        </div>
      ) : isFlipped ? (
        <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Nilai ingatan">
          {RATING_OPTIONS.map((option) => (
            <button key={option.rating} type="button" disabled={isPending} onClick={() => rate(option.rating)} className={`neo-button h-auto flex-col gap-1 py-3 ${option.className}`}>
              <span className="flex items-center gap-2"><option.icon className="size-4" /> {option.label}</span>
              <span className="font-mono text-[10px] tracking-wide uppercase">{option.hint}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-7 text-center text-sm font-bold text-muted-foreground">Buka kartu dahulu sebelum memberi rating.</p>
      )}
    </div>
  );
}
