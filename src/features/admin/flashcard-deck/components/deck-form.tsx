"use client";

import { useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { Save } from "lucide-react";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { FLASHCARD_NOTE_TYPES, FLASHCARD_NOTE_TYPE_KINDS } from "@/features/flashcard/note-types";
import { createSystemDeckAction, updateSystemDeckAction } from "../actions";
import { CreateSystemDeckSchema, type CreateSystemDeckInput } from "../schemas";

export function DeckForm({
  deckId,
  defaultValues,
  noteCount,
}: {
  deckId?: number;
  defaultValues?: CreateSystemDeckInput;
  noteCount: number;
}) {
  const [isPending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<CreateSystemDeckInput>({
    resolver: zodResolver(CreateSystemDeckSchema),
    defaultValues: defaultValues ?? {
      slug: "",
      name: "",
      description: "",
      jlptLevel: null,
      noteType: "VOCAB_JP",
      license: "",
      order: 0,
      isPublished: true,
    },
  });

  return (
    <form
      onSubmit={handleSubmit((values) => {
        setNotice(null);
        startTransition(async () => {
          const result =
            deckId === undefined
              ? await createSystemDeckAction(values)
              : await updateSystemDeckAction({ id: deckId, ...values });
          // Action melakukan redirect saat berhasil.
          if (result && !result.ok) setNotice(result.message);
        });
      })}
      noValidate
      className="flex flex-col gap-5"
    >
      <fieldset disabled={isPending} className="contents">
        {notice && (
          <p className="border-[3px] border-neo-ink bg-neo-coral px-4 py-2.5 text-sm font-bold text-white shadow-neo-sm">
            {notice}
          </p>
        )}

        <div className="neo-surface grid gap-5 border-[3px] border-neo-ink bg-white p-5 shadow-neo sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="name">Nama deck</FieldLabel>
            <Input id="name" {...register("name")} />
            <FieldDescription>Hierarkis dipisah &quot;::&quot; seperti Anki, mis. JLPT N4::Kosakata.</FieldDescription>
            <FieldError errors={[errors.name]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="slug">Slug</FieldLabel>
            <Input id="slug" {...register("slug")} className="font-mono text-xs" />
            <FieldDescription>
              Kunci deduplikasi seed dan pembentuk guid salinan user
              (<code className="font-mono">sys:&lt;slug&gt;:&lt;guid&gt;</code>). Mengubahnya pada
              deck yang sudah dipakai membuat penambahan ulang menghasilkan kartu duplikat.
            </FieldDescription>
            <FieldError errors={[errors.slug]} />
          </Field>

          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="description">Deskripsi</FieldLabel>
            <Textarea id="description" rows={2} {...register("description")} />
            <FieldError errors={[errors.description]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="noteType">Note type</FieldLabel>
            <NativeSelect id="noteType" {...register("noteType")} disabled={noteCount > 0}>
              {FLASHCARD_NOTE_TYPE_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {FLASHCARD_NOTE_TYPES[kind].label} ({FLASHCARD_NOTE_TYPES[kind].fields.length} field)
                </option>
              ))}
            </NativeSelect>
            <FieldDescription>
              {noteCount > 0
                ? `Terkunci: deck sudah berisi ${noteCount} note, dan setiap note type punya jumlah serta arti field yang berbeda.`
                : "Menentukan jumlah dan arti field setiap note."}
            </FieldDescription>
            <FieldError errors={[errors.noteType]} />
          </Field>

          <Controller
            control={control}
            name="jlptLevel"
            render={({ field }) => (
              <Field>
                <FieldLabel htmlFor="jlptLevel">Level JLPT</FieldLabel>
                <NativeSelect
                  id="jlptLevel"
                  value={field.value ?? ""}
                  onChange={(event) => field.onChange(event.target.value || null)}
                >
                  <option value="">Tanpa level</option>
                  {["N5", "N4", "N3", "N2", "N1"].map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </NativeSelect>
                <FieldError errors={[errors.jlptLevel]} />
              </Field>
            )}
          />

          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="license">Lisensi</FieldLabel>
            <Input id="license" {...register("license")} />
            <FieldDescription>
              Wajib dan <strong>ditampilkan ke user</strong> di halaman Tambah Deck. Sumber seperti
              JMdict/KANJIDIC2 (CC BY-SA 4.0, EDRDG), Tatoeba (CC BY 2.0 FR), dan KanjiVG
              (CC BY-SA 3.0) mewajibkan atribusi. Untuk konten sendiri, tulis apa adanya.
            </FieldDescription>
            <FieldError errors={[errors.license]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="order">Urutan di katalog</FieldLabel>
            <Input
              id="order"
              type="number"
              min={0}
              max={9999}
              {...register("order", { valueAsNumber: true })}
            />
            <FieldError errors={[errors.order]} />
          </Field>

          <Controller
            control={control}
            name="isPublished"
            render={({ field }) => (
              <Field orientation="horizontal" className="self-end">
                <Switch
                  id="isPublished"
                  checked={field.value}
                  onCheckedChange={(checked: boolean) => field.onChange(checked)}
                />
                <FieldLabel htmlFor="isPublished">Tampil di katalog</FieldLabel>
              </Field>
            )}
          />
        </div>

        <button
          type="submit"
          className="neo-button self-start bg-neo-blue text-sm font-extrabold text-white"
        >
          <Save className="size-4" />
          {isPending ? "Menyimpan..." : deckId === undefined ? "Buat Deck" : "Simpan Deck"}
        </button>
      </fieldset>
    </form>
  );
}
