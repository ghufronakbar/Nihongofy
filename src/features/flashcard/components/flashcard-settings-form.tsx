"use client";

import { useMemo, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch, type UseFormRegister } from "react-hook-form";
import { toast } from "sonner";
import { Loader2, RotateCcw, Save } from "lucide-react";
import { JapaneseText } from "@/components/japanese-text";
import { cn } from "@/lib/utils";
import { saveFlashcardSettingsAction } from "../actions";
import { FLASHCARD_TEXT_SCALE, type FlashcardConfig, type FlashcardDisplay } from "../schemas";
import {
  INSERTION_ORDER_OPTIONS,
  INTERDAY_ORDER_OPTIONS,
  NEW_CARD_GATHER_OPTIONS,
  NEW_CARD_SORT_OPTIONS,
  NEW_REVIEW_ORDER_OPTIONS,
  REVIEW_SORT_OPTIONS,
  SETTINGS_FORM_DEFAULTS,
  SettingsFormSchema,
  formToSettings,
  settingsToForm,
  type SettingsFieldName,
  type SettingsFormOutput,
  type SettingsFormValues,
} from "../settings-form";

type Props = {
  config: FlashcardConfig;
  display: FlashcardDisplay;
};

const numberInput =
  "h-11 w-28 rounded-lg border-[3px] border-neo-ink bg-white px-3 text-right font-bold text-black shadow-neo-sm outline-none";
const textInput =
  "h-11 w-full rounded-lg border-[3px] border-neo-ink bg-white px-3 font-bold text-black shadow-neo-sm outline-none sm:w-64";
const selectInput =
  "h-11 w-full rounded-lg border-[3px] border-neo-ink bg-white px-3 font-bold text-black shadow-neo-sm outline-none sm:w-72";

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="neo-surface p-5">
      <h2 className="text-lg font-black">{title}</h2>
      {note ? <p className="mt-1 text-sm font-semibold text-muted-foreground">{note}</p> : null}
      <div className="mt-4 grid gap-5">{children}</div>
    </section>
  );
}

function Row({
  label,
  hint,
  error,
  reset,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  reset: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-4">
      <div>
        <span className="block font-extrabold">{label}</span>
        {hint ? <span className="block text-xs font-semibold text-muted-foreground">{hint}</span> : null}
        {error ? <span className="block text-xs font-bold text-neo-coral">{error}</span> : null}
      </div>
      <div className="flex items-center gap-2 sm:justify-self-end">
        {children}
        {reset}
      </div>
    </div>
  );
}

function Select({
  name,
  register,
  options,
}: {
  name: SettingsFieldName;
  register: UseFormRegister<SettingsFormValues>;
  options: { value: string; label: string }[];
}) {
  return (
    <select className={selectInput} {...register(name)}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function FlashcardSettingsForm({ config, display }: Props) {
  const [isPending, startTransition] = useTransition();
  const initial = useMemo(() => settingsToForm(config, display), [config, display]);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors, isDirty },
  } = useForm<SettingsFormValues, unknown, SettingsFormOutput>({
    resolver: zodResolver(SettingsFormSchema),
    defaultValues: initial,
  });

  // `useWatch`, bukan `watch()`: yang terakhir mengembalikan fungsi baru tiap
  // render sehingga React Compiler menolak memoisasinya.
  const values = useWatch({ control });
  const errorOf = (name: SettingsFieldName) => errors[name]?.message;

  /** Tombol ↺ seperti di Anki: hanya muncul bila nilai berbeda dari default. */
  const resetButton = (name: SettingsFieldName) => {
    const changed = String(values[name]) !== String(SETTINGS_FORM_DEFAULTS[name]);
    return (
      <button
        type="button"
        onClick={() =>
          setValue(name, SETTINGS_FORM_DEFAULTS[name], { shouldDirty: true, shouldValidate: true })
        }
        className={cn(
          "inline-flex size-8 shrink-0 items-center justify-center rounded-md border-2 border-neo-ink bg-white text-black",
          !changed && "invisible",
        )}
        aria-label="Kembalikan ke nilai bawaan"
        title={`Bawaan: ${String(SETTINGS_FORM_DEFAULTS[name])}`}
        tabIndex={changed ? 0 : -1}
      >
        <RotateCcw className="size-4" aria-hidden />
      </button>
    );
  };

  function onSubmit(output: SettingsFormOutput) {
    startTransition(async () => {
      const result = await saveFlashcardSettingsAction(formToSettings(output, config));
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      reset(output);
      toast.success("Pengaturan tersimpan.");
    });
  }

  const textScale = Number(values.textScale) || SETTINGS_FORM_DEFAULTS.textScale;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-5">
      <fieldset disabled={isPending} className="contents">
        <Section title="Tampilan kartu">
          <Row
            label="Ukuran teks"
            hint="Berlaku untuk seluruh isi kartu saat belajar."
            error={errorOf("textScale")}
            reset={resetButton("textScale")}
          >
            <input
              type="range"
              min={FLASHCARD_TEXT_SCALE.min}
              max={FLASHCARD_TEXT_SCALE.max}
              step={FLASHCARD_TEXT_SCALE.step}
              className="w-40 accent-black"
              aria-valuetext={`${textScale}%`}
              {...register("textScale")}
            />
            <output className="w-12 text-right font-black tabular-nums">{textScale}%</output>
          </Row>
          <Row
            label="Tampilkan furigana di sisi belakang"
            hint="Bila mati, furigana tersembunyi dan muncul saat diketuk (atau tekan F)."
            reset={resetButton("showFuriganaOnBack")}
          >
            <input type="checkbox" className="size-5 accent-black" {...register("showFuriganaOnBack")} />
          </Row>

          <div
            className={cn(
              "rounded-lg border-[3px] border-dashed border-neo-ink p-4 text-center",
              !values.showFuriganaOnBack && "[&_rt]:invisible",
            )}
            style={{ fontSize: `${textScale}%` }}
            aria-label="Pratinjau kartu"
          >
            <p lang="ja" className="font-japanese text-[2em] font-black">
              <JapaneseText text="{食事|しょくじ}" />
            </p>
            <p className="text-[1.1em] font-black">makan; makanan</p>
          </div>
        </Section>

        <Section title="Batas harian" note="Berlaku untuk semua deck sekaligus.">
          <Row
            label="Kartu baru per hari"
            error={errorOf("newCardsPerDay")}
            reset={resetButton("newCardsPerDay")}
          >
            <input type="number" inputMode="numeric" className={numberInput} {...register("newCardsPerDay")} />
          </Row>
          <Row
            label="Maksimum review per hari"
            error={errorOf("maxReviewsPerDay")}
            reset={resetButton("maxReviewsPerDay")}
          >
            <input type="number" inputMode="numeric" className={numberInput} {...register("maxReviewsPerDay")} />
          </Row>
        </Section>

        <Section title="Kartu baru">
          <Row
            label="Learning steps"
            hint="Dipisah spasi, mis. 1m 2h 3h. Menit (m) atau jam (h) bulat, kurang dari 1 hari."
            error={errorOf("learningSteps")}
            reset={resetButton("learningSteps")}
          >
            <input className={textInput} {...register("learningSteps")} />
          </Row>
          <Row
            label="Urutan penambahan"
            hint="Insertion order: posisi kartu baru di deck."
            reset={resetButton("insertionOrder")}
          >
            <Select name="insertionOrder" register={register} options={INSERTION_ORDER_OPTIONS} />
          </Row>
        </Section>

        <Section title="Lapse" note="Kartu review yang terlupa (dijawab Again).">
          <Row
            label="Relearning steps"
            hint="Dipisah spasi, mis. 1m 1h."
            error={errorOf("relearningSteps")}
            reset={resetButton("relearningSteps")}
          >
            <input className={textInput} {...register("relearningSteps")} />
          </Row>
        </Section>

        <Section title="Urutan tampil">
          <Row
            label="Pengambilan kartu baru"
            hint="New card gather order"
            reset={resetButton("newCardGatherOrder")}
          >
            <Select name="newCardGatherOrder" register={register} options={NEW_CARD_GATHER_OPTIONS} />
          </Row>
          <Row label="Urutan kartu baru" hint="New card sort order" reset={resetButton("newCardSortOrder")}>
            <Select name="newCardSortOrder" register={register} options={NEW_CARD_SORT_OPTIONS} />
          </Row>
          <Row label="Kartu baru vs review" hint="New/review order" reset={resetButton("newReviewOrder")}>
            <Select name="newReviewOrder" register={register} options={NEW_REVIEW_ORDER_OPTIONS} />
          </Row>
          <Row
            label="Learning antar-hari vs review"
            hint="Interday learning/review order"
            reset={resetButton("interdayLearningReviewOrder")}
          >
            <Select name="interdayLearningReviewOrder" register={register} options={INTERDAY_ORDER_OPTIONS} />
          </Row>
          <Row label="Urutan review" hint="Review sort order" reset={resetButton("reviewSortOrder")}>
            <Select name="reviewSortOrder" register={register} options={REVIEW_SORT_OPTIONS} />
          </Row>
        </Section>

        <Section title="FSRS" note="Algoritma penjadwalan modern Anki. Bila dimatikan, dipakai SM-2.">
          <Row label="Aktifkan FSRS" reset={resetButton("fsrsEnabled")}>
            <input type="checkbox" className="size-5 accent-black" {...register("fsrsEnabled")} />
          </Row>
          <Row
            label="Desired retention (%)"
            hint={
              values.fsrsEnabled
                ? "Peluang mengingat yang dituju. Makin tinggi, makin sering review."
                : "Tidak dipakai selama FSRS mati."
            }
            error={errorOf("desiredRetentionPercent")}
            reset={resetButton("desiredRetentionPercent")}
          >
            <input
              type="number"
              inputMode="numeric"
              className={cn(numberInput, !values.fsrsEnabled && "opacity-55")}
              {...register("desiredRetentionPercent")}
            />
          </Row>
        </Section>

        <div className="sticky bottom-4 flex flex-wrap gap-3">
          <button type="submit" className="neo-button bg-neo-yellow" disabled={!isDirty}>
            {isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Save className="size-4" aria-hidden />
            )}
            Simpan
          </button>
          <button
            type="button"
            onClick={() => reset(SETTINGS_FORM_DEFAULTS, { keepDefaultValues: true })}
            className="neo-button bg-white"
          >
            <RotateCcw className="size-4" aria-hidden /> Kembalikan semua ke bawaan
          </button>
        </div>
      </fieldset>
    </form>
  );
}
