"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, EyeOff, Loader2, Undo2 } from "lucide-react";
import type { FlashcardDisplay, FlashcardRatingInput } from "../schemas";
import type { PendingLearningCard, ReviewerCard } from "../types";
import { LEARN_AHEAD_MS } from "../lib/learn-ahead";
import {
  answerCardAction,
  buryCardAction,
  setCardSuspendedAction,
  undoReviewAction,
} from "../actions";
import { VocabCardView } from "./vocab-card-view";

type Props = {
  deckName: string;
  deckHref: string;
  cards: ReviewerCard[];
  /** Kartu learning yang jatuh tempo nanti hari ini; ditampilkan saat waktunya tiba. */
  pendingLearning: PendingLearningCard[];
  /** Antrean server lebih panjang dari potongan yang dikirim. */
  hasMore: boolean;
  display: FlashcardDisplay;
  /**
   * Guest memakai mode coba: antrean berjalan penuh di client, tidak ada
   * penjadwalan yang disimpan dan tidak ada baris riwayat yang dibuat.
   */
  isGuest: boolean;
};

const RATINGS: { value: FlashcardRatingInput; label: string; key: string; tone: string }[] = [
  { value: "AGAIN", label: "Again", key: "1", tone: "bg-neo-coral text-black" },
  { value: "HARD", label: "Hard", key: "2", tone: "bg-neo-yellow text-black" },
  { value: "GOOD", label: "Good", key: "3", tone: "bg-neo-green text-black" },
  { value: "EASY", label: "Easy", key: "4", tone: "bg-neo-blue text-black" },
];

/** Token idempotency: dibuat sekali per kartu dan dipakai ulang saat retry. */
function createToken() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

// --- State antrean -------------------------------------------------------------

type WaitingCard = { card: ReviewerCard; dueAt: number };

type QueueState = {
  current: ReviewerCard | null;
  main: ReviewerCard[];
  /** Kartu learning yang menunggu jatuh tempo, urut dari yang terdekat. */
  learning: WaitingCard[];
  revealed: boolean;
  furiganaShown: boolean;
  answered: number;
  /** Bertambah setiap kali kartu baru tampil; dipakai untuk mengukur waktu jawab. */
  turn: number;
};

type QueueAction =
  | { type: "reveal" }
  | { type: "showFurigana" }
  | { type: "advance"; now: number; requeue?: WaitingCard; counted: boolean }
  | { type: "tick"; now: number }
  | { type: "undo"; card: ReviewerCard };

function insertByDue(list: WaitingCard[], entry: WaitingCard) {
  const next = list.filter((item) => item.card.vocabId !== entry.card.vocabId);
  const index = next.findIndex((item) => item.dueAt > entry.dueAt);
  return index === -1 ? [...next, entry] : [...next.slice(0, index), entry, ...next.slice(index)];
}

/**
 * Kartu berikutnya mengikuti Anki: kartu learning yang sudah jatuh tempo lebih
 * dulu, lalu antrean utama, lalu kartu learning yang jatuh tempo dalam batas
 * learn ahead. Selebihnya reviewer menunggu.
 */
function pickNext(state: QueueState, now: number): QueueState {
  const [first, ...restLearning] = state.learning;
  const base = { ...state, revealed: false, furiganaShown: false, turn: state.turn + 1 };

  if (first && first.dueAt <= now) return { ...base, current: first.card, learning: restLearning };
  if (state.main.length > 0) {
    const [next, ...rest] = state.main;
    return { ...base, current: next!, main: rest };
  }
  if (first && first.dueAt <= now + LEARN_AHEAD_MS) {
    return { ...base, current: first.card, learning: restLearning };
  }
  return { ...base, current: null };
}

function reducer(state: QueueState, action: QueueAction): QueueState {
  switch (action.type) {
    case "reveal":
      return { ...state, revealed: true };
    case "showFurigana":
      return { ...state, furiganaShown: true };
    case "advance": {
      const learning = action.requeue ? insertByDue(state.learning, action.requeue) : state.learning;
      const next = pickNext({ ...state, learning, current: null }, action.now);
      return { ...next, answered: state.answered + (action.counted ? 1 : 0) };
    }
    case "tick":
      return state.current ? state : pickNext(state, action.now);
    case "undo": {
      // Kartu yang sedang tampil dikembalikan ke depan antrean; kartu yang
      // dibatalkan tampil lagi dengan label tombol aslinya.
      const main = state.current ? [state.current, ...state.main] : state.main;
      return {
        ...state,
        current: action.card,
        main,
        learning: state.learning.filter((item) => item.card.vocabId !== action.card.vocabId),
        revealed: false,
        furiganaShown: false,
        answered: Math.max(0, state.answered - 1),
        turn: state.turn + 1,
      };
    }
  }
}

function initialState(cards: ReviewerCard[], pending: PendingLearningCard[]): QueueState {
  const [first, ...rest] = cards;
  return {
    current: first ?? null,
    main: rest,
    learning: pending
      .map(({ dueAt, ...card }) => ({ card, dueAt: Date.parse(dueAt) }))
      .sort((left, right) => left.dueAt - right.dueAt),
    revealed: false,
    furiganaShown: false,
    answered: 0,
    turn: 0,
  };
}

// --- Komponen -------------------------------------------------------------------

export function FlashcardReviewer({
  deckName,
  deckHref,
  cards,
  pendingLearning,
  hasMore,
  display,
  isGuest,
}: Props) {
  const router = useRouter();
  const [state, dispatch] = useReducer(reducer, undefined, () =>
    initialState(cards, pendingLearning),
  );
  const [pending, setPending] = useState(false);
  const [lastReview, setLastReview] = useState<{ token: string; card: ReviewerCard } | null>(null);

  // Ref, bukan state: waktu tampil hanya dipakai untuk mengukur durasi jawaban
  // dan tidak boleh memicu render.
  const shownAt = useRef(0);
  const tokens = useRef(new Map<number, string>());

  const { current, revealed } = state;
  const furiganaVisible = display.showFuriganaOnBack || state.furiganaShown;

  useEffect(() => {
    shownAt.current = Date.now();
  }, [state.turn]);

  // Tidak ada kartu yang bisa tampil sekarang, tetapi ada kartu learning yang
  // akan jatuh tempo: bangunkan reviewer begitu kartu itu masuk batas learn ahead.
  const nextDueAt = state.current ? null : (state.learning[0]?.dueAt ?? null);
  useEffect(() => {
    if (nextDueAt === null) return;
    const delay = Math.max(0, nextDueAt - LEARN_AHEAD_MS - Date.now()) + 250;
    const timer = window.setTimeout(() => dispatch({ type: "tick", now: Date.now() }), delay);
    return () => window.clearTimeout(timer);
  }, [nextDueAt]);

  const answer = useCallback(
    async (rating: FlashcardRatingInput) => {
      if (!current || pending) return;

      if (isGuest) {
        // Rating guest hanya menggerakkan antrean. `Again` mengembalikan kartu
        // ke belakang antrean supaya latihannya tetap terasa benar.
        dispatch({
          type: "advance",
          now: Date.now(),
          counted: true,
          requeue: rating === "AGAIN" ? { card: current, dueAt: Date.now() + 60_000 } : undefined,
        });
        return;
      }

      const token = tokens.current.get(current.vocabId) ?? createToken();
      tokens.current.set(current.vocabId, token);

      setPending(true);
      try {
        const result = await answerCardAction({
          vocabId: current.vocabId,
          rating,
          takenMs: shownAt.current ? Math.min(3_600_000, Date.now() - shownAt.current) : 0,
          clientToken: token,
        });

        if (!result.ok) {
          toast.error(result.message);
          return;
        }
        if (result.data.becameLeech) {
          toast.warning("Kartu ini ditandai leech karena sering terlupa.");
        }

        tokens.current.delete(current.vocabId);
        setLastReview({ token, card: current });
        const labels = result.data.nextPreviewLabels;
        dispatch({
          type: "advance",
          now: Date.now(),
          counted: true,
          // Kartu learning yang jatuh tempo lagi hari ini tetap di sesi ini.
          requeue: labels
            ? {
                card: { ...current, isNew: false, previewLabels: labels },
                dueAt: Date.parse(result.data.dueAt),
              }
            : undefined,
        });
      } catch {
        toast.error("Gagal menyimpan jawaban. Coba lagi.");
      } finally {
        setPending(false);
      }
    },
    [current, isGuest, pending],
  );

  const undo = useCallback(async () => {
    if (!lastReview || isGuest || pending) return;
    setPending(true);
    try {
      const result = await undoReviewAction({ clientToken: lastReview.token });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      dispatch({ type: "undo", card: lastReview.card });
      setLastReview(null);
    } catch {
      toast.error("Gagal membatalkan. Coba lagi.");
    } finally {
      setPending(false);
    }
  }, [isGuest, lastReview, pending]);

  const hide = useCallback(
    async (mode: "bury" | "suspend") => {
      if (!current || isGuest || pending) return;
      setPending(true);
      try {
        const result =
          mode === "bury"
            ? await buryCardAction({ vocabId: current.vocabId })
            : await setCardSuspendedAction({ vocabId: current.vocabId, suspended: true });
        if (!result.ok) {
          toast.error(result.message);
          return;
        }
        toast.success(mode === "bury" ? "Kartu ditunda sampai besok." : "Kartu di-suspend.");
        setLastReview(null);
        dispatch({ type: "advance", now: Date.now(), counted: false });
      } catch {
        toast.error("Gagal menyimpan. Coba lagi.");
      } finally {
        setPending(false);
      }
    },
    [current, isGuest, pending],
  );

  // Pintasan keyboard Anki: spasi membuka jawaban, 1-4 memberi rating.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;

      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        if (!revealed) dispatch({ type: "reveal" });
        else void answer("GOOD");
        return;
      }
      if ((event.key === "f" || event.key === "F") && revealed) {
        dispatch({ type: "showFurigana" });
        return;
      }
      const rating = RATINGS.find((item) => item.key === event.key);
      if (rating && revealed) {
        event.preventDefault();
        void answer(rating.value);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [answer, revealed]);

  const remaining = state.main.length + (current ? 1 : 0);

  if (!current) {
    const waiting = state.learning[0];
    return (
      <div className="neo-surface mx-auto max-w-xl p-8 text-center">
        {waiting ? (
          <>
            <h2 className="text-2xl font-black">Istirahat sebentar</h2>
            <p className="mt-3 font-bold text-muted-foreground">
              {state.learning.length} kartu learning tampil lagi mulai pukul{" "}
              <time suppressHydrationWarning dateTime={new Date(waiting.dueAt).toISOString()}>
                {new Date(waiting.dueAt).toLocaleTimeString("id-ID", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
              . Biarkan halaman ini terbuka, atau kembali nanti.
            </p>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-black">Antrean selesai</h2>
            <p className="mt-3 font-bold text-muted-foreground">
              {state.answered} kartu ditinjau di {deckName}.
            </p>
          </>
        )}
        {isGuest ? (
          <p className="mt-4 font-bold text-neo-coral">Mode coba — progres tadi tidak disimpan.</p>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {hasMore && !waiting ? (
            <button
              type="button"
              onClick={() => router.refresh()}
              className="neo-button bg-neo-yellow"
            >
              Lanjutkan
            </button>
          ) : null}
          <Link href={deckHref} className="neo-button bg-white">
            Kembali ke deck
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-black">{deckName}</h1>
        <p className="font-black tabular-nums">
          {remaining} tersisa
          {state.learning.length > 0 ? (
            <span className="ml-2 text-sm font-bold text-muted-foreground">
              +{state.learning.length} menunggu
            </span>
          ) : null}
        </p>
      </header>

      {isGuest ? (
        <p
          role="status"
          className="rounded-lg border-[3px] border-neo-ink bg-neo-yellow px-4 py-3 text-sm font-extrabold text-black shadow-neo-sm"
        >
          Mode coba — progres tidak disimpan.{" "}
          <Link href="/register" className="underline">
            Daftar
          </Link>{" "}
          untuk menyimpan jadwal belajarmu.
        </p>
      ) : null}

      <VocabCardView
        content={current.content}
        revealed={revealed}
        isNew={current.isNew}
        textScale={display.textScale}
        furiganaVisible={furiganaVisible}
        onShowFurigana={() => dispatch({ type: "showFurigana" })}
      />

      {revealed ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {RATINGS.map((rating) => (
            <button
              key={rating.value}
              type="button"
              disabled={pending}
              onClick={() => void answer(rating.value)}
              className={`neo-button flex-col gap-0.5 py-3 ${rating.tone}`}
            >
              <span>{rating.label}</span>
              <span className="text-xs font-bold opacity-80">
                {current.previewLabels[rating.value]}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => dispatch({ type: "reveal" })}
          className="neo-button w-full bg-neo-yellow py-4 text-base"
        >
          Tampilkan jawaban{" "}
          <kbd className="ml-1 rounded border-2 border-black px-1.5 text-xs">Space</kbd>
        </button>
      )}

      {!isGuest ? (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => void undo()}
            disabled={!lastReview || pending}
            className="neo-button bg-white px-3 py-2 text-xs"
          >
            <Undo2 className="size-4" aria-hidden /> Undo
          </button>
          <button
            type="button"
            onClick={() => void hide("bury")}
            disabled={pending}
            className="neo-button bg-white px-3 py-2 text-xs"
          >
            <EyeOff className="size-4" aria-hidden /> Tunda
          </button>
          <button
            type="button"
            onClick={() => void hide("suspend")}
            disabled={pending}
            className="neo-button bg-white px-3 py-2 text-xs"
          >
            <Ban className="size-4" aria-hidden /> Suspend
          </button>
          {pending ? <Loader2 className="size-4 animate-spin" aria-label="Menyimpan" /> : null}
        </div>
      ) : null}
    </div>
  );
}
