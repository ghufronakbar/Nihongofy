"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowRight, Baseline, Languages, MessageSquareText, Type, User } from "lucide-react";
import { JapaneseText } from "@/components/japanese-text";
import { markupToPlainText } from "@/lib/japanese-plain-text";
import { cn } from "@/lib/utils";
import { CONVERSATION_PERSONAS } from "../data/personas";
import { CONVERSATION_TOPICS } from "../data/topics";
import { CONVERSATION_LEVELS, type ConversationLevel } from "../types";
import { ConversationSetupSchema, type ConversationMode } from "../schemas";
import { speakAsPersona } from "../lib/persona-voice";
import { startConversationSessionAction } from "../actions";
import { CharacterStatePreview } from "./character-state-preview";
import { GenderFilterBar, PersonaCard, type GenderFilter } from "./persona-picker";

const DEFAULT_TOPICS = ["self-introduction"];
const MAX_TOPICS = 3;

export function ConversationSetup({ mode = "TEXT" }: { mode?: ConversationMode }) {
  const isVoice = mode === "VOICE";
  const [isPending, startTransition] = useTransition();

  const [personaKey, setPersonaKey] = useState<string | null>(null);
  const [jlptLevel, setJlptLevel] = useState<ConversationLevel>("N5");
  const [genderFilter, setGenderFilter] = useState<GenderFilter>("all");
  const [topicKeys, setTopicKeys] = useState<string[]>(isVoice ? [] : DEFAULT_TOPICS);
  const [showTranslation, setShowTranslation] = useState(true);
  const [showRomaji, setShowRomaji] = useState(true);
  const [showFurigana, setShowFurigana] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [samplePlaying, setSamplePlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availablePersonas = useMemo(
    () =>
      CONVERSATION_PERSONAS.filter(
        (persona) =>
          persona.supportedLevels.includes(jlptLevel) &&
          (genderFilter === "all" || persona.gender === genderFilter),
      ),
    [jlptLevel, genderFilter],
  );

  const selectedPersona = availablePersonas.find((persona) => persona.key === personaKey) ?? null;

  function toggleTopic(key: string) {
    setTopicKeys((previous) => {
      if (previous.includes(key)) {
        return previous.length === 1 ? previous : previous.filter((topic) => topic !== key);
      }
      return previous.length >= MAX_TOPICS ? previous : [...previous, key];
    });
  }

  function playSample(personaOverride?: typeof selectedPersona) {
    const persona = personaOverride ?? selectedPersona;
    if (!persona) return;

    // Markup furigana dilepas dulu; kalau tidak, TTS ikut membaca kurung dan bar.
    const spoken = speakAsPersona(markupToPlainText(persona.greeting), persona, {
      onStart: () => setSamplePlaying(true),
      onEnd: () => setSamplePlaying(false),
    });

    if (!spoken.ok) setSamplePlaying(false);
    setNotice(spoken.ok ? null : spoken.message);
  }

  function start() {
    setError(null);

    const parsed = ConversationSetupSchema.safeParse({
      mode,
      personaKey,
      jlptLevel,
      topicKeys,
      showTranslation,
      showRomaji,
      showFurigana,
    });

    if (!parsed.success || !selectedPersona) {
      setError(
        isVoice
          ? "Pilih satu partner bicara sebelum memulai."
          : "Pilih satu partner bicara dan minimal satu topik sebelum memulai.",
      );
      return;
    }

    // Session dibuat di server, bukan di browser: konfigurasi yang menentukan
    // biaya provider tidak boleh dipegang client. Action mengarahkan sendiri ke
    // runner-nya bila berhasil.
    startTransition(async () => {
      const result = await startConversationSessionAction(parsed.data);
      if (result && !result.ok) setError(result.message);
    });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-8">
        <section>
          <h2 className="text-lg font-black">1. Pilih level</h2>
          <p className="mt-1 text-sm font-semibold text-foreground/65">
            Level menentukan batasan kosakata dan tata bahasa partner bicara.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {CONVERSATION_LEVELS.map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setJlptLevel(level)}
                aria-pressed={jlptLevel === level}
                className={cn(
                  "min-h-11 rounded-lg border-[3px] border-neo-ink px-5 font-black shadow-neo-sm transition-transform",
                  jlptLevel === level
                    ? "bg-neo-blue text-neo-ink"
                    : "bg-white text-neo-ink hover:-translate-y-0.5",
                )}
              >
                {level}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-black">2. Pilih partner bicara</h2>
          <p className="mt-1 text-sm font-semibold text-foreground/65">
            Setiap partner punya kepribadian dan gaya suara berbeda. Coba dengarkan contohnya
            sebelum memilih.
          </p>

          <div className="mt-4">
            <GenderFilterBar value={genderFilter} onChange={setGenderFilter} />
          </div>

          {availablePersonas.length === 0 ? (
            <p className="mt-4 rounded-lg border-[3px] border-dashed border-neo-ink/40 p-4 text-sm font-semibold text-foreground/60">
              Tidak ada partner yang cocok dengan level dan filter ini. Ubah salah satunya.
            </p>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {availablePersonas.map((persona) => (
                <PersonaCard
                  key={persona.key}
                  persona={persona}
                  selected={persona.key === personaKey}
                  onSelect={() => setPersonaKey(persona.key)}
                  onPlaySample={() => {
                    setPersonaKey(persona.key);
                    playSample(persona);
                  }}
                />
              ))}
            </div>
          )}
        </section>

        {!isVoice && (
          <section>
            <h2 className="text-lg font-black">3. Pilih topik</h2>
            <p className="mt-1 text-sm font-semibold text-foreground/65">
              Satu sampai {MAX_TOPICS} topik. Percakapan akan berputar di sekitar pilihan ini.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {CONVERSATION_TOPICS.map((topic) => {
                const selected = topicKeys.includes(topic.key);
                const disabled = !selected && topicKeys.length >= MAX_TOPICS;
                return (
                  <button
                    key={topic.key}
                    type="button"
                    onClick={() => toggleTopic(topic.key)}
                    aria-pressed={selected}
                    disabled={disabled}
                    className={cn(
                      "flex min-h-11 items-center gap-2 rounded-lg border-[3px] border-neo-ink px-4 text-sm font-bold shadow-neo-sm transition-transform",
                      selected ? "bg-neo-yellow text-neo-ink" : "bg-white text-neo-ink",
                      disabled ? "cursor-not-allowed opacity-45" : "hover:-translate-y-0.5",
                    )}
                  >
                    <span aria-hidden="true">{topic.icon}</span>
                    <span>{topic.label}</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </div>

      <aside className="lg:sticky lg:top-20 lg:self-start">
        <div className="neo-surface p-6">
          <h2 className="text-lg font-black">Ringkasan</h2>

          {selectedPersona ? (
            <div className="mt-4 space-y-4">
              <CharacterStatePreview
                persona={selectedPersona}
                onPlaySample={() => playSample()}
                showStates={isVoice}
                speaking={samplePlaying}
              />

              <div className="rounded-lg border-[3px] border-neo-ink bg-background p-4">
                <p className="text-xs font-bold tracking-wider text-foreground/60 uppercase">
                  Sapaan pembuka
                </p>
                <p
                  lang="ja"
                  className={cn(
                    "font-japanese mt-2 text-lg leading-relaxed font-bold",
                    !showFurigana && "[&_rt]:hidden",
                  )}
                >
                  <JapaneseText text={selectedPersona.greeting} />
                </p>
                {showRomaji && (
                  <p className="mt-2 text-sm font-semibold text-foreground/55">
                    {selectedPersona.greetingRomaji}
                  </p>
                )}
                {showTranslation && (
                  <p className="mt-1 text-sm font-semibold text-foreground/70">
                    {selectedPersona.greetingTranslation}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-lg border-[3px] border-dashed border-neo-ink/40 p-6 text-center">
              <User className="mx-auto size-10 opacity-40" aria-hidden="true" />
              <p className="mt-2 text-sm font-semibold text-foreground/60">
                Belum ada partner bicara yang dipilih.
              </p>
            </div>
          )}

          <div className="mt-6 space-y-3">
            <ToggleRow
              icon={<Baseline className="size-5" aria-hidden="true" />}
              label="Tampilkan furigana"
              checked={showFurigana}
              onChange={setShowFurigana}
            />
            <ToggleRow
              icon={<Type className="size-5" aria-hidden="true" />}
              label="Tampilkan romaji"
              checked={showRomaji}
              onChange={setShowRomaji}
            />
            <ToggleRow
              icon={<Languages className="size-5" aria-hidden="true" />}
              label="Tampilkan terjemahan"
              checked={showTranslation}
              onChange={setShowTranslation}
            />
          </div>

          {notice && (
            <p className="mt-4 border-[3px] border-neo-ink bg-neo-yellow p-3 text-sm font-bold">
              {notice}
            </p>
          )}

          {error && (
            <p
              role="alert"
              className="mt-4 border-[3px] border-neo-ink bg-neo-coral p-3 text-sm font-bold text-white"
            >
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={start}
            disabled={isPending}
            className="neo-button mt-6 w-full"
          >
            <MessageSquareText className="size-5" aria-hidden="true" />
            {isVoice ? "Mulai latihan bicara" : "Mulai percakapan"}
            <ArrowRight className="size-5" aria-hidden="true" />
          </button>
        </div>
      </aside>
    </div>
  );
}

function ToggleRow({
  icon,
  label,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border-[3px] border-neo-ink px-4 text-sm font-bold shadow-neo-sm transition-transform hover:-translate-y-0.5",
        checked ? "bg-neo-green text-neo-ink" : "bg-white text-neo-ink",
      )}
    >
      <span className="flex items-center gap-2">
        {icon}
        {label}
      </span>
      <span className="font-mono text-xs">{checked ? "AKTIF" : "MATI"}</span>
    </button>
  );
}
