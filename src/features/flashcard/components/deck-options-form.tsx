"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch, type UseFormRegister } from "react-hook-form";
import { toast } from "sonner";
import { Loader2, RotateCcw, Save } from "lucide-react";
import { FLASHCARD_DEFAULT_PRESET_CONFIG, type FlashcardPresetConfig } from "../schemas";
import {
  FSRS_DEFAULT_PARAMETERS_TEXT,
  PresetFormSchema,
  configToForm,
  formToConfig,
  type PresetFormOutput,
  type PresetFormValues,
} from "../preset-form";
import { assignPresetAction, createPresetAction, savePresetAction } from "../preset-actions";

type PresetOption = { id: number; name: string; deckCount: number };

type Props = {
  deckId: number;
  deckName: string;
  hasSubdecks: boolean;
  preset: { id: number; name: string; config: FlashcardPresetConfig; deckCount: number };
  presets: PresetOption[];
};

// --- Bagian ------------------------------------------------------------------

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="neo-surface p-5">
      <h2 className="text-lg font-black">{title}</h2>
      {note ? (
        <p className="mt-1 text-sm font-semibold text-muted-foreground">{note}</p>
      ) : null}
      <div className="mt-4 grid gap-4">{children}</div>
    </section>
  );
}

function Row({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-4">
      <div>
        <span className="block font-extrabold">{label}</span>
        {hint ? (
          <span className="block text-xs font-semibold text-muted-foreground">{hint}</span>
        ) : null}
        {error ? (
          <span className="block text-xs font-bold text-neo-coral">{error}</span>
        ) : null}
      </div>
      <div className="sm:justify-self-end">{children}</div>
    </div>
  );
}

function Toggle({
  label,
  hint,
  ...props
}: { label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-black" {...props} />
      <span>
        <span className="block font-extrabold">{label}</span>
        {hint ? (
          <span className="block text-xs font-semibold text-muted-foreground">{hint}</span>
        ) : null}
      </span>
    </label>
  );
}

const numberInput =
  "h-11 w-28 rounded-lg border-[3px] border-neo-ink bg-white px-3 text-right font-bold text-black shadow-neo-sm outline-none";
const textInput =
  "h-11 w-full rounded-lg border-[3px] border-neo-ink bg-white px-3 font-bold text-black shadow-neo-sm outline-none sm:w-64";
const selectInput =
  "h-11 rounded-lg border-[3px] border-neo-ink bg-white px-3 font-bold text-black shadow-neo-sm outline-none sm:w-64";

type Register = UseFormRegister<PresetFormValues>;

function Select<T extends string>({
  name,
  register,
  options,
}: {
  name: keyof PresetFormValues;
  register: Register;
  options: { value: T; label: string }[];
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

// --- Form --------------------------------------------------------------------

export function DeckOptionsForm({ deckId, deckName, hasSubdecks, preset, presets }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [applyToSubdecks, setApplyToSubdecks] = useState(false);

  const defaults = useMemo(
    () => configToForm(preset.name, preset.config),
    [preset.config, preset.name],
  );

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<PresetFormValues, unknown, PresetFormOutput>({
    resolver: zodResolver(PresetFormSchema),
    defaultValues: defaults,
  });

  // `useWatch` dipakai, bukan `watch()`: yang terakhir mengembalikan fungsi baru
  // tiap render sehingga React Compiler menolak memoisasinya.
  const fsrsEnabled = useWatch({ control, name: "fsrsEnabled" });
  const errorOf = (key: keyof PresetFormValues) => errors[key]?.message;

  function onSubmit(values: PresetFormOutput) {
    startTransition(async () => {
      const result = await savePresetAction({
        presetId: preset.id,
        name: values.name,
        config: formToConfig(values),
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      if (applyToSubdecks) {
        const assigned = await assignPresetAction({
          deckId,
          presetId: preset.id,
          includeSubdecks: true,
        });
        if (!assigned.ok) toast.error(assigned.message);
      }

      toast.success(
        result.data.rescheduledCards > 0
          ? `Tersimpan. ${result.data.rescheduledCards} kartu dijadwalkan ulang.`
          : "Pengaturan tersimpan.",
      );
      router.refresh();
    });
  }

  function switchPreset(presetId: number) {
    startTransition(async () => {
      const result = await assignPresetAction({ deckId, presetId });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      router.refresh();
    });
  }

  function addPreset() {
    const name = window.prompt("Nama preset baru:");
    if (!name?.trim()) return;

    startTransition(async () => {
      const created = await createPresetAction({
        name: name.trim(),
        copyFromPresetId: preset.id,
      });
      if (!created.ok) {
        toast.error(created.message);
        return;
      }
      const assigned = await assignPresetAction({
        deckId,
        presetId: created.data.presetId,
      });
      if (!assigned.ok) {
        toast.error(assigned.message);
        return;
      }
      toast.success("Preset dibuat dan dipakai deck ini.");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-5">
      <fieldset disabled={isPending} className="contents">
        <Section
          title="Preset"
          note={
            preset.deckCount > 1
              ? `Preset ini dipakai ${preset.deckCount} deck. Perubahan di sini berlaku untuk semuanya.`
              : "Preset dipakai bersama beberapa deck, seperti di Anki."
          }
        >
          <Row label="Preset untuk deck ini">
            <select
              className={selectInput}
              value={preset.id}
              onChange={(event) => switchPreset(Number(event.target.value))}
            >
              {presets.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name} ({option.deckCount} deck)
                </option>
              ))}
            </select>
          </Row>

          <Row label="Nama preset" error={errorOf("name")}>
            <input className={textInput} {...register("name")} />
          </Row>

          <button type="button" onClick={addPreset} className="neo-button justify-self-start bg-white text-xs">
            Buat preset baru dari ini
          </button>

          {hasSubdecks ? (
            <Toggle
              label="Terapkan preset ini ke semua subdeck saat menyimpan"
              hint={`Subdeck di bawah "${deckName}" akan ikut memakai preset ini.`}
              checked={applyToSubdecks}
              onChange={(event) => setApplyToSubdecks(event.target.checked)}
            />
          ) : null}
        </Section>

        <Section title="Batas harian">
          <Row label="Kartu baru per hari" error={errorOf("newCardsPerDay")}>
            <input type="number" className={numberInput} {...register("newCardsPerDay")} />
          </Row>
          <Row label="Maksimum review per hari" error={errorOf("maxReviewsPerDay")}>
            <input type="number" className={numberInput} {...register("maxReviewsPerDay")} />
          </Row>
          <Toggle
            label="Kartu baru mengabaikan batas review"
            hint="Secara default kartu baru ikut memakan jatah review, sehingga tumpukan review menahan masuknya kartu baru."
            {...register("newCardsIgnoreReviewLimit")}
          />
          <Toggle
            label="Batas dihitung dari deck teratas"
            hint="Saat aktif, limit deck induk ikut berlaku walau kamu memilih subdeck."
            {...register("limitsStartFromTop")}
          />
        </Section>

        <Section title="Kartu baru">
          <Row
            label="Learning steps"
            hint="Dipisah spasi, mis. 1m 10m. Hanya menit/jam bulat, harus kurang dari 1 hari."
            error={errorOf("learningSteps")}
          >
            <input className={textInput} {...register("learningSteps")} />
          </Row>
          <Row label="Graduating interval (hari)" error={errorOf("graduatingIntervalDays")}>
            <input type="number" className={numberInput} {...register("graduatingIntervalDays")} />
          </Row>
          <Row label="Easy interval (hari)" error={errorOf("easyIntervalDays")}>
            <input type="number" className={numberInput} {...register("easyIntervalDays")} />
          </Row>
          <Row label="Urutan penambahan">
            <Select
              name="insertionOrder"
              register={register}
              options={[
                { value: "sequential", label: "Berurutan" },
                { value: "random", label: "Acak" },
              ]}
            />
          </Row>
        </Section>

        <Section title="Lapse">
          <Row label="Relearning steps" error={errorOf("relearningSteps")}>
            <input className={textInput} {...register("relearningSteps")} />
          </Row>
          <Row label="Interval minimum (hari)" error={errorOf("minimumIntervalDays")}>
            <input type="number" className={numberInput} {...register("minimumIntervalDays")} />
          </Row>
          <Row
            label="Ambang leech"
            hint="Jumlah lapse sebelum kartu ditandai leech. 0 mematikan fitur ini."
            error={errorOf("leechThreshold")}
          >
            <input type="number" className={numberInput} {...register("leechThreshold")} />
          </Row>
          <Row label="Tindakan leech">
            <Select
              name="leechAction"
              register={register}
              options={[
                { value: "tagOnly", label: "Beri tag saja" },
                { value: "suspend", label: "Suspend kartu" },
              ]}
            />
          </Row>
        </Section>

        <Section
          title="Burying"
          note="Menyembunyikan kartu bersaudara dari note yang sama sampai hari berikutnya."
        >
          <Toggle label="Bury sibling kartu baru" {...register("buryNewSiblings")} />
          <Toggle label="Bury sibling kartu review" {...register("buryReviewSiblings")} />
          <Toggle
            label="Bury sibling learning antar-hari"
            {...register("buryInterdayLearningSiblings")}
          />
        </Section>

        <Section
          title="FSRS"
          note="FSRS-6 menggantikan SM-2. Saat aktif, pengaturan di bagian Lanjutan tidak dipakai."
        >
          <Toggle label="Aktifkan FSRS" {...register("fsrsEnabled")} />
          <Row
            label="Desired retention (%)"
            hint="Setting terpenting FSRS. Makin tinggi, makin pendek intervalnya dan makin banyak review."
            error={errorOf("desiredRetentionPercent")}
          >
            <input type="number" className={numberInput} {...register("desiredRetentionPercent")} />
          </Row>
          <Row
            label="Parameter FSRS"
            hint="21 angka. Belum ada optimizer di sini — pakai default, atau paste hasil optimasi dari Anki-mu."
            error={errorOf("fsrsParameters")}
          >
            <textarea
              rows={3}
              className="w-full rounded-lg border-[3px] border-neo-ink bg-white p-3 font-mono text-xs text-black shadow-neo-sm outline-none sm:w-64"
              {...register("fsrsParameters")}
            />
          </Row>
          <Toggle
            label="Jadwalkan ulang kartu saat pengaturan berubah"
            hint="Menghitung ulang interval kartu review dari memory state yang tersimpan."
            {...register("rescheduleCardsOnChange")}
          />
          <Row label="Historical retention (%)" error={errorOf("historicalRetentionPercent")}>
            <input type="number" className={numberInput} {...register("historicalRetentionPercent")} />
          </Row>
        </Section>

        <Section title="Urutan tampil">
          <Row label="Pengambilan kartu baru">
            <Select
              name="newCardGatherOrder"
              register={register}
              options={[
                { value: "deck", label: "Per deck" },
                { value: "deckThenRandomNotes", label: "Per deck, note acak" },
                { value: "ascendingPosition", label: "Posisi menaik" },
                { value: "descendingPosition", label: "Posisi menurun" },
                { value: "randomNotes", label: "Note acak" },
                { value: "randomCards", label: "Kartu acak" },
              ]}
            />
          </Row>
          <Row label="Urutan kartu baru">
            <Select
              name="newCardSortOrder"
              register={register}
              options={[
                { value: "templateThenGather", label: "Tipe kartu, lalu urutan ambil" },
                { value: "gather", label: "Urutan ambil" },
                { value: "cardTemplateThenRandom", label: "Tipe kartu, lalu acak" },
                { value: "randomNoteThenTemplate", label: "Note acak, lalu tipe kartu" },
                { value: "random", label: "Acak" },
              ]}
            />
          </Row>
          <Row label="Kartu baru vs review">
            <Select
              name="newReviewOrder"
              register={register}
              options={[
                { value: "mix", label: "Dicampur" },
                { value: "afterReviews", label: "Setelah review" },
                { value: "beforeReviews", label: "Sebelum review" },
              ]}
            />
          </Row>
          <Row label="Learning antar-hari vs review">
            <Select
              name="interdayLearningReviewOrder"
              register={register}
              options={[
                { value: "mix", label: "Dicampur" },
                { value: "afterReviews", label: "Setelah review" },
                { value: "beforeReviews", label: "Sebelum review" },
              ]}
            />
          </Row>
          <Row label="Urutan review">
            <Select
              name="reviewSortOrder"
              register={register}
              options={[
                { value: "dueDateThenRandom", label: "Tanggal due, lalu acak" },
                { value: "dueDateThenDeck", label: "Tanggal due, lalu deck" },
                { value: "deckThenDueDate", label: "Deck, lalu tanggal due" },
                { value: "ascendingIntervals", label: "Interval terpendek dulu" },
                { value: "descendingIntervals", label: "Interval terpanjang dulu" },
                { value: "ascendingEase", label: "Ease terendah dulu" },
                { value: "descendingEase", label: "Ease tertinggi dulu" },
                { value: "relativeOverdueness", label: "Paling mungkin terlupa dulu" },
              ]}
            />
          </Row>
        </Section>

        <Section title="Timer">
          <Row label="Maksimum detik per jawaban" error={errorOf("maximumAnswerSeconds")}>
            <input type="number" className={numberInput} {...register("maximumAnswerSeconds")} />
          </Row>
          <Toggle label="Tampilkan timer di layar" {...register("showOnScreenTimer")} />
          <Toggle label="Hentikan timer saat jawaban dibuka" {...register("stopTimerOnAnswer")} />
        </Section>

        <Section title="Auto advance" note="Isi 0 untuk mematikan.">
          <Row label="Detik menampilkan soal" error={errorOf("secondsToShowQuestion")}>
            <input type="number" step="0.1" className={numberInput} {...register("secondsToShowQuestion")} />
          </Row>
          <Row label="Detik menampilkan jawaban" error={errorOf("secondsToShowAnswer")}>
            <input type="number" step="0.1" className={numberInput} {...register("secondsToShowAnswer")} />
          </Row>
          <Row label="Tindakan otomatis">
            <Select
              name="answerAction"
              register={register}
              options={[
                { value: "buryCard", label: "Bury kartu" },
                { value: "answerAgain", label: "Jawab Again" },
                { value: "answerGood", label: "Jawab Good" },
                { value: "answerHard", label: "Jawab Hard" },
                { value: "showReminder", label: "Tampilkan pengingat" },
              ]}
            />
          </Row>
        </Section>

        <Section title="Audio">
          <Toggle label="Jangan putar audio otomatis" {...register("disableAutoPlayAudio")} />
          <Toggle
            label="Lewati soal saat memutar ulang jawaban"
            {...register("skipQuestionWhenReplayingAnswer")}
          />
        </Section>

        <Section
          title="Lanjutan"
          note={
            fsrsEnabled
              ? "FSRS sedang aktif, jadi pengaturan di bawah ini tidak dipakai kecuali maximum interval."
              : "Dipakai oleh scheduler SM-2."
          }
        >
          <Row label="Maximum interval (hari)" error={errorOf("maximumIntervalDays")}>
            <input type="number" className={numberInput} {...register("maximumIntervalDays")} />
          </Row>
          <Row label="Starting ease" error={errorOf("startingEase")}>
            <input type="number" step="0.01" className={numberInput} {...register("startingEase")} />
          </Row>
          <Row label="Easy bonus" error={errorOf("easyBonus")}>
            <input type="number" step="0.01" className={numberInput} {...register("easyBonus")} />
          </Row>
          <Row label="Interval modifier" error={errorOf("intervalModifier")}>
            <input type="number" step="0.01" className={numberInput} {...register("intervalModifier")} />
          </Row>
          <Row label="Hard interval" error={errorOf("hardInterval")}>
            <input type="number" step="0.01" className={numberInput} {...register("hardInterval")} />
          </Row>
          <Row label="New interval" error={errorOf("newInterval")}>
            <input type="number" step="0.01" className={numberInput} {...register("newInterval")} />
          </Row>
        </Section>

        <div className="sticky bottom-4 flex flex-wrap gap-3">
          <button type="submit" className="neo-button bg-neo-yellow">
            {isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Save className="size-4" aria-hidden />
            )}
            Simpan
          </button>
          <button
            type="button"
            onClick={() =>
              reset({
                ...configToForm(preset.name, FLASHCARD_DEFAULT_PRESET_CONFIG),
                fsrsParameters: FSRS_DEFAULT_PARAMETERS_TEXT,
              })
            }
            className="neo-button bg-white"
          >
            <RotateCcw className="size-4" aria-hidden /> Kembalikan default
          </button>
        </div>
      </fieldset>
    </form>
  );
}
