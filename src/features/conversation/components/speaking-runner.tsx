"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Baseline,
  Keyboard,
  Languages,
  Loader2,
  Mic,
  MicOff,
  RotateCcw,
  Send,
  Type,
  Volume2,
} from "lucide-react";
import { JapaneseText } from "@/components/japanese-text";
import { markupToPlainText } from "@/lib/japanese-plain-text";
import { cn } from "@/lib/utils";
import {
  CONVERSATION_MAX_TURNS_PER_SESSION,
  CONVERSATION_MAX_USER_CHARS,
} from "@/constants/conversation";
import { streamConversationReply } from "../lib/stream-reply";
import { findPersona } from "../data/personas";
import { findTopic } from "../data/topics";
import type { ConversationMockFailure } from "../schemas";
import { detectSpeechSupport, type SpeechSupport } from "../lib/speech";
import type { CharacterState } from "../types";
import { useSpeechCapture } from "../lib/use-speech-capture";
import { useLipSync } from "../lib/use-lip-sync";
import {
  countUserTurns,
  createItemId,
  onlyTurns,
  type TimelineItem,
  type TimelineTurn,
} from "../lib/timeline";
import type { ConversationSessionView } from "../queries";
import { updateDisplayPreferenceAction } from "../actions";
import { primeVoices, speakAsPersona } from "../lib/persona-voice";
import { MockControls } from "./mock-controls";
import { PersonaAvatar } from "./persona-avatar";


const FAILURE_COPY: Record<string, string> = {
  timeout: "Partner tidak sempat menjawab pesan ini.",
  provider_error: "Layanan percakapan sedang bermasalah saat membalas pesan ini.",
  quota_exceeded: "Kuota percakapan hari ini sudah habis.",
  moderation_blocked: "Pesan ini tidak dapat diproses. Coba ucapkan dengan kalimat lain.",
  unauthorized: "Sesi masuk sudah berakhir. Silakan masuk kembali.",
  disabled: "Fitur percakapan sedang tidak aktif.",
  invalid_input: "Pesan ini tidak dapat diproses. Periksa panjang dan isinya.",
};

const CHARACTER_LABEL: Record<CharacterState, string> = {
  idle: "Menunggu giliranmu",
  listening: "Mendengarkan",
  talking: "Sedang berbicara",
  happy: "Senang",
  thinking: "Sedang menyusun jawaban",
  tsun: "Tsun",
};

export function SpeakingRunner({ session }: { session: ConversationSessionView }) {
  const persona = findPersona(session.personaKey);

  const [items, setItems] = useState<TimelineItem[]>(() =>
    session.turns.length > 0
      ? session.turns.map((turn) => ({
          kind: "turn" as const,
          id: `turn-${turn.id}`,
          role: turn.role,
          contentJa: turn.contentJa,
          contentTranslation: turn.contentTranslation,
          contentRomaji: turn.contentRomaji,
        }))
      : persona
        ? [
            {
              kind: "turn" as const,
              id: createItemId(),
              role: "ASSISTANT" as const,
              contentJa: persona.greeting,
              contentTranslation: persona.greetingTranslation,
              contentRomaji: persona.greetingRomaji,
            },
          ]
        : [],
  );
  const [showTranslation, setShowTranslation] = useState(session.showTranslation);
  const [showRomaji, setShowRomaji] = useState(session.showRomaji);
  const [showFurigana, setShowFurigana] = useState(session.showFurigana);
  const [support, setSupport] = useState<SpeechSupport | null>(null);
  const [draft, setDraft] = useState("");
  const [typedMode, setTypedMode] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [streamingJa, setStreamingJa] = useState("");
  // Mode bebas tangan: satu saklar dengar/hening. Selama aktif, giliran berputar
  // sendiri — bicara, berhenti, karakter menjawab, lalu mendengarkan lagi.
  const [handsFree, setHandsFree] = useState(false);
  const handsFreeRef = useRef(false);
  const [lipSyncRate, setLipSyncRate] = useState(1);
  const [mockFailure, setMockFailure] = useState<ConversationMockFailure>("none");
  const [isPending, startTransition] = useTransition();
  const historyRef = useRef<HTMLDivElement | null>(null);

  // SPK-1: probe dukungan dijalankan di client karena bergantung pada API
  // browser, dan hasilnya ditampilkan sebelum user mencoba merekam.
  // Daftar suara terisi asinkron; dipanaskan sejak awal supaya ucapan pertama
  // tidak jatuh ke suara bawaan browser.
  useEffect(() => {
    primeVoices();
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupport(detectSpeechSupport());
  }, []);

  // Riwayat digulirkan di dalam kotaknya sendiri, bukan lewat halaman: mengirim
  // giliran baru tidak boleh menggeser karakter dari pandangan.
  useEffect(() => {
    const box = historyRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [items.length, isPending]);

  // Di mode manual, hasil pengenalan suara masuk sebagai transcript yang dapat
  // diedit dulu (SPK-4). Di mode bebas tangan justru sebaliknya: menahannya di
  // kotak teks akan memutus alur percakapan, jadi langsung dikirim.
  const sendRef = useRef<((spoken: boolean, override?: string) => void) | null>(null);

  const handleFinalTranscript = useCallback((transcript: string) => {
    if (handsFreeRef.current) {
      sendRef.current?.(true, transcript);
      return;
    }
    setDraft((previous) => (previous ? `${previous} ${transcript}` : transcript));
  }, []);

  const capture = useSpeechCapture({ onFinalTranscript: handleFinalTranscript });
  const lipSync = useLipSync(lipSyncRate);

  // Kegagalan mikrofon menonaktifkan mode secara turunan, bukan lewat setState
  // di dalam effect. Tanpa ini tombolnya tampak aktif padahal tidak ada yang
  // mendengarkan, dan izin yang ditolak berubah jadi perulangan tanpa akhir.
  const handsFreeActive = handsFree && !capture.error;

  useEffect(() => {
    handsFreeRef.current = handsFreeActive;
  }, [handsFreeActive]);

  const turnCount = countUserTurns(items);
  const limitReached = turnCount >= CONVERSATION_MAX_TURNS_PER_SESSION;
  const lastAssistantTurn = [...onlyTurns(items)]
    .reverse()
    .find((turn) => turn.role === "ASSISTANT");
  // Siklus bebas tangan. Pendengaran dinyalakan lagi hanya ketika benar-benar
  // menganggur: tidak menunggu balasan, tidak bersuara, tidak sedang merekam.
  useEffect(() => {
    if (!handsFreeActive || limitReached) return;
    if (isPending || isSpeaking || capture.state !== "idle") return;

    const timer = setTimeout(() => {
      void capture.start();
    }, 400);

    return () => clearTimeout(timer);
  }, [handsFreeActive, limitReached, isPending, isSpeaking, capture]);

  const characterState: CharacterState = isSpeaking
    ? "talking"
    : isPending
      ? "thinking"
      : capture.state === "listening"
        ? "listening"
        : "idle";
  const recognitionAvailable = support?.recognition ?? false;
  const useTypedInput = typedMode || (support !== null && !recognitionAvailable);

  function savePreference(next: {
    showTranslation: boolean;
    showRomaji: boolean;
    showFurigana: boolean;
  }) {
    setShowTranslation(next.showTranslation);
    setShowRomaji(next.showRomaji);
    setShowFurigana(next.showFurigana);
    void updateDisplayPreferenceAction({ sessionId: session.id, ...next });
  }

  function requestReply(base: TimelineItem[], message: string, spoken: boolean) {
    startTransition(async () => {
      setStreamingJa("");

      const result = await streamConversationReply(
        {
          sessionId: session.id,
          userMessage: message,
          inputSource: spoken ? "SPEECH" : "TYPED",
          history: onlyTurns(base)
            .slice(0, -1)
            .map((turn) => ({
              role: turn.role,
              contentJa: turn.contentJa,
              contentTranslation: turn.contentTranslation,
              contentRomaji: turn.contentRomaji,
            })),
          mockFailure,
        },
        { onPartial: setStreamingJa },
      );

      setStreamingJa("");

      if (!result.ok) {
        setItems([
          ...base,
          {
            kind: "error",
            id: createItemId(),
            reason: result.reason,
            message: FAILURE_COPY[result.reason] ?? result.message,
          },
        ]);
        return;
      }

      setItems([
        ...base,
        {
          kind: "turn",
          id: createItemId(),
          role: "ASSISTANT",
          contentJa: result.contentJa,
          contentTranslation: result.contentTranslation,
          contentRomaji: result.contentRomaji,
        },
      ]);

      speak(result.contentJa);
    });
  }

  function send(spoken: boolean, override?: string) {
    const message = (override ?? draft).trim();
    if (!message || isPending || limitReached) return;

    if (capture.state === "listening") capture.stop();
    setNotice(null);
    capture.clearError();

    const optimistic: TimelineItem[] = [
      ...items,
      {
        kind: "turn",
        id: createItemId(),
        role: "USER",
        contentJa: message,
        contentTranslation: null,
        contentRomaji: null,
      },
    ];

    setItems(optimistic);
    setDraft("");
    requestReply(optimistic, message, spoken);
  }

  // Ref diperbarui lewat effect, bukan saat render: `send` dibuat ulang tiap
  // render dan menulis ref saat render tidak diizinkan.
  useEffect(() => {
    sendRef.current = send;
  });

  function retry(errorId: string) {
    if (isPending) return;

    const errorIndex = items.findIndex((item) => item.id === errorId);
    if (errorIndex < 0) return;

    const precedingUserTurn = [...items.slice(0, errorIndex)]
      .reverse()
      .find((item): item is TimelineTurn => item.kind === "turn" && item.role === "USER");
    if (!precedingUserTurn) return;

    const withoutError = items.filter((item) => item.id !== errorId);

    setItems(withoutError);
    requestReply(withoutError, precedingUserTurn.contentJa, false);
  }

  function speak(text: string) {
    if (!persona) return;

    setLipSyncRate(persona.voice.rate);

    const spoken = speakAsPersona(markupToPlainText(text), persona, {
      onStart: () => {
        setIsSpeaking(true);
        // Urutan mulut diturunkan dari markup aslinya, bukan teks polos —
        // bacaan furigana adalah sumber vokalnya.
        lipSync.start(text);
      },
      onEnd: () => {
        setIsSpeaking(false);
        lipSync.finish();
      },
    });

    if (!spoken.ok) {
      setIsSpeaking(false);
      lipSync.cancel();
    }
    setNotice(spoken.ok ? null : spoken.message);
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="neo-surface flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="flex items-center gap-3">
          <Link
            href="/speaking"
            aria-label="Kembali ke daftar latihan"
            className="grid size-10 place-items-center rounded-lg border-[3px] border-neo-ink bg-white shadow-neo-sm"
          >
            <ArrowLeft className="size-5" aria-hidden="true" />
          </Link>
          <div>
            <p className="font-black">{persona?.name ?? "Partner tidak dikenal"}</p>
            <p className="text-xs font-bold text-foreground/60">
              {session.jlptLevel} ·{" "}
              {session.topicKeys.map((key) => findTopic(key)?.label ?? key).join(", ")}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <TogglePill
            active={showFurigana}
            onClick={() =>
              savePreference({ showTranslation, showRomaji, showFurigana: !showFurigana })
            }
            icon={<Baseline className="size-4" aria-hidden="true" />}
            label="Furigana"
          />
          <TogglePill
            active={showRomaji}
            onClick={() =>
              savePreference({ showTranslation, showRomaji: !showRomaji, showFurigana })
            }
            icon={<Type className="size-4" aria-hidden="true" />}
            label="Romaji"
          />
          <TogglePill
            active={showTranslation}
            onClick={() =>
              savePreference({ showTranslation: !showTranslation, showRomaji, showFurigana })
            }
            icon={<Languages className="size-4" aria-hidden="true" />}
            label="Terjemahan"
          />
        </div>
      </header>

      <MockControls value={mockFailure} onChange={setMockFailure} />

      {support !== null && !recognitionAvailable && (
        <p className="border-[3px] border-neo-ink bg-neo-yellow p-4 text-sm font-bold">
          Browser ini belum mendukung pengenalan suara — praktisnya baru tersedia di browser
          berbasis Chromium. Latihan tetap bisa dijalankan penuh dengan mengetik jawabanmu.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-start">
        {/* Kolom fokus: karakter dan giliranmu. Sengaja tidak ikut bergeser
            saat riwayat bertambah — mode suara nanti berpusat di sini. */}
        <div className="flex flex-col gap-4 lg:sticky lg:top-20">
          <section
            className="neo-surface grid place-items-center gap-4 p-6 text-center sm:p-10"
            aria-label="Partner bicara"
          >
            {persona && (
              <PersonaAvatar
                persona={persona}
                size="xl"
                state={characterState}
                mouth={lipSync.mouth}
              />
            )}

            {/* Status juga ditulis sebagai teks, bukan hanya lewat animasi (SPK-8). */}
            <p aria-live="polite" className="text-sm font-black tracking-wider uppercase">
              {CHARACTER_LABEL[characterState]}
            </p>

            {isPending && streamingJa && (
          <div className="w-full max-w-2xl rounded-lg border-[3px] border-dashed border-neo-ink/50 bg-background p-4">
            <p
              lang="ja"
              className={cn(
                "font-japanese text-xl leading-relaxed font-bold",
                !showFurigana && "[&_rt]:hidden",
              )}
            >
              <JapaneseText text={streamingJa} />
            </p>
          </div>
        )}

        {!isPending && lastAssistantTurn && (
              <div className="w-full max-w-2xl rounded-lg border-[3px] border-neo-ink bg-background p-4">
                <p
                  lang="ja"
                  className={cn(
                    "font-japanese text-xl leading-relaxed font-bold",
                    !showFurigana && "[&_rt]:hidden",
                  )}
                >
                  <JapaneseText text={lastAssistantTurn.contentJa} />
                </p>
                {showRomaji && lastAssistantTurn.contentRomaji && (
                  <p className="mt-2 text-sm font-semibold text-foreground/55">
                    {lastAssistantTurn.contentRomaji}
                  </p>
                )}
                {showTranslation && lastAssistantTurn.contentTranslation && (
                  <p className="mt-1 text-sm font-semibold text-foreground/70">
                    {lastAssistantTurn.contentTranslation}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => speak(lastAssistantTurn.contentJa)}
                  className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-md border-2 border-neo-ink bg-white px-3 text-xs font-bold"
                >
                  <Volume2 className="size-4" aria-hidden="true" />
                  Ulangi suara
                </button>
              </div>
            )}
          </section>

          {(capture.error || notice) && (
            <p className="border-[3px] border-neo-ink bg-neo-yellow p-3 text-sm font-bold">
              {capture.error ?? notice}
            </p>
          )}

          {limitReached ? (
            <p className="border-[3px] border-neo-ink bg-neo-yellow p-4 font-bold">
              Batas {CONVERSATION_MAX_TURNS_PER_SESSION} giliran tercapai.{" "}
              <Link href="/speaking/setup" className="underline">
                Mulai latihan baru
              </Link>
              .
            </p>
          ) : (
            <section className="neo-surface space-y-4 p-4 sm:p-6" aria-label="Giliranmu">
              {!useTypedInput && (
                <div className="flex flex-col items-center gap-4">
                  <LevelMeter level={capture.level} active={capture.state === "listening"} />
                  <button
                    type="button"
                    role="switch"
                    aria-checked={handsFreeActive}
                    onClick={() => {
                      capture.clearError();
                      if (handsFreeActive) {
                        setHandsFree(false);
                        capture.stop();
                      } else {
                        setHandsFree(true);
                      }
                    }}
                    className={cn(
                      "grid size-20 place-items-center rounded-full border-[3px] border-neo-ink shadow-neo transition-transform",
                      handsFreeActive ? "bg-neo-coral text-white" : "bg-neo-green",
                    )}
                    aria-label={handsFreeActive ? "Hentikan percakapan" : "Mulai percakapan"}
                  >
                    {handsFreeActive ? (
                      <MicOff className="size-8" aria-hidden="true" />
                    ) : (
                      <Mic className="size-8" aria-hidden="true" />
                    )}
                  </button>
                  <p className="text-sm font-bold text-foreground/65">
                    {!handsFreeActive
                      ? "Tekan untuk mulai percakapan bebas tangan"
                      : capture.state === "requesting"
                        ? "Menunggu izin mikrofon…"
                        : capture.state === "listening"
                          ? "Bicara sekarang — berhenti sejenak, jawaban akan dikirim sendiri"
                          : isPending
                            ? "Menyusun jawaban…"
                            : isSpeaking
                              ? "Karakter sedang berbicara"
                              : "Bersiap mendengarkan lagi…"}
                  </p>
                  {capture.interim && (
                    <p lang="ja" className="font-japanese text-sm font-semibold text-foreground/55">
                      {capture.interim}…
                    </p>
                  )}
                </div>
              )}

              <div>
                <label htmlFor="speaking-transcript" className="text-sm font-black">
                  {useTypedInput
                    ? "Ketik jawabanmu"
                    : "Transkrip — periksa dan perbaiki sebelum kirim"}
                </label>
                <textarea
                  id="speaking-transcript"
                  value={draft}
                  onChange={(event) =>
                    setDraft(event.target.value.slice(0, CONVERSATION_MAX_USER_CHARS))
                  }
                  rows={2}
                  placeholder={
                    useTypedInput
                      ? "Tulis dalam bahasa Jepang atau Indonesia…"
                      : "Hasil rekaman muncul di sini…"
                  }
                  className="mt-2 min-h-11 w-full resize-none rounded-lg border-[3px] border-neo-ink bg-white px-4 py-3 text-base text-black shadow-neo-sm outline-none placeholder:text-slate-500"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  {recognitionAvailable && (
                    <button
                      type="button"
                      onClick={() => setTypedMode((previous) => !previous)}
                      className="flex min-h-11 items-center gap-2 rounded-lg border-[3px] border-neo-ink bg-white px-3 text-sm font-bold shadow-neo-sm"
                    >
                      <Keyboard className="size-4" aria-hidden="true" />
                      {typedMode ? "Kembali ke mikrofon" : "Ketik saja"}
                    </button>
                  )}
                  {draft && (
                    <button
                      type="button"
                      onClick={() => setDraft("")}
                      className="flex min-h-11 items-center gap-2 rounded-lg border-[3px] border-neo-ink bg-white px-3 text-sm font-bold shadow-neo-sm"
                    >
                      <RotateCcw className="size-4" aria-hidden="true" />
                      Bersihkan
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => send(!useTypedInput)}
                  disabled={isPending || draft.trim().length === 0}
                  className="neo-button h-12 px-5"
                >
                  {isPending ? (
                    <Loader2 className="size-5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Send className="size-5" aria-hidden="true" />
                  )}
                  Kirim
                </button>
              </div>

              <p className="text-xs font-bold text-foreground/55">
                Giliran {turnCount}/{CONVERSATION_MAX_TURNS_PER_SESSION} · {draft.length}/
                {CONVERSATION_MAX_USER_CHARS} karakter
              </p>
            </section>
          )}
        </div>

        <section className="neo-surface flex flex-col p-4 sm:p-6" aria-label="Riwayat latihan">
          <h2 className="text-sm font-black tracking-wider uppercase">Riwayat</h2>
          {/* Riwayat bergulir di dalam kotaknya sendiri, jadi mengirim giliran
              baru tidak menggeser halaman maupun karakter. */}
          <div
            ref={historyRef}
            className="mt-3 max-h-[22rem] space-y-3 overflow-y-auto pr-1 lg:max-h-[calc(100dvh-16rem)]"
          >
            {items.map((item) => {
              if (item.kind === "error") {
                return (
                  <div
                    key={item.id}
                    role="alert"
                    className="flex items-start gap-3 rounded-lg border-[3px] border-neo-ink bg-neo-coral p-3 text-sm text-white"
                  >
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <div>
                      <p className="font-black">{item.message}</p>
                      {item.reason !== "quota_exceeded" && item.reason !== "disabled" && (
                        <button
                          type="button"
                          onClick={() => retry(item.id)}
                          disabled={isPending}
                          className="mt-2 min-h-9 rounded-md border-2 border-white px-3 text-xs font-bold disabled:opacity-50"
                        >
                          Coba lagi
                        </button>
                      )}
                    </div>
                  </div>
                );
              }

              const isUser = item.role === "USER";
              return (
                <div
                  key={item.id}
                  className={cn(
                    "rounded-lg border-[3px] border-neo-ink p-3",
                    isUser ? "bg-neo-yellow" : "bg-white",
                  )}
                >
                  <p className="text-xs font-black tracking-wider uppercase text-foreground/55">
                    {isUser ? "Kamu" : (persona?.name ?? "Partner")}
                  </p>
                  <p
                    lang="ja"
                    className={cn(
                      "font-japanese mt-1 leading-relaxed font-bold",
                      !showFurigana && "[&_rt]:hidden",
                    )}
                  >
                    <JapaneseText text={item.contentJa} />
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

function LevelMeter({ level, active }: { level: number; active: boolean }) {
  const bars = 9;

  return (
    <div className="flex h-16 items-end gap-1" aria-hidden="true">
      {Array.from({ length: bars }, (_, index) => {
        // Batang tengah paling responsif supaya bentuknya terbaca sebagai
        // level suara, bukan animasi hias.
        const distance = Math.abs(index - (bars - 1) / 2) / ((bars - 1) / 2);
        const scale = active ? Math.max(0.12, level * (1 - distance * 0.55)) : 0.12;

        return (
          <span
            key={index}
            className="w-2 rounded-sm border-2 border-neo-ink bg-neo-blue transition-[height] duration-75"
            style={{ height: `${Math.round(scale * 100)}%` }}
          />
        );
      })}
    </div>
  );
}

function TogglePill({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "flex min-h-11 items-center gap-2 rounded-lg border-[3px] border-neo-ink px-3 text-sm font-bold shadow-neo-sm",
        active ? "bg-neo-green" : "bg-white",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
