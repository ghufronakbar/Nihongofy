"use client";

import { useMemo, useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import type { JlptLevel, JlptSection, MondaiType } from "@prisma/client";
import {
  AudioLines,
  BookOpenText,
  BrainCircuit,
  Check,
  Headphones,
  Languages,
  PenLine,
  Play,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  JLPT_SECTION_LABELS,
  MONDAI_TYPE_TRANSLATIONS,
  mondaiTypeFullLabel,
} from "@/constants/jlpt";
import { createPracticeSessionAction, type PracticeCatalogEntry } from "../actions";
import {
  PRACTICE_LEVELS,
  PRACTICE_SECTIONS,
  PracticeConfigurationSchema,
  type PracticeConfigurationInput,
} from "../schemas";

const LEVEL_DESCRIPTIONS: Record<JlptLevel, string> = {
  N5: "Fondasi",
  N4: "Dasar",
  N3: "Menengah",
  N2: "Mahir",
  N1: "Lanjutan",
};

const LEVEL_COLORS: Record<JlptLevel, string> = {
  N5: "bg-neo-green",
  N4: "bg-neo-blue",
  N3: "bg-neo-yellow",
  N2: "bg-neo-coral",
  N1: "bg-[#b694ff]",
};

const SECTION_DETAILS: Record<
  JlptSection,
  { label: string; description: string; icon: typeof Languages; color: string }
> = {
  MOJI_GOI: {
    label: "Kosakata dan kanji",
    description: "Bacaan, penulisan, konteks, dan penggunaan kata.",
    icon: Languages,
    color: "bg-neo-coral",
  },
  BUNPOU: {
    label: "Tata bahasa",
    description: "Bentuk grammar, susun kalimat, dan grammar wacana.",
    icon: PenLine,
    color: "bg-neo-yellow",
  },
  DOKKAI: {
    label: "Membaca",
    description: "Teks pendek sampai pencarian informasi.",
    icon: BookOpenText,
    color: "bg-neo-blue",
  },
  CHOUKAI: {
    label: "Mendengarkan",
    description: "Latihan audio dengan player dari bank soal.",
    icon: Headphones,
    color: "bg-neo-green",
  },
};

function questionCountOptions(available: number): number[] {
  if (available <= 0) return [];
  if (available < 5) return [available];
  return [5, 10, 15, 20].filter((count) => count <= available);
}

export function PracticeConfigurator({ catalog }: { catalog: PracticeCatalogEntry[] }) {
  const firstEntry = catalog[0];
  const initialCount = firstEntry
    ? (questionCountOptions(firstEntry.questionCount)[0] ?? 1)
    : 1;
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const form = useForm<PracticeConfigurationInput>({
    resolver: zodResolver(PracticeConfigurationSchema),
    defaultValues: firstEntry
      ? {
          jlptLevel: firstEntry.jlptLevel,
          section: firstEntry.section,
          mondaiType: firstEntry.mondaiType,
          questionCount: initialCount,
        }
      : undefined,
  });

  const [selectedLevel, selectedSection, selectedMondai, selectedCount] = useWatch({
    control: form.control,
    name: ["jlptLevel", "section", "mondaiType", "questionCount"],
  });

  const levelEntries = useMemo(
    () => catalog.filter((entry) => entry.jlptLevel === selectedLevel),
    [catalog, selectedLevel],
  );
  const sectionEntries = useMemo(
    () => levelEntries.filter((entry) => entry.section === selectedSection),
    [levelEntries, selectedSection],
  );
  const selectedEntry = sectionEntries.find((entry) => entry.mondaiType === selectedMondai);
  const countOptions = questionCountOptions(selectedEntry?.questionCount ?? 0);

  function applyEntry(entry: PracticeCatalogEntry, preferredCount = selectedCount) {
    const counts = questionCountOptions(entry.questionCount);
    form.setValue("jlptLevel", entry.jlptLevel, { shouldValidate: true });
    form.setValue("section", entry.section, { shouldValidate: true });
    form.setValue("mondaiType", entry.mondaiType, { shouldValidate: true });
    form.setValue(
      "questionCount",
      counts.includes(preferredCount) ? preferredCount : (counts[0] ?? 1),
      { shouldValidate: true },
    );
    setServerError(null);
  }

  function chooseLevel(level: JlptLevel) {
    const entries = catalog.filter((entry) => entry.jlptLevel === level);
    if (entries.length === 0) return;
    const sameSection = entries.find((entry) => entry.section === selectedSection);
    applyEntry(sameSection ?? entries[0]);
  }

  function chooseSection(section: JlptSection) {
    const entry = levelEntries.find((candidate) => candidate.section === section);
    if (entry) applyEntry(entry);
  }

  function chooseMondai(mondaiType: MondaiType) {
    const entry = sectionEntries.find((candidate) => candidate.mondaiType === mondaiType);
    if (entry) applyEntry(entry);
  }

  const submit = form.handleSubmit((values) => {
    setServerError(null);
    startTransition(async () => {
      const result = await createPracticeSessionAction(values);
      if (result?.ok === false) setServerError(result.message);
    });
  });

  return (
    <form onSubmit={submit} className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_21rem]">
      <div className="space-y-8">
        <fieldset className="space-y-4">
          <legend className="flex items-center gap-3 text-2xl font-black">
            <span className="flex size-10 items-center justify-center border-[3px] border-neo-ink bg-neo-yellow shadow-neo-sm">
              <BrainCircuit className="size-5" />
            </span>
            Pilih level
          </legend>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {PRACTICE_LEVELS.map((level) => {
              const isAvailable = catalog.some((entry) => entry.jlptLevel === level);
              const isSelected = selectedLevel === level;
              return (
                <button
                  key={level}
                  type="button"
                  disabled={!isAvailable || isPending}
                  aria-pressed={isSelected}
                  onClick={() => chooseLevel(level)}
                  className={cn(
                    "relative min-h-24 border-[3px] border-neo-ink p-3 text-left shadow-neo-sm transition-[transform,box-shadow,opacity]",
                    LEVEL_COLORS[level],
                    isSelected && "-translate-x-1 -translate-y-1 shadow-neo-lg",
                    !isAvailable && "cursor-not-allowed bg-slate-200 opacity-55 shadow-none",
                  )}
                >
                  {isSelected && <Check className="absolute top-2 right-2 size-5" aria-hidden="true" />}
                  <span className="block text-3xl font-black">{level}</span>
                  <span className="text-xs font-bold">{isAvailable ? LEVEL_DESCRIPTIONS[level] : "Segera"}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-2xl font-black">Fokus seksi</legend>
          <div className="grid gap-4 md:grid-cols-2">
            {PRACTICE_SECTIONS.map((section) => {
              const detail = SECTION_DETAILS[section];
              const Icon = detail.icon;
              const isAvailable = levelEntries.some((entry) => entry.section === section);
              const isSelected = selectedSection === section;
              return (
                <button
                  key={section}
                  type="button"
                  disabled={!isAvailable || isPending}
                  aria-pressed={isSelected}
                  onClick={() => chooseSection(section)}
                  className={cn(
                    "neo-surface neo-interactive flex min-h-32 items-start gap-4 p-5 text-left",
                    isSelected && "-translate-x-0.5 -translate-y-0.5 bg-[#fff8cf] shadow-neo-lg",
                    !isAvailable && "cursor-not-allowed opacity-45 shadow-none hover:transform-none",
                  )}
                >
                  <span className={cn("flex size-12 shrink-0 items-center justify-center border-[3px] border-neo-ink", detail.color)}>
                    <Icon className="size-6" />
                  </span>
                  <span>
                    <span className="block text-lg font-black">{detail.label}</span>
                    <span className="mt-1 block text-sm text-muted-foreground">{detail.description}</span>
                    <span className="mt-2 block text-xs font-bold">{JLPT_SECTION_LABELS[section]}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-2xl font-black">Tipe mondai</legend>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sectionEntries.map((entry) => {
              const isSelected = selectedMondai === entry.mondaiType;
              return (
                <button
                  key={entry.mondaiType}
                  type="button"
                  disabled={isPending}
                  aria-pressed={isSelected}
                  onClick={() => chooseMondai(entry.mondaiType)}
                  className={cn(
                    "min-h-28 border-[3px] border-neo-ink bg-card p-4 text-left shadow-neo-sm transition-[transform,box-shadow,background-color]",
                    isSelected && "-translate-x-1 -translate-y-1 bg-neo-blue shadow-neo-lg",
                  )}
                >
                  <span className="block font-japanese text-base font-black">
                    {mondaiTypeFullLabel(entry.mondaiType)}
                  </span>
                  <span className="mt-3 block text-xs font-bold">{entry.questionCount} soal tersedia</span>
                </button>
              );
            })}
          </div>
        </fieldset>
      </div>

      <aside className="xl:sticky xl:top-4 xl:self-start">
        <div className="neo-surface overflow-hidden">
          <div className="border-b-[3px] border-neo-ink bg-neo-yellow p-5">
            <p className="font-mono text-xs font-black tracking-[0.12em] uppercase">Sesi latihanmu</p>
            <h2 className="mt-2 text-3xl font-black">Siap untuk fokus.</h2>
          </div>

          <div className="space-y-5 p-5">
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <span className="font-bold text-muted-foreground">Level</span>
              <span className="font-black">{selectedLevel}</span>
              <span className="font-bold text-muted-foreground">Seksi</span>
              <span className="font-black">{selectedSection ? SECTION_DETAILS[selectedSection].label : "-"}</span>
              <span className="font-bold text-muted-foreground">Mondai</span>
              <span className="font-black">
                {selectedMondai ? MONDAI_TYPE_TRANSLATIONS[selectedMondai] : "-"}
              </span>
            </div>

            <fieldset className="space-y-3">
              <legend className="font-black">Panjang sesi</legend>
              <div className="grid grid-cols-2 gap-2">
                {countOptions.map((count) => (
                  <button
                    key={count}
                    type="button"
                    disabled={isPending}
                    aria-pressed={selectedCount === count}
                    onClick={() => form.setValue("questionCount", count, { shouldValidate: true })}
                    className={cn(
                      "min-h-12 border-[3px] border-neo-ink bg-white px-3 font-black text-black shadow-neo-sm transition-[transform,box-shadow]",
                      selectedCount === count && "translate-x-1 translate-y-1 bg-neo-green shadow-none",
                    )}
                  >
                    {count} soal
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="flex items-start gap-3 border-[3px] border-neo-ink bg-[#e9f2ff] p-3 text-sm text-black">
              {selectedSection === "CHOUKAI" ? (
                <AudioLines className="mt-0.5 size-5 shrink-0" />
              ) : (
                <Check className="mt-0.5 size-5 shrink-0" />
              )}
              <p>
                Jawaban dikunci sekali. Feedback dan penjelasan muncul setelah tiap submit.
              </p>
            </div>

            {(serverError || form.formState.errors.root) && (
              <p role="alert" className="border-[3px] border-neo-ink bg-neo-coral p-3 text-sm font-bold text-black">
                {serverError ?? form.formState.errors.root?.message}
              </p>
            )}

            <button type="submit" disabled={isPending || !selectedEntry} className="neo-button w-full bg-neo-blue text-base">
              <Play className="size-5 fill-current" />
              {isPending ? "Menyiapkan sesi..." : "Mulai latihan"}
            </button>
          </div>
        </div>
      </aside>
    </form>
  );
}
