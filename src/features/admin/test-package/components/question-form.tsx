"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
import { CheckCircle2, Save } from "lucide-react";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { updateQuestionAction } from "../actions";
import { UpdateQuestionSchema, type UpdateQuestionInput } from "../schemas";

// Markup teks Jepang yang dipahami renderer. Ditampilkan sebagai pengingat
// karena editor ini adalah tempat hasil OCR diperbaiki.
const MARKUP_HINTS = [
  ["{漢字|かんじ}", "furigana"],
  ["__teks__", "garis bawah"],
  ["[_]", "slot kosong"],
  ["[★]", "slot berbintang"],
] as const;

export function QuestionForm({ question }: { question: UpdateQuestionInput }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<UpdateQuestionInput>({
    resolver: zodResolver(UpdateQuestionSchema),
    defaultValues: question,
  });

  const answer = useWatch({ control, name: "questionAnswer" });

  function onSubmit(values: UpdateQuestionInput) {
    setNotice(null);
    startTransition(async () => {
      const result = await updateQuestionAction(values);
      setNotice(
        result.ok
          ? { ok: true, message: "Tersimpan. Cache halaman publik sudah diperbarui." }
          : { ok: false, message: result.message },
      );
      if (result.ok) router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
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
            <FieldLabel htmlFor="instruction">Instruksi mondai</FieldLabel>
            <Textarea id="instruction" rows={2} {...register("instruction")} />
            <FieldDescription>
              Berlaku untuk seluruh soal dalam blok mondai ini, bukan hanya soal yang sedang dibuka.
            </FieldDescription>
            <FieldError errors={[errors.instruction]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="questionText">Teks soal</FieldLabel>
            <Textarea
              id="questionText"
              rows={4}
              spellCheck={false}
              {...register("questionText")}
              className="font-japanese"
            />
            <FieldDescription>
              Boleh kosong untuk soal yang seluruhnya audio. Markup:{" "}
              {MARKUP_HINTS.map(([token, label], index) => (
                <span key={token}>
                  {index > 0 && " · "}
                  <code className="font-mono">{token}</code> {label}
                </span>
              ))}
            </FieldDescription>
            <FieldError errors={[errors.questionText]} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="questionImage">URL gambar soal</FieldLabel>
              <Input
                id="questionImage"
                {...register("questionImage", { setValueAs: (v) => (v === "" ? null : v) })}
                className="font-mono text-xs"
              />
              <FieldError errors={[errors.questionImage]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="questionAudio">URL audio soal</FieldLabel>
              <Input
                id="questionAudio"
                {...register("questionAudio", { setValueAs: (v) => (v === "" ? null : v) })}
                className="font-mono text-xs"
              />
              <FieldError errors={[errors.questionAudio]} />
            </Field>
          </div>
        </div>

        <div className="neo-surface flex flex-col gap-4 border-[3px] border-neo-ink bg-white p-5 shadow-neo">
          <p className="font-mono text-xs font-black uppercase tracking-wider text-foreground/60">
            Pilihan jawaban
          </p>

          {question.choices.map((choice, index) => (
            <div key={choice.id} className="flex flex-col gap-2 border-l-4 border-neo-ink/20 pl-3">
              <input type="hidden" {...register(`choices.${index}.id`, { valueAsNumber: true })} />
              <input
                type="hidden"
                {...register(`choices.${index}.codeAnswer`, { valueAsNumber: true })}
              />
              <div className="flex items-center gap-2">
                <Controller
                  control={control}
                  name="questionAnswer"
                  render={({ field }) => (
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="radio"
                        name="questionAnswer"
                        checked={field.value === choice.codeAnswer}
                        onChange={() => field.onChange(choice.codeAnswer)}
                        className="size-4 accent-black"
                      />
                      <span
                        className={`grid size-7 place-items-center border-2 border-neo-ink font-mono text-xs font-black shadow-neo-sm ${
                          answer === choice.codeAnswer ? "bg-neo-yellow" : "bg-white"
                        }`}
                      >
                        {choice.codeAnswer}
                      </span>
                    </label>
                  )}
                />
                <Input
                  aria-label={`Teks pilihan ${choice.codeAnswer}`}
                  {...register(`choices.${index}.answerText`)}
                  className="font-japanese"
                />
              </div>
              <Input
                aria-label={`URL gambar pilihan ${choice.codeAnswer}`}
                placeholder="URL gambar pilihan (opsional)"
                {...register(`choices.${index}.answerImage`, {
                  setValueAs: (v) => (v === "" ? null : v),
                })}
                className="font-mono text-xs"
              />
            </div>
          ))}

          <FieldError errors={[errors.questionAnswer]} />
          <FieldError errors={[errors.choices?.root ?? errors.choices]} />
          <p className="font-mono text-[11px] font-bold text-foreground/60">
            Radio menandai kunci jawaban. Pilihan boleh bertuliskan kosong untuk soal 即時応答 yang
            opsinya hanya terdengar di audio.
          </p>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="neo-button self-start bg-neo-blue text-sm font-extrabold text-white"
        >
          <Save className="size-4" />
          {isPending ? "Menyimpan..." : "Simpan Soal"}
        </button>
      </fieldset>
    </form>
  );
}
