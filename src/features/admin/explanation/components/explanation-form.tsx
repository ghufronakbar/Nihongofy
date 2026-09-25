"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
import { AlertTriangle, ArrowRight, BadgeCheck, CheckCircle2, RotateCcw, Save } from "lucide-react";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  approveExplanationAction,
  resolveAnswerKeyDoubtAction,
  unapproveExplanationAction,
  updateExplanationAction,
} from "../actions";
import { UpdateExplanationSchema, type UpdateExplanationInput } from "../schemas";

export type ExplanationFormChoice = {
  codeAnswer: number;
  answerText: string;
  isKey: boolean;
};

export function ExplanationForm({
  defaultValues,
  choices,
  reviewedAt,
  source,
  nextHref,
}: {
  defaultValues: UpdateExplanationInput;
  choices: ExplanationFormChoice[];
  reviewedAt: Date | null;
  source: string | null;
  nextHref: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isDirty },
  } = useForm<UpdateExplanationInput>({
    resolver: zodResolver(UpdateExplanationSchema),
    defaultValues,
  });

  const doubt = useWatch({ control, name: "answerKeyDoubt" });

  function run(work: () => Promise<{ ok: boolean; message?: string }>, okMessage: string) {
    setNotice(null);
    startTransition(async () => {
      const result = await work();
      setNotice(
        result.ok
          ? { ok: true, message: okMessage }
          : { ok: false, message: result.message ?? "Aksi gagal." },
      );
      if (result.ok) router.refresh();
    });
  }

  return (
    <form
      onSubmit={handleSubmit((values) =>
        run(() => updateExplanationAction(values), "Pembahasan tersimpan."),
      )}
      noValidate
      className="flex flex-col gap-6"
    >
      <fieldset disabled={isPending} className="contents">
        {notice && (
          <p
            className={`flex items-center gap-2 border-[3px] border-neo-ink px-4 py-2.5 text-sm font-bold shadow-neo-sm ${
              notice.ok ? "bg-white text-neo-ink" : "bg-neo-coral text-white"
            }`}
          >
            {notice.ok && <CheckCircle2 className="size-4 shrink-0 stroke-[2.5] text-neo-blue" />}
            {notice.message}
          </p>
        )}

        <div className="neo-surface flex flex-col gap-4 border-[3px] border-neo-ink bg-white p-5 shadow-neo">
          <Field>
            <FieldLabel htmlFor="summary">Ringkasan</FieldLabel>
            <Textarea id="summary" rows={3} {...register("summary")} className="font-japanese" />
            <FieldDescription>
              Satu-satunya bagian yang wajib: kenapa kunci jawabannya benar.
            </FieldDescription>
            <FieldError errors={[errors.summary]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="detail">Pembahasan lengkap</FieldLabel>
            <Textarea id="detail" rows={6} {...register("detail")} className="font-japanese" />
            <FieldError errors={[errors.detail]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="translation">Terjemahan kalimat kunci</FieldLabel>
            <Textarea id="translation" rows={2} {...register("translation")} />
            <FieldError errors={[errors.translation]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="keyPointsText">Poin kunci</FieldLabel>
            <Textarea
              id="keyPointsText"
              rows={4}
              {...register("keyPointsText")}
              className="font-japanese"
            />
            <FieldDescription>Satu poin per baris. Baris kosong diabaikan.</FieldDescription>
            <FieldError errors={[errors.keyPointsText]} />
          </Field>
        </div>

        <div className="neo-surface flex flex-col gap-4 border-[3px] border-neo-ink bg-white p-5 shadow-neo">
          <p className="font-mono text-xs font-black uppercase tracking-wider text-foreground/60">
            Alasan per pilihan
          </p>
          <p className="text-xs font-semibold text-foreground/70">
            Isi keempatnya atau kosongkan semuanya. Sebagian saja membuat pembahasan merender opsi
            yang timpang.
          </p>

          {choices.map((choice, index) => (
            <div key={choice.codeAnswer} className="flex flex-col gap-1.5">
              <input
                type="hidden"
                {...register(`choices.${index}.codeAnswer`, { valueAsNumber: true })}
              />
              <div className="flex items-center gap-2">
                <span
                  className={`grid size-7 shrink-0 place-items-center border-2 border-neo-ink font-mono text-xs font-black shadow-neo-sm ${
                    choice.isKey ? "bg-neo-yellow" : "bg-white"
                  }`}
                >
                  {choice.codeAnswer}
                </span>
                <span className="font-japanese truncate text-xs font-semibold text-foreground/75">
                  {choice.answerText || <span className="text-foreground/40">(tanpa teks)</span>}
                </span>
                {choice.isKey && (
                  <span className="ml-auto shrink-0 font-mono text-[10px] font-black uppercase text-foreground/60">
                    kunci
                  </span>
                )}
              </div>
              <Textarea
                rows={2}
                aria-label={`Alasan pilihan ${choice.codeAnswer}`}
                {...register(`choices.${index}.reason`)}
                className="font-japanese text-xs"
              />
            </div>
          ))}
          <FieldError errors={[errors.choices?.root ?? errors.choices]} />
        </div>

        <div className="neo-surface flex flex-col gap-4 border-[3px] border-neo-ink bg-white p-5 shadow-neo">
          <Controller
            control={control}
            name="answerKeyDoubt"
            render={({ field }) => (
              <label className="flex items-start gap-3">
                <Switch
                  checked={field.value}
                  onCheckedChange={(checked: boolean) => field.onChange(checked)}
                />
                <span className="text-sm font-bold text-foreground/85">
                  Kunci jawaban meragukan
                  <span className="block text-xs font-semibold text-foreground/60">
                    Data soal berasal dari OCR, jadi kunci bisa saja salah ketik. Pembahasan tidak
                    dapat disetujui selama penanda ini masih aktif.
                  </span>
                </span>
              </label>
            )}
          />

          {doubt && (
            <Field>
              <FieldLabel htmlFor="answerKeyDoubtNote">Catatan keraguan</FieldLabel>
              <Input id="answerKeyDoubtNote" {...register("answerKeyDoubtNote")} />
              <FieldError errors={[errors.answerKeyDoubtNote]} />
            </Field>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            className="neo-button bg-neo-blue text-sm font-extrabold text-white"
          >
            <Save className="size-4" />
            {isPending ? "Menyimpan..." : "Simpan"}
          </button>

          {reviewedAt ? (
            <button
              type="button"
              onClick={() =>
                run(
                  () => unapproveExplanationAction({ questionId: defaultValues.questionId }),
                  "Persetujuan dibatalkan.",
                )
              }
              className="neo-button bg-white text-sm font-extrabold text-black"
            >
              <RotateCcw className="size-4" />
              Batalkan Persetujuan
            </button>
          ) : (
            <button
              type="button"
              onClick={() =>
                run(
                  () => approveExplanationAction({ questionId: defaultValues.questionId }),
                  "Pembahasan disetujui.",
                )
              }
              className="neo-button bg-neo-yellow text-sm font-extrabold text-black"
            >
              <BadgeCheck className="size-4" />
              Setujui
            </button>
          )}

          {defaultValues.answerKeyDoubt && (
            <button
              type="button"
              onClick={() =>
                run(
                  () => resolveAnswerKeyDoubtAction({ questionId: defaultValues.questionId }),
                  "Keraguan kunci jawaban ditutup.",
                )
              }
              className="neo-button bg-white text-sm font-extrabold text-black"
            >
              <AlertTriangle className="size-4" />
              Kunci Sudah Diperiksa
            </button>
          )}

          {nextHref && (
            <Link
              href={nextHref}
              className="neo-button ml-auto bg-white text-sm font-extrabold text-black"
            >
              Berikutnya
              <ArrowRight className="size-4" />
            </Link>
          )}
        </div>

        <p className="text-xs font-semibold text-foreground/60">
          Menyimpan tidak menandai pembahasan sudah direview. Status{" "}
          <code className="font-mono">{source ?? "belum ada"}</code>
          {reviewedAt ? " dan sudah disetujui" : " dan belum disetujui"}; gunakan tombol Setujui
          untuk mengisi <code className="font-mono">reviewedAt</code>.
          {isDirty && " Ada perubahan yang belum disimpan."}
        </p>
      </fieldset>
    </form>
  );
}
