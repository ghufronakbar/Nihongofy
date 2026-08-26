"use client";

import { useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Brain,
  ChevronDown,
  Clock3,
  RotateCcw,
  Save,
  SlidersHorizontal,
  TriangleAlert,
} from "lucide-react";
import { useForm } from "react-hook-form";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  resetFlashcardSettingsAction,
  saveFlashcardSettingsAction,
} from "../settings-actions";
import {
  FlashcardSettingsSchema,
  type FlashcardSettingsInput,
} from "../settings-schemas";

function SettingsGroup({
  icon: Icon,
  title,
  description,
  accent,
  open = false,
  children,
}: {
  icon: typeof Clock3;
  title: string;
  description: string;
  accent: string;
  open?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details open={open} className="group neo-surface overflow-hidden bg-white">
      <summary className={`flex cursor-pointer list-none items-center gap-4 border-black p-5 marker:hidden group-open:border-b-[3px] ${accent}`}>
        <span className="grid size-11 shrink-0 place-items-center border-[3px] border-black bg-white shadow-neo-sm">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-black">{title}</span>
          <span className="mt-0.5 block text-sm font-medium text-black/65">{description}</span>
        </span>
        <ChevronDown className="size-5 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="grid gap-5 p-5 sm:p-6">{children}</div>
    </details>
  );
}

export function FlashcardSettingsForm({ initialValues }: { initialValues: FlashcardSettingsInput }) {
  const [isPending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<"save" | "reset" | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FlashcardSettingsInput>({
    resolver: zodResolver(FlashcardSettingsSchema),
    defaultValues: initialValues,
  });

  function onSubmit(values: FlashcardSettingsInput) {
    setNotice(null);
    setPendingAction("save");
    startTransition(async () => {
      const result = await saveFlashcardSettingsAction(values);
      setNotice(result);
      setPendingAction(null);
      if (result.ok) reset(result.values);
    });
  }

  function resetDefaults() {
    setNotice(null);
    setPendingAction("reset");
    startTransition(async () => {
      const result = await resetFlashcardSettingsAction();
      setNotice(result);
      setPendingAction(null);
      if (result.ok) reset(result.values);
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-5">
      <fieldset disabled={isPending} className="contents">
        <SettingsGroup
          icon={Clock3}
          title="Batas harian"
          description="Mengontrol ukuran antrean hari ini"
          accent="bg-neo-yellow"
          open
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="newCardsPerDay" className="font-extrabold">Kartu baru per hari</FieldLabel>
              <Input id="newCardsPerDay" type="number" min={0} max={100} className="neo-input" aria-invalid={Boolean(errors.newCardsPerDay)} {...register("newCardsPerDay", { valueAsNumber: true })} />
              <FieldDescription>0-100 kartu yang belum pernah dipelajari.</FieldDescription>
              <FieldError errors={[errors.newCardsPerDay]} className="font-semibold" />
            </Field>
            <Field>
              <FieldLabel htmlFor="maxReviewsPerDay" className="font-extrabold">Review per hari</FieldLabel>
              <Input id="maxReviewsPerDay" type="number" min={0} max={1000} className="neo-input" aria-invalid={Boolean(errors.maxReviewsPerDay)} {...register("maxReviewsPerDay", { valueAsNumber: true })} />
              <FieldDescription>0-1000 kartu jatuh tempo atau learning ulang.</FieldDescription>
              <FieldError errors={[errors.maxReviewsPerDay]} className="font-semibold" />
            </Field>
          </div>
        </SettingsGroup>

        <SettingsGroup
          icon={Brain}
          title="Kartu baru"
          description="Langkah learning sebelum masuk review"
          accent="bg-neo-blue"
        >
          <Field>
            <FieldLabel htmlFor="learningSteps" className="font-extrabold">Learning steps</FieldLabel>
            <Input id="learningSteps" placeholder="1m 10m" className="neo-input font-mono" aria-invalid={Boolean(errors.learningSteps)} {...register("learningSteps")} />
            <FieldDescription>1-4 langkah berurutan. Gunakan m, h, atau d: 1m 10m 1h.</FieldDescription>
            <FieldError errors={[errors.learningSteps]} className="font-semibold" />
          </Field>
          <div className="grid gap-5 sm:grid-cols-3">
            <Field>
              <FieldLabel htmlFor="graduatingIntervalDays" className="font-extrabold">Lulus (hari)</FieldLabel>
              <Input id="graduatingIntervalDays" type="number" min={1} max={36500} className="neo-input" aria-invalid={Boolean(errors.graduatingIntervalDays)} {...register("graduatingIntervalDays", { valueAsNumber: true })} />
              <FieldError errors={[errors.graduatingIntervalDays]} className="font-semibold" />
            </Field>
            <Field>
              <FieldLabel htmlFor="easyIntervalDays" className="font-extrabold">Easy (hari)</FieldLabel>
              <Input id="easyIntervalDays" type="number" min={1} max={36500} className="neo-input" aria-invalid={Boolean(errors.easyIntervalDays)} {...register("easyIntervalDays", { valueAsNumber: true })} />
              <FieldError errors={[errors.easyIntervalDays]} className="font-semibold" />
            </Field>
            <Field>
              <FieldLabel htmlFor="startingEasePercent" className="font-extrabold">Starting ease (%)</FieldLabel>
              <Input id="startingEasePercent" type="number" min={130} max={500} className="neo-input" aria-invalid={Boolean(errors.startingEasePercent)} {...register("startingEasePercent", { valueAsNumber: true })} />
              <FieldError errors={[errors.startingEasePercent]} className="font-semibold" />
            </Field>
          </div>
        </SettingsGroup>

        <SettingsGroup
          icon={TriangleAlert}
          title="Lapse dan relearning"
          description="Perilaku kartu ketika jawaban Again"
          accent="bg-neo-coral"
        >
          <Field>
            <FieldLabel htmlFor="relearningSteps" className="font-extrabold">Relearning steps</FieldLabel>
            <Input id="relearningSteps" placeholder="10m" className="neo-input font-mono" aria-invalid={Boolean(errors.relearningSteps)} {...register("relearningSteps")} />
            <FieldDescription>Dipakai setelah kartu review diberi rating Again.</FieldDescription>
            <FieldError errors={[errors.relearningSteps]} className="font-semibold" />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="lapseIntervalPercent" className="font-extrabold">Interval tersisa (%)</FieldLabel>
              <Input id="lapseIntervalPercent" type="number" min={0} max={100} className="neo-input" aria-invalid={Boolean(errors.lapseIntervalPercent)} {...register("lapseIntervalPercent", { valueAsNumber: true })} />
              <FieldDescription>Persentase interval lama yang dipertahankan setelah lapse.</FieldDescription>
              <FieldError errors={[errors.lapseIntervalPercent]} className="font-semibold" />
            </Field>
            <Field>
              <FieldLabel htmlFor="minimumIntervalDays" className="font-extrabold">Interval minimum (hari)</FieldLabel>
              <Input id="minimumIntervalDays" type="number" min={1} max={36500} className="neo-input" aria-invalid={Boolean(errors.minimumIntervalDays)} {...register("minimumIntervalDays", { valueAsNumber: true })} />
              <FieldDescription>Batas bawah setelah kartu kembali ke review.</FieldDescription>
              <FieldError errors={[errors.minimumIntervalDays]} className="font-semibold" />
            </Field>
          </div>
        </SettingsGroup>

        <SettingsGroup
          icon={SlidersHorizontal}
          title="Interval lanjutan"
          description="Multiplier yang dipakai scheduler review"
          accent="bg-neo-green"
        >
          <Field>
            <FieldLabel htmlFor="maximumIntervalDays" className="font-extrabold">Interval maksimum (hari)</FieldLabel>
            <Input id="maximumIntervalDays" type="number" min={1} max={36500} className="neo-input" aria-invalid={Boolean(errors.maximumIntervalDays)} {...register("maximumIntervalDays", { valueAsNumber: true })} />
            <FieldError errors={[errors.maximumIntervalDays]} className="font-semibold" />
          </Field>
          <div className="grid gap-5 sm:grid-cols-3">
            <Field>
              <FieldLabel htmlFor="intervalModifierPercent" className="font-extrabold">Modifier (%)</FieldLabel>
              <Input id="intervalModifierPercent" type="number" min={50} max={200} className="neo-input" aria-invalid={Boolean(errors.intervalModifierPercent)} {...register("intervalModifierPercent", { valueAsNumber: true })} />
              <FieldDescription>Multiplier untuk seluruh interval.</FieldDescription>
              <FieldError errors={[errors.intervalModifierPercent]} className="font-semibold" />
            </Field>
            <Field>
              <FieldLabel htmlFor="easyBonusPercent" className="font-extrabold">Easy bonus (%)</FieldLabel>
              <Input id="easyBonusPercent" type="number" min={100} max={300} className="neo-input" aria-invalid={Boolean(errors.easyBonusPercent)} {...register("easyBonusPercent", { valueAsNumber: true })} />
              <FieldError errors={[errors.easyBonusPercent]} className="font-semibold" />
            </Field>
            <Field>
              <FieldLabel htmlFor="hardMultiplierPercent" className="font-extrabold">Hard interval (%)</FieldLabel>
              <Input id="hardMultiplierPercent" type="number" min={100} max={200} className="neo-input" aria-invalid={Boolean(errors.hardMultiplierPercent)} {...register("hardMultiplierPercent", { valueAsNumber: true })} />
              <FieldError errors={[errors.hardMultiplierPercent]} className="font-semibold" />
            </Field>
          </div>
        </SettingsGroup>

        {notice ? (
          <p
            role={notice.ok ? "status" : "alert"}
            className={`border-[3px] border-black p-3 font-bold text-black shadow-neo-sm ${notice.ok ? "bg-neo-green" : "bg-neo-coral"}`}
          >
            {notice.message}
          </p>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row">
          <button type="submit" className="neo-button bg-neo-blue">
            <Save className="size-5" aria-hidden="true" />
            {pendingAction === "save" ? "Menyimpan..." : "Simpan pengaturan"}
          </button>
          <button type="button" onClick={resetDefaults} className="neo-button bg-white">
            <RotateCcw className="size-5" aria-hidden="true" />
            {pendingAction === "reset" ? "Mereset..." : "Reset default"}
          </button>
        </div>
      </fieldset>
    </form>
  );
}
