"use client";

import { useMemo, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Loader2, RotateCcw, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { saveDeckSettingsAction } from "../actions";
import type { FlashcardConfig } from "../schemas";
import {
  DECK_CONFIG_FORM_DEFAULTS,
  DeckConfigFormSchema,
  INSERTION_ORDER_OPTIONS,
  INTERDAY_ORDER_OPTIONS,
  NEW_CARD_GATHER_OPTIONS,
  NEW_CARD_SORT_OPTIONS,
  NEW_REVIEW_ORDER_OPTIONS,
  REVIEW_SORT_OPTIONS,
  configToForm,
  formToConfig,
  type DeckConfigFieldName,
  type DeckConfigFormOutput,
  type DeckConfigFormValues,
} from "../settings-form";
import { numberInput, ResetButton, Row, Section, Select, textInput } from "./settings-fields";

type Props = {
  slug: string;
  config: FlashcardConfig;
  /** Dipanggil setelah tersimpan, mis. untuk kembali ke halaman deck. */
  onSaved?: () => void;
};

/** Pengaturan penjadwalan satu deck, mengikuti deck options Anki. */
export function DeckConfigForm({ slug, config, onSaved }: Props) {
  const [isPending, startTransition] = useTransition();
  const initial = useMemo(() => configToForm(config), [config]);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors, isDirty },
  } = useForm<DeckConfigFormValues, unknown, DeckConfigFormOutput>({
    resolver: zodResolver(DeckConfigFormSchema),
    defaultValues: initial,
  });

  // `useWatch`, bukan `watch()`: yang terakhir mengembalikan fungsi baru tiap
  // render sehingga React Compiler menolak memoisasinya.
  const values = useWatch({ control });
  const errorOf = (name: DeckConfigFieldName) => errors[name]?.message;

  const resetButton = (name: DeckConfigFieldName) => (
    <ResetButton
      changed={String(values[name]) !== String(DECK_CONFIG_FORM_DEFAULTS[name])}
      defaultLabel={String(DECK_CONFIG_FORM_DEFAULTS[name])}
      onReset={() =>
        setValue(name, DECK_CONFIG_FORM_DEFAULTS[name], { shouldDirty: true, shouldValidate: true })
      }
    />
  );

  function onSubmit(output: DeckConfigFormOutput) {
    startTransition(async () => {
      const result = await saveDeckSettingsAction({ slug, config: formToConfig(output, config) });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      reset(output);
      toast.success("Pengaturan deck tersimpan.");
      onSaved?.();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-5">
      <fieldset disabled={isPending} className="contents">
        <Section title="Batas harian" note="Hanya untuk deck ini.">
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
            <Select registration={register("insertionOrder")} options={INSERTION_ORDER_OPTIONS} />
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
            <Select registration={register("newCardGatherOrder")} options={NEW_CARD_GATHER_OPTIONS} />
          </Row>
          <Row label="Urutan kartu baru" hint="New card sort order" reset={resetButton("newCardSortOrder")}>
            <Select registration={register("newCardSortOrder")} options={NEW_CARD_SORT_OPTIONS} />
          </Row>
          <Row label="Kartu baru vs review" hint="New/review order" reset={resetButton("newReviewOrder")}>
            <Select registration={register("newReviewOrder")} options={NEW_REVIEW_ORDER_OPTIONS} />
          </Row>
          <Row
            label="Learning antar-hari vs review"
            hint="Interday learning/review order"
            reset={resetButton("interdayLearningReviewOrder")}
          >
            <Select
              registration={register("interdayLearningReviewOrder")}
              options={INTERDAY_ORDER_OPTIONS}
            />
          </Row>
          <Row label="Urutan review" hint="Review sort order" reset={resetButton("reviewSortOrder")}>
            <Select registration={register("reviewSortOrder")} options={REVIEW_SORT_OPTIONS} />
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
            onClick={() => reset(DECK_CONFIG_FORM_DEFAULTS, { keepDefaultValues: true })}
            className="neo-button bg-white"
          >
            <RotateCcw className="size-4" aria-hidden /> Kembalikan semua ke bawaan
          </button>
        </div>
      </fieldset>
    </form>
  );
}
