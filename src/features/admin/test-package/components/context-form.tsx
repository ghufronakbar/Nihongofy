"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { CheckCircle2, Save } from "lucide-react";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { updateQuestionContextAction } from "../actions";
import {
  UpdateQuestionContextSchema,
  type UpdateQuestionContextInput,
} from "../schemas";

// Markup yang dikenali renderer wacana. Ditampilkan sebagai pengingat karena
// di sinilah hasil OCR bacaan panjang diperbaiki.
const MARKUP_HINTS = [
  ["{漢字|かんじ}", "furigana"],
  ["__teks__", "garis bawah"],
  ["【A】", "penanda bagian"],
  ["| a | b |", "tabel pipe"],
] as const;

export function ContextForm({
  context,
  questionCount,
}: {
  context: UpdateQuestionContextInput;
  questionCount: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<UpdateQuestionContextInput>({
    resolver: zodResolver(UpdateQuestionContextSchema),
    defaultValues: context,
  });

  const storyImage = useWatch({ control, name: "storyImage" });
  const storyAudio = useWatch({ control, name: "storyAudio" });

  return (
    <form
      onSubmit={handleSubmit((values) => {
        setNotice(null);
        startTransition(async () => {
          const result = await updateQuestionContextAction(values);
          setNotice(
            result.ok
              ? {
                  ok: true,
                  message: `Tersimpan. Perubahan berlaku untuk ${questionCount} soal yang memakai wacana ini.`,
                }
              : { ok: false, message: result.message },
          );
          if (result.ok) router.refresh();
        });
      })}
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
            <FieldLabel htmlFor="storyText">Teks wacana</FieldLabel>
            <Textarea
              id="storyText"
              rows={16}
              spellCheck={false}
              {...register("storyText", { setValueAs: (v) => (v === "" ? null : v) })}
              className="font-japanese text-sm"
            />
            <FieldDescription>
              Boleh kosong untuk wacana yang hanya berupa audio atau gambar. Markup:{" "}
              {MARKUP_HINTS.map(([token, label], index) => (
                <span key={token}>
                  {index > 0 && " · "}
                  <code className="font-mono">{token}</code> {label}
                </span>
              ))}
              . Baris kosong memisahkan paragraf.
            </FieldDescription>
            <FieldError errors={[errors.storyText]} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="storyImage">URL gambar wacana</FieldLabel>
              <Input
                id="storyImage"
                {...register("storyImage", { setValueAs: (v) => (v === "" ? null : v) })}
                className="font-mono text-xs"
              />
              <FieldDescription>Mis. brosur pada soal 情報検索.</FieldDescription>
              <FieldError errors={[errors.storyImage]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="storyAudio">URL audio wacana</FieldLabel>
              <Input
                id="storyAudio"
                {...register("storyAudio", { setValueAs: (v) => (v === "" ? null : v) })}
                className="font-mono text-xs"
              />
              <FieldDescription>Audio yang dipakai bersama beberapa soal choukai.</FieldDescription>
              <FieldError errors={[errors.storyAudio]} />
            </Field>
          </div>

          {(storyImage || storyAudio) && (
            <div className="flex flex-col gap-3 border-t-2 border-neo-ink/15 pt-4">
              <p className="font-mono text-[10px] font-black uppercase tracking-wider text-foreground/60">
                Pratinjau media
              </p>
              {storyAudio && (
                // Diputar langsung dari URL-nya supaya operator tahu tautannya
                // benar-benar hidup sebelum menyimpan.
                <audio controls src={storyAudio} className="w-full max-w-md">
                  <track kind="captions" />
                </audio>
              )}
              {storyImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={storyImage}
                  alt="Pratinjau gambar wacana"
                  className="max-h-72 w-auto border-2 border-neo-ink object-contain"
                />
              )}
            </div>
          )}
        </div>

        <button
          type="submit"
          className="neo-button self-start bg-neo-blue text-sm font-extrabold text-white"
        >
          <Save className="size-4" />
          {isPending ? "Menyimpan..." : "Simpan Wacana"}
        </button>
      </fieldset>
    </form>
  );
}
