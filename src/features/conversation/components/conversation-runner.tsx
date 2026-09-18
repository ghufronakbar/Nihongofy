"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Baseline,
  Languages,
  Loader2,
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
import { useLipSync } from "../lib/use-lip-sync";
import { MockControls } from "./mock-controls";
import { TurnFeedback } from "./turn-feedback";
import { PersonaAvatar } from "./persona-avatar";

const FAILURE_COPY: Record<string, string> = {
  timeout: "Partner tidak sempat menjawab pesan ini.",
  provider_error: "Layanan percakapan sedang bermasalah saat membalas pesan ini.",
  quota_exceeded: "Kuota percakapan hari ini sudah habis.",
  moderation_blocked: "Pesan ini tidak dapat diproses. Coba tulis ulang dengan kalimat lain.",
  unauthorized: "Sesi masuk sudah berakhir. Silakan masuk kembali.",
  disabled: "Fitur percakapan sedang tidak aktif.",
  invalid_input: "Pesan ini tidak dapat diproses. Periksa panjang dan isinya.",
};

export function ConversationRunner({ session }: { session: ConversationSessionView }) {
  const persona = findPersona(session.personaKey);

  // Giliran dari server jadi state awal. Bila consent penyimpanan mati, server
  // tidak menyimpan apa pun sehingga daftarnya kosong dan sapaan pembuka
  // diambil dari fixture persona.
  const [items, setItems] = useState<TimelineItem[]>(() =>
    session.turns.length > 0
      ? session.turns.map((turn) => ({
          kind: "turn" as const,
          id: `turn-${turn.id}`,
          turnId: turn.role === "USER" ? turn.id : null,
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
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [streamingJa, setStreamingJa] = useState("");
  const [mockFailure, setMockFailure] = useState<ConversationMockFailure>("none");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [lipSyncRate, setLipSyncRate] = useState(1);
  const lipSync = useLipSync(lipSyncRate);
  const [isPending, startTransition] = useTransition();
  const messagesRef = useRef<HTMLDivElement | null>(null);

  // Digulirkan di dalam kotak pesan, bukan lewat halaman — mengirim pesan tidak
  // boleh menggeser header maupun komposer dari pandangan.
  // Daftar suara terisi asinkron; dipanaskan sejak awal supaya ucapan pertama
  // tidak jatuh ke suara bawaan browser.
  useEffect(() => {
    primeVoices();
  }, []);

  useEffect(() => {
    const box = messagesRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [items.length, isPending]);

  const turnCount = countUserTurns(items);
  const limitReached = turnCount >= CONVERSATION_MAX_TURNS_PER_SESSION;

  // Preferensi tampilan disimpan di server supaya sesi dapat dilanjutkan di
  // perangkat lain persis seperti ditinggalkan. Kegagalannya tidak menghalangi
  // pemakaian: state lokal sudah berubah lebih dulu.
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

  function requestReply(base: TimelineItem[], message: string) {
    startTransition(async () => {
      setStreamingJa("");

      const result = await streamConversationReply(
        {
          sessionId: session.id,
          userMessage: message,
          inputSource: "TYPED",
          // Riwayat yang dikirim ke provider hanya berisi giliran nyata; item
          // kegagalan adalah state UI dan tidak boleh masuk ke konteks model.
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

      // Server mengembalikan id giliran pelajar yang tersimpan, sehingga tombol
      // koreksi langsung tersedia tanpa perlu memuat ulang halaman.
      const withTurnId = base.map((item, index) =>
        index === base.length - 1 && item.kind === "turn" && item.role === "USER"
          ? { ...item, turnId: result.userTurnId }
          : item,
      );

      setItems([
        ...withTurnId,
        {
          kind: "turn",
          id: createItemId(),
          role: "ASSISTANT",
          contentJa: result.contentJa,
          contentTranslation: result.contentTranslation,
          contentRomaji: result.contentRomaji,
        },
      ]);
    });
  }

  function send() {
    const message = draft.trim();
    if (!message || isPending || limitReached) return;

    setNotice(null);

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
    requestReply(optimistic, message);
  }

  // Mengulang giliran yang gagal: item kegagalan dibuang, lalu pesan user yang
  // sama dikirim ulang tanpa menduplikasi bubble-nya.
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
    requestReply(withoutError, precedingUserTurn.contentJa);
  }

  function speak(text: string) {
    if (!persona) return;

    setLipSyncRate(persona.voice.rate);

    const spoken = speakAsPersona(markupToPlainText(text), persona, {
      onStart: () => {
        setIsSpeaking(true);
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
    <div className="flex min-h-[calc(100dvh-14rem)] flex-col gap-4">
      <header className="neo-surface flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="flex items-center gap-3">
          <Link
            href="/conversation"
            aria-label="Kembali ke daftar percakapan"
            className="grid size-10 place-items-center rounded-lg border-[3px] border-neo-ink bg-white shadow-neo-sm"
          >
            <ArrowLeft className="size-5" aria-hidden="true" />
          </Link>
          {persona && (
            <PersonaAvatar
              persona={persona}
              size="sm"
              state={isSpeaking ? "talking" : isPending ? "thinking" : "idle"}
              mouth={lipSync.mouth}
            />
          )}
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

      <div
        ref={messagesRef}
        className="neo-surface flex-1 space-y-4 overflow-y-auto p-4 sm:p-6"
      >
        {items.map((item) => {
          if (item.kind === "error") {
            return (
              <div key={item.id} role="alert" className="flex justify-start">
                <div className="flex max-w-[85%] items-start gap-3 rounded-lg border-[3px] border-neo-ink bg-neo-coral p-4 text-white shadow-neo-sm sm:max-w-[70%]">
                  <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                  <div>
                    <p className="font-black">{item.message}</p>
                    {item.reason !== "quota_exceeded" && item.reason !== "disabled" && (
                      <button
                        type="button"
                        onClick={() => retry(item.id)}
                        disabled={isPending}
                        className="mt-3 flex min-h-9 items-center gap-2 rounded-md border-2 border-white px-3 text-xs font-bold disabled:opacity-50"
                      >
                        <RotateCcw className="size-4" aria-hidden="true" />
                        Coba lagi
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          }

          const isUser = item.role === "USER";
          return (
            <div key={item.id} className={cn("flex", isUser ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] rounded-lg border-[3px] border-neo-ink p-4 shadow-neo-sm sm:max-w-[70%]",
                  isUser ? "bg-neo-yellow" : "bg-white",
                )}
              >
                <p
                  lang="ja"
                  className={cn(
                    "font-japanese text-lg leading-relaxed font-bold",
                    !showFurigana && "[&_rt]:hidden",
                  )}
                >
                  <JapaneseText text={item.contentJa} />
                </p>

                {!isUser && showRomaji && item.contentRomaji && (
                  <p className="mt-2 text-sm font-semibold text-foreground/55">
                    {item.contentRomaji}
                  </p>
                )}
                {!isUser && showTranslation && item.contentTranslation && (
                  <p className="mt-1 text-sm font-semibold text-foreground/70">
                    {item.contentTranslation}
                  </p>
                )}

                {isUser && typeof item.turnId === "number" && (
                  <TurnFeedback turnId={item.turnId} />
                )}

                {!isUser && (
                  <button
                    type="button"
                    onClick={() => speak(item.contentJa)}
                    className="mt-3 flex min-h-9 items-center gap-2 rounded-md border-2 border-neo-ink bg-background px-3 text-xs font-bold"
                  >
                    <Volume2 className="size-4" aria-hidden="true" />
                    Dengarkan
                  </button>
                )}
              </div>
            </div>
          );
        })}

        <p aria-live="polite" className="sr-only">
          {isPending ? "Partner sedang menjawab" : ""}
        </p>

        {isPending && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-lg border-[3px] border-neo-ink bg-white p-4 shadow-neo-sm sm:max-w-[70%]">
              {streamingJa ? (
                <p
                  lang="ja"
                  className={cn(
                    "font-japanese text-lg leading-relaxed font-bold",
                    !showFurigana && "[&_rt]:hidden",
                  )}
                >
                  <JapaneseText text={streamingJa} />
                </p>
              ) : (
                <p className="flex items-center gap-2 font-bold">
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Sedang menjawab…
                </p>
              )}
            </div>
          </div>
        )}

      </div>

      {notice && (
        <p className="border-[3px] border-neo-ink bg-neo-yellow p-3 text-sm font-bold">{notice}</p>
      )}

      {limitReached ? (
        <p className="border-[3px] border-neo-ink bg-neo-yellow p-4 font-bold">
          Batas {CONVERSATION_MAX_TURNS_PER_SESSION} giliran per percakapan tercapai.{" "}
          <Link href="/conversation/setup" className="underline">
            Mulai percakapan baru
          </Link>
          .
        </p>
      ) : (
        <div className="neo-surface p-4">
          <label htmlFor="conversation-input" className="sr-only">
            Tulis pesan dalam bahasa Jepang atau Indonesia
          </label>
          <div className="flex items-end gap-3">
            <textarea
              id="conversation-input"
              value={draft}
              onChange={(event) => setDraft(event.target.value.slice(0, CONVERSATION_MAX_USER_CHARS))}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  send();
                }
              }}
              rows={2}
              placeholder="Tulis dalam bahasa Jepang atau Indonesia…"
              className="min-h-11 flex-1 resize-none rounded-lg border-[3px] border-neo-ink bg-white px-4 py-3 text-base text-black shadow-neo-sm outline-none placeholder:text-slate-500"
            />
            <button
              type="button"
              onClick={send}
              disabled={isPending || draft.trim().length === 0}
              className="neo-button h-12 px-5"
            >
              {isPending ? (
                <Loader2 className="size-5 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="size-5" aria-hidden="true" />
              )}
              <span className="sr-only sm:not-sr-only">Kirim</span>
            </button>
          </div>
          <p className="mt-2 text-xs font-bold text-foreground/55">
            Giliran {turnCount}/{CONVERSATION_MAX_TURNS_PER_SESSION} · {draft.length}/
            {CONVERSATION_MAX_USER_CHARS} karakter · Enter untuk kirim, Shift+Enter untuk baris baru
          </p>
        </div>
      )}
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
