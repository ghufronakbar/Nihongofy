"use client";

import { useMemo, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Loader2, RotateCcw, Save } from "lucide-react";
import { JapaneseText } from "@/components/japanese-text";
import { cn } from "@/lib/utils";
import { saveFlashcardDisplayAction } from "../actions";
import { FLASHCARD_TEXT_SCALE, type FlashcardDisplay } from "../schemas";
import {
  DISPLAY_FORM_DEFAULTS,
  DisplayFormSchema,
  displayToForm,
  formToDisplay,
  type DisplayFieldName,
  type DisplayFormOutput,
  type DisplayFormValues,
} from "../settings-form";
import { ResetButton, Row, Section } from "./settings-fields";

type Props = {
  display: FlashcardDisplay;
};

/** Tampilan kartu: satu pengaturan untuk semua deck. */
export function FlashcardDisplayForm({ display }: Props) {
  const [isPending, startTransition] = useTransition();
  const initial = useMemo(() => displayToForm(display), [display]);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors, isDirty },
  } = useForm<DisplayFormValues, unknown, DisplayFormOutput>({
    resolver: zodResolver(DisplayFormSchema),
    defaultValues: initial,
  });

  // `useWatch`, bukan `watch()`: yang terakhir mengembalikan fungsi baru tiap
  // render sehingga React Compiler menolak memoisasinya.
  const values = useWatch({ control });

  const resetButton = (name: DisplayFieldName) => (
    <ResetButton
      changed={String(values[name]) !== String(DISPLAY_FORM_DEFAULTS[name])}
      defaultLabel={String(DISPLAY_FORM_DEFAULTS[name])}
      onReset={() =>
        setValue(name, DISPLAY_FORM_DEFAULTS[name], { shouldDirty: true, shouldValidate: true })
      }
    />
  );

  function onSubmit(output: DisplayFormOutput) {
    startTransition(async () => {
      const result = await saveFlashcardDisplayAction({ display: formToDisplay(output) });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      reset(output);
      toast.success("Pengaturan tersimpan.");
    });
  }

  const textScale = Number(values.textScale) || DISPLAY_FORM_DEFAULTS.textScale;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-5">
      <fieldset disabled={isPending} className="contents">
        <Section title="Tampilan kartu">
          <Row
            label="Ukuran teks"
            hint="Berlaku untuk seluruh isi kartu saat belajar."
            error={errors.textScale?.message}
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
            onClick={() => reset(DISPLAY_FORM_DEFAULTS, { keepDefaultValues: true })}
            className="neo-button bg-white"
          >
            <RotateCcw className="size-4" aria-hidden /> Kembalikan ke bawaan
          </button>
        </div>
      </fieldset>
    </form>
  );
}
