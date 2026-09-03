"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Undo2, EyeOff, Ban, Loader2 } from "lucide-react";
import type { FlashcardRatingInput } from "../schemas";
import type { RenderedCard } from "../lib/render/card-content";
import {
  answerCardAction,
  buryCardAction,
  markBuriedSiblingsAction,
  suspendCardAction,
  undoReviewAction,
} from "../actions";

export type ReviewerCard = {
  cardId: string;
  noteId: string;
  deckName: string;
  content: RenderedCard;
  /** Interval yang akan didapat tiap tombol, sudah dihitung server. */
  previewLabels: Record<FlashcardRatingInput, string>;
  isNew: boolean;
};

type Props = {
  deckName: string;
  cards: ReviewerCard[];
  buriedCardIds: string[];
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

export function FlashcardReviewer({
  deckName,
  cards,
  buriedCardIds,
  isGuest,
}: Props) {
  const router = useRouter();
  const [queue, setQueue] = useState(cards);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [pending, setPending] = useState(false);
  const [lastReview, setLastReview] = useState<{ token: string; cardId: string } | null>(null);
  const [answered, setAnswered] = useState(0);

  // Ref, bukan state: waktu tampil hanya dipakai untuk mengukur durasi jawaban
  // dan tidak boleh memicu render. 0 berarti kartu belum sempat ditandai.
  const shownAt = useRef(0);
  const tokens = useRef(new Map<string, string>());
  const buriedMarked = useRef(false);

  const current = queue[index];

  useEffect(() => {
    shownAt.current = Date.now();
  }, [index]);

  // Sibling yang di-bury queue builder baru ditandai saat sesi benar-benar
  // dimulai, supaya membuka halaman deck lalu keluar tidak menyembunyikan kartu.
  useEffect(() => {
    if (isGuest || buriedMarked.current || buriedCardIds.length === 0) return;
    buriedMarked.current = true;
    void markBuriedSiblingsAction({ cardIds: buriedCardIds });
  }, [buriedCardIds, isGuest]);

  // Reset sisi kartu dilakukan di sini, bukan lewat effect yang mengamati
  // `index` — setState di dalam effect memicu render bertingkat.
  const advance = useCallback(() => {
    setIndex((value) => value + 1);
    setAnswered((value) => value + 1);
    setRevealed(false);
  }, []);

  const answer = useCallback(
    async (rating: FlashcardRatingInput) => {
      if (!current || pending) return;

      if (isGuest) {
        // Rating guest hanya menggerakkan antrean. `Again` mengembalikan kartu
        // ke belakang antrean supaya latihannya tetap terasa benar.
        if (rating === "AGAIN") {
          setQueue((items) => [...items, current]);
        }
        advance();
        return;
      }

      const token = tokens.current.get(current.cardId) ?? createToken();
      tokens.current.set(current.cardId, token);

      setPending(true);
      try {
        const result = await answerCardAction({
          cardId: current.cardId,
          rating,
          takenMs: shownAt.current
            ? Math.min(3_600_000, Date.now() - shownAt.current)
            : 0,
          clientToken: token,
        });

        if (!result.ok) {
          toast.error(result.message);
          return;
        }
        if (result.data.becameLeech) {
          toast.warning("Kartu ini ditandai leech karena sering terlupa.");
        }

        setLastReview({ token, cardId: current.cardId });
        tokens.current.delete(current.cardId);
        advance();
      } catch {
        toast.error("Gagal menyimpan jawaban. Coba lagi.");
      } finally {
        setPending(false);
      }
    },
    [advance, current, isGuest, pending],
  );

  const undo = useCallback(async () => {
    if (!lastReview || isGuest) return;
    setPending(true);
    try {
      const result = await undoReviewAction({ clientToken: lastReview.token });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setLastReview(null);
      setIndex((value) => Math.max(0, value - 1));
      setAnswered((value) => Math.max(0, value - 1));
      router.refresh();
    } finally {
      setPending(false);
    }
  }, [isGuest, lastReview, router]);

  const hide = useCallback(
    async (mode: "bury" | "suspend") => {
      if (!current || isGuest || pending) return;
      setPending(true);
      try {
        const result =
          mode === "bury"
            ? await buryCardAction({ cardId: current.cardId })
            : await suspendCardAction({ cardId: current.cardId });
        if (!result.ok) {
          toast.error(result.message);
          return;
        }
        toast.success(mode === "bury" ? "Kartu ditunda sampai besok." : "Kartu di-suspend.");
        advance();
      } finally {
        setPending(false);
      }
    },
    [advance, current, isGuest, pending],
  );

  // Pintasan keyboard Anki: spasi membuka jawaban, 1-4 memberi rating.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;

      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        if (!revealed) setRevealed(true);
        else void answer("GOOD");
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

  const remaining = useMemo(() => queue.length - index, [index, queue.length]);

  if (!current) {
    return (
      <div className="neo-surface mx-auto max-w-xl p-8 text-center">
        <h2 className="text-2xl font-black">Antrean selesai</h2>
        <p className="mt-3 font-bold text-muted-foreground">
          {answered} kartu ditinjau di {deckName}.
        </p>
        {isGuest ? (
          <p className="mt-4 font-bold text-neo-coral">
            Mode coba — progres tadi tidak disimpan.
          </p>
        ) : null}
        <Link href="/flashcard" className="neo-button mt-6 bg-neo-yellow">
          Kembali ke daftar deck
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black tracking-wide uppercase text-muted-foreground">
            {current.deckName}
          </p>
          <h1 className="text-xl font-black">{deckName}</h1>
        </div>
        <p className="font-black tabular-nums">{remaining} tersisa</p>
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

      <article className="neo-surface min-h-64 p-7">
        <p className="text-xs font-black tracking-wide uppercase text-muted-foreground">
          {current.content.templateName}
        </p>

        <div className="mt-5 space-y-4">
          {current.content.front.map((field) => (
            <div key={field.key}>
              <p
                className={
                  field.japanese
                    ? "text-3xl leading-relaxed font-black sm:text-4xl"
                    : "text-xl font-bold"
                }
                dangerouslySetInnerHTML={{ __html: field.html }}
              />
            </div>
          ))}
        </div>

        {revealed ? (
          <div className="mt-6 space-y-4 border-t-[3px] border-dashed border-neo-ink pt-6">
            {current.content.back.map((field) => (
              <div key={field.key}>
                <p className="text-xs font-black tracking-wide uppercase text-muted-foreground">
                  {field.label}
                </p>
                <p
                  className={
                    field.japanese ? "text-2xl font-bold" : "text-lg font-semibold"
                  }
                  dangerouslySetInnerHTML={{ __html: field.html }}
                />
              </div>
            ))}
          </div>
        ) : null}
      </article>

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
          onClick={() => setRevealed(true)}
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
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-label="Menyimpan" />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
