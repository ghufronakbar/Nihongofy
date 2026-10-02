"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Ban, EyeOff, Loader2, Timer, Undo2 } from "lucide-react";
import { ReportButton } from "@/features/report/components/report-button";
import { getOwnVocabNotesAction } from "@/features/question-comment/actions";
import { DiscussionSheet } from "@/features/question-comment/components/discussion-sheet";
import type { OwnNote } from "@/features/question-comment/queries";
import { cn } from "@/lib/utils";
import type { FlashcardDisplay, FlashcardRatingInput } from "../schemas";
import type {
  CardDiscussionData,
  PendingLearningCard,
  ReviewerCard,
  ReviewerCardKind,
  StudyCounts,
  TomorrowWindow,
} from "../types";
import { LEARN_AHEAD_MS } from "../lib/learn-ahead";
import {
  countByKind,
  countDueInWindow,
  summarizeSession,
  type SessionAnswer,
} from "../lib/session-summary";
import {
  answerCardAction,
  buryCardAction,
  setCardSuspendedAction,
  undoReviewAction,
} from "../actions";
import { CardNotes } from "./card-notes";
import { RATING_OPTIONS } from "./rating-options";
import { SessionSummaryPanel } from "./session-summary-panel";
import { VocabCardView } from "./vocab-card-view";

type Props = {
  /** Deck pemilik kartu; setiap aksi kartu menyebutnya. */
  deckSlug: string;
  deckName: string;
  /** Tujuan tombol kembali, di atas reviewer dan di layar akhir sesi. */
  back: { href: string; label: string };
  cards: ReviewerCard[];
  /** Kartu learning yang jatuh tempo nanti hari ini; ditampilkan saat waktunya tiba. */
  pendingLearning: PendingLearningCard[];
  /**
   * Kartu antrean yang tidak ikut dikirim karena batas potongan. Ditambahkan ke
   * hitungan di layar supaya angkanya sama dengan halaman deck.
   */
  unloadedCounts: StudyCounts;
  /** Bahan perkiraan "besok" di ringkasan; null di mode coba. */
  tomorrow: TomorrowWindow | null;
  /** Antrean server lebih panjang dari potongan yang dikirim. */
  hasMore: boolean;
  /** ISO, saat antrean dibangun; dasar pilihan kartu pertama (tanpa jam client saat render). */
  generatedAt: string;
  display: FlashcardDisplay;
  /**
   * Guest memakai mode coba: antrean berjalan penuh di client, tidak ada
   * penjadwalan yang disimpan dan tidak ada baris riwayat yang dibuat.
   */
  isGuest: boolean;
  /**
   * Status `FEATURES.report` dari halaman: komponen client tidak boleh menarik
   * `@/constants` ke bundle browser. Flag flashcard tidak perlu diteruskan —
   * reviewer hanya dirender di bawah /flashcard, yang 404 saat modulnya mati.
   */
  reportEnabled: boolean;
  /**
   * Catatan pribadi dan jumlah diskusi kata-kata sesi ini; null bila
   * `FEATURES_FLASHCARD_DISCUSSION` mati. Mode coba hanya membawa jumlah diskusi.
   */
  discussion: CardDiscussionData | null;
  /** User yang sedang login, untuk menulis di diskusi; null untuk guest. */
  currentUserId: number | null;
};

const COUNT_LABELS: { kind: ReviewerCardKind; label: string; tone: string }[] = [
  { kind: "new", label: "Baru", tone: "text-neo-blue" },
  { kind: "learning", label: "Belajar", tone: "text-neo-coral" },
  { kind: "review", label: "Ulang", tone: "text-neo-green" },
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
  /** Jawaban sesi ini, berurutan; sumber hitungan progres dan ringkasan. */
  answers: SessionAnswer[];
  /** Bertambah setiap kali kartu baru tampil; dipakai untuk mengukur waktu jawab. */
  turn: number;
};

type QueueAction =
  | { type: "reveal" }
  | { type: "showFurigana" }
  | { type: "advance"; now: number; requeue?: WaitingCard; answer?: SessionAnswer }
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
      return { ...next, answers: action.answer ? [...state.answers, action.answer] : state.answers };
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
        // Undo selalu membatalkan jawaban terakhir sesi ini.
        answers: state.answers.slice(0, -1),
        turn: state.turn + 1,
      };
    }
  }
}

/**
 * Kartu pertama dipilih dengan aturan yang sama dengan sepanjang sesi: bila
 * antrean utama kosong tetapi ada kartu learning dalam batas learn ahead, kartu
 * itu langsung tampil alih-alih layar istirahat.
 */
function initialState(
  cards: ReviewerCard[],
  pending: PendingLearningCard[],
  now: number,
): QueueState {
  return pickNext(
    {
      current: null,
      main: cards,
      learning: pending
        .map(({ dueAt, ...card }) => ({ card, dueAt: Date.parse(dueAt) }))
        .sort((left, right) => left.dueAt - right.dueAt),
      revealed: false,
      furiganaShown: false,
      answers: [],
      // pickNext menaikkannya menjadi 0 untuk kartu pertama.
      turn: -1,
    },
    now,
  );
}

/**
 * Jam sesi berjalan. Komponen sendiri supaya detaknya tidak me-render ulang
 * kartu. `startedAt` diturunkan dari jawaban pertama, sehingga jam tidak
 * kembali ke nol saat reviewer muncul lagi setelah layar istirahat.
 */
function SessionClock({ startedAt }: { startedAt: number | null }) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const origin = startedAt ?? Date.now();
    const tick = () => setSeconds(Math.max(0, Math.floor((Date.now() - origin) / 1_000)));
    const first = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, 1_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [startedAt]);

  const minutes = Math.floor(seconds / 60);
  return (
    <span className="inline-flex items-center gap-1 font-bold tabular-nums text-muted-foreground">
      <Timer className="size-4" aria-hidden />
      <span aria-label="Durasi sesi">
        {String(minutes).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}
      </span>
    </span>
  );
}

// --- Komponen -------------------------------------------------------------------

export function FlashcardReviewer({
  deckSlug,
  deckName,
  back,
  cards,
  pendingLearning,
  unloadedCounts,
  tomorrow,
  hasMore,
  generatedAt,
  display,
  isGuest,
  reportEnabled,
  discussion,
  currentUserId,
}: Props) {
  const router = useRouter();
  const [state, dispatch] = useReducer(reducer, undefined, () =>
    initialState(cards, pendingLearning, Date.parse(generatedAt)),
  );
  const [pending, setPending] = useState(false);
  const [lastReview, setLastReview] = useState<{ token: string; card: ReviewerCard } | null>(null);

  // Ref, bukan state: waktu tampil hanya dipakai untuk mengukur durasi jawaban
  // dan tidak boleh memicu render.
  const shownAt = useRef(0);
  const tokens = useRef(new Map<number, string>());
  // Dialog laporan sedang terbuka: keyboard milik dialog, bukan reviewer. Ref,
  // bukan state, supaya membuka dialog tidak me-render ulang sesi.
  const reportOpen = useRef(false);
  // Sheet diskusi terbuka: sama seperti dialog laporan, keyboard milik sheet.
  const discussionOpen = useRef(false);
  // Catatan pribadi per kata. Disimpan di state reviewer (bukan diambil ulang
  // dari halaman) supaya catatan yang baru ditulis ikut tampil saat kartu yang
  // sama muncul lagi di sesi ini, tanpa me-refresh halaman belajar.
  const [notesByVocab, setNotesByVocab] = useState<Record<number, OwnNote[]>>(
    () => discussion?.notes ?? {},
  );

  const refreshNotes = useCallback(async (vocabId: number) => {
    try {
      const notes = await getOwnVocabNotesAction({ vocabId });
      setNotesByVocab((previous) => ({ ...previous, [vocabId]: notes }));
    } catch {
      toast.error("Gagal memuat catatan. Coba lagi.");
    }
  }, []);

  const { current, revealed } = state;
  const furiganaVisible = display.showFuriganaOnBack || state.furiganaShown;

  useEffect(() => {
    shownAt.current = Date.now();
    // Tombol laporan hanya ada selama kartu terbuka, jadi kartu baru berarti
    // dialog kartu sebelumnya sudah tidak ada.
    reportOpen.current = false;
    discussionOpen.current = false;
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

      const takenMs = shownAt.current ? Math.min(3_600_000, Date.now() - shownAt.current) : 0;
      const record = (dueAt: number | null, becameLeech: boolean): SessionAnswer => ({
        vocabId: current.vocabId,
        wordPlain: current.content.wordPlain,
        kind: current.kind,
        rating,
        takenMs,
        answeredAt: Date.now(),
        dueAt,
        becameLeech,
      });

      if (isGuest) {
        // Rating guest hanya menggerakkan antrean. `Again` mengembalikan kartu
        // ke belakang antrean supaya latihannya tetap terasa benar.
        dispatch({
          type: "advance",
          now: Date.now(),
          answer: record(null, false),
          requeue:
            rating === "AGAIN"
              ? { card: { ...current, kind: "learning" }, dueAt: Date.now() + 60_000 }
              : undefined,
        });
        return;
      }

      const token = tokens.current.get(current.vocabId) ?? createToken();
      tokens.current.set(current.vocabId, token);

      setPending(true);
      try {
        const result = await answerCardAction({
          deckSlug,
          vocabId: current.vocabId,
          rating,
          takenMs,
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
        const dueAt = Date.parse(result.data.dueAt);
        dispatch({
          type: "advance",
          now: Date.now(),
          answer: record(dueAt, result.data.becameLeech),
          // Kartu learning yang jatuh tempo lagi hari ini tetap di sesi ini.
          requeue: labels
            ? { card: { ...current, kind: "learning", previewLabels: labels }, dueAt }
            : undefined,
        });
      } catch {
        toast.error("Gagal menyimpan jawaban. Coba lagi.");
      } finally {
        setPending(false);
      }
    },
    [current, deckSlug, isGuest, pending],
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
            ? await buryCardAction({ deckSlug, vocabId: current.vocabId })
            : await setCardSuspendedAction({ deckSlug, vocabId: current.vocabId, suspended: true });
        if (!result.ok) {
          toast.error(result.message);
          return;
        }
        toast.success(mode === "bury" ? "Kartu ditunda sampai besok." : "Kartu di-suspend.");
        setLastReview(null);
        dispatch({ type: "advance", now: Date.now() });
      } catch {
        toast.error("Gagal menyimpan. Coba lagi.");
      } finally {
        setPending(false);
      }
    },
    [current, deckSlug, isGuest, pending],
  );

  // Pintasan keyboard Anki: spasi membuka jawaban, 1-4 memberi rating.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      // Tanpa dua penjaga ini, Space/Enter pada tombol atau checkbox di dalam
      // dialog laporan ikut menilai kartu di belakangnya (dan preventDefault-nya
      // membatalkan klik tombol itu). Status dialog dicek lebih dulu karena fokus
      // tidak selalu berada di dalam dialog, mis. saat tombol kirim di-disable
      // selama laporan dikirim.
      if (reportOpen.current || discussionOpen.current) return;
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (target instanceof Element && target.closest('[role="dialog"], [role="alertdialog"]')) return;
      // Tombol di dalam catatan (Simpan, Edit, Bagikan) tidak boleh ikut
      // menilai kartu lewat Space/Enter.
      if (target instanceof Element && target.closest('[data-reviewer-keys="off"]')) return;

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
      const rating = RATING_OPTIONS.find((item) => item.key === event.key);
      if (rating && revealed) {
        event.preventDefault();
        void answer(rating.value);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [answer, revealed]);

  // Kartu dilaporkan setelah sisi belakangnya terbaca: kesalahan isi (arti,
  // bacaan, contoh) baru terlihat di sana.
  const canReport = reportEnabled && revealed;
  // Catatan dan diskusi berisi arti kata, jadi baru muncul setelah jawaban dibuka.
  const canDiscuss = discussion !== null && revealed;
  const canTakeNotes = canDiscuss && !isGuest && currentUserId !== null;

  // Seperti Anki, kartu yang sedang tampil ikut dihitung, dan kartu learning
  // yang menunggu jatuh tempo tetap masuk hitungan "Belajar".
  const counts = countByKind(
    [
      ...(current ? [current] : []),
      ...state.main,
      ...state.learning.map((item) => item.card),
    ],
    unloadedCounts,
  );
  const answeredCount = state.answers.length;
  const remainingCount = counts.new + counts.learning + counts.review;
  const progress =
    answeredCount + remainingCount === 0 ? 0 : answeredCount / (answeredCount + remainingCount);

  if (!current) {
    const waiting = state.learning[0];
    const summary = summarizeSession(state.answers);
    const tomorrowCount = tomorrow
      ? tomorrow.base +
        countDueInWindow(state.answers, Date.parse(tomorrow.start), Date.parse(tomorrow.end))
      : null;

    return (
      <div className="neo-surface mx-auto max-w-2xl p-6 text-center sm:p-8">
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
              {answeredCount} jawaban di {deckName}.
            </p>
          </>
        )}
        {isGuest ? (
          <p className="mt-4 font-bold text-neo-coral">Mode coba — progres tadi tidak disimpan.</p>
        ) : null}
        {answeredCount > 0 ? (
          <SessionSummaryPanel
            title={waiting ? "Sesi sejauh ini" : "Ringkasan sesi"}
            summary={summary}
            tomorrowCount={waiting ? null : tomorrowCount}
          />
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
          <Link href={back.href} className="neo-button bg-white">
            {back.label}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <header className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <Link
            href={back.href}
            className="inline-flex items-center gap-1 text-sm font-black underline"
          >
            <ArrowLeft className="size-4" aria-hidden /> {back.label}
          </Link>
          <SessionClock
            startedAt={state.answers[0] ? state.answers[0].answeredAt - state.answers[0].takenMs : null}
          />
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-xl font-black">{deckName}</h1>
          <dl className="flex items-baseline gap-4 font-black tabular-nums" aria-label="Sisa kartu">
            {COUNT_LABELS.map((item) => (
              <div
                key={item.kind}
                className="flex items-baseline gap-1"
                title={
                  item.kind === "learning" && state.learning.length > 0
                    ? `Termasuk ${state.learning.length} kartu yang menunggu jatuh tempo`
                    : undefined
                }
              >
                <dt className="text-xs font-bold text-muted-foreground uppercase">{item.label}</dt>
                <dd
                  className={cn(
                    "text-xl",
                    item.tone,
                    // Jenis kartu yang sedang tampil digaris bawah, seperti di Anki.
                    current.kind === item.kind && "underline decoration-[3px] underline-offset-4",
                  )}
                >
                  {counts[item.kind]}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="flex items-center gap-3">
          <div
            className="h-3 flex-1 overflow-hidden rounded-full border-2 border-neo-ink bg-card"
            role="progressbar"
            aria-label="Progres sesi"
            aria-valuemin={0}
            aria-valuemax={answeredCount + remainingCount}
            aria-valuenow={answeredCount}
          >
            <div className="h-full bg-neo-yellow" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <span className="shrink-0 text-xs font-bold text-muted-foreground tabular-nums">
            {answeredCount} dijawab
          </span>
        </div>
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
        isNew={current.kind === "new"}
        textScale={display.textScale}
        furiganaVisible={furiganaVisible}
        onShowFurigana={() => dispatch({ type: "showFurigana" })}
      />

      {revealed ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {RATING_OPTIONS.map((rating) => (
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

      {canTakeNotes ? (
        <CardNotes
          key={current.vocabId}
          vocabId={current.vocabId}
          notes={notesByVocab[current.vocabId] ?? []}
          canShare
          onChanged={() => void refreshNotes(current.vocabId)}
        />
      ) : null}

      {!isGuest || canReport || canDiscuss ? (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {!isGuest ? (
            <>
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
            </>
          ) : null}
          {canReport ? (
            // Dialognya terbuka di tempat dan action laporan tidak me-revalidate
            // route apa pun, jadi antrean, undo, dan hitungan sesi tidak tersentuh.
            // Di-disable selama jawaban disimpan: kartu berganti begitu jawaban
            // selesai, dan dialog yang sedang diisi akan ikut hilang.
            <ReportButton
              target={{ targetType: "FLASHCARD_VOCAB", vocabId: current.vocabId }}
              variant="neo"
              label="Laporkan kartu"
              subject={
                <span lang="ja" className="font-japanese">
                  {current.content.wordPlain}
                </span>
              }
              disabled={pending}
              onOpenChange={(open) => {
                reportOpen.current = open;
              }}
              className="px-3 py-2 text-xs"
            />
          ) : null}
          {canDiscuss ? (
            // Isi thread baru diambil saat sheet dibuka. `key` per kata supaya
            // thread kartu sebelumnya tidak terbawa ke kartu berikutnya.
            <DiscussionSheet
              key={current.vocabId}
              target={{ type: "vocab", vocabId: current.vocabId }}
              initialCount={discussion?.counts[current.vocabId] ?? 0}
              currentUserId={currentUserId}
              reportEnabled={reportEnabled}
              onOpenChange={(open) => {
                discussionOpen.current = open;
              }}
              // Catatan publik milik user juga tampil di "Catatanku".
              onPosted={canTakeNotes ? () => void refreshNotes(current.vocabId) : undefined}
              triggerClassName="neo-button gap-1.5 bg-white px-3 py-2 text-xs"
            />
          ) : null}
          {pending ? <Loader2 className="size-4 animate-spin" aria-label="Menyimpan" /> : null}
        </div>
      ) : null}
    </div>
  );
}
