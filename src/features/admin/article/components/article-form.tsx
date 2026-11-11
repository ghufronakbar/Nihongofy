"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, FileText, Plus, Save, Send, Trash2 } from "lucide-react";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { ARTICLE_LEVELS, ArticleBodySchema } from "@/features/article/schemas";
import { ArticleReader } from "@/features/article/components/article-reader";
import { slugifyArticleValue } from "@/features/article/lib/body-text";
import { createArticleAction, updateArticleAction } from "../actions";
import { CreateArticleSchema, type CreateArticleInput } from "../schemas";
import { ArticleBlockEditor } from "./article-block-editor";

const EMPTY: CreateArticleInput = {
  slug: "",
  title: "",
  excerpt: "",
  titleJa: "",
  excerptJa: "",
  readingLevel: "",
  bodyJson: JSON.stringify([{ type: "paragraph", key: "opening", text: "", japanese: "" }]),
  glossary: [],
  coverImage: "",
  coverAlt: "",
  coverCredit: "",
  coverCreditUrl: "",
  authorName: "Redaksi Nihongofy",
  authorRole: "Tim editorial",
  category: "Kehidupan Sehari-hari",
  tags: [],
  readTime: 5,
  isFeatured: false,
  discussionEnabled: true,
  status: "DRAFT",
};
export function ArticleForm({
  articleId,
  defaultValues,
  knownTags,
  liveStatus,
  slugLocked = false,
  hasDraft = false,
}: {
  articleId?: number;
  defaultValues?: CreateArticleInput;
  knownTags: string[];
  liveStatus?: string;
  slugLocked?: boolean;
  hasDraft?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [preview, setPreview] = useState(false);
  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors },
  } = useForm<CreateArticleInput>({
    resolver: zodResolver(CreateArticleSchema),
    defaultValues: defaultValues ?? EMPTY,
  });
  const values = useWatch({ control });
  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(values.bodyJson ?? "[]");
  } catch {
    parsedBody = null;
  }
  const body = ArticleBodySchema.safeParse(parsedBody);
  function onSubmit(data: CreateArticleInput) {
    setNotice(null);
    startTransition(async () => {
      try {
        const result = articleId
          ? await updateArticleAction({ ...data, id: articleId })
          : await createArticleAction(data);
        if (!result.ok) {
          setNotice({ ok: false, text: result.message });
          return;
        }
        reset(data);
        setNotice({
          ok: true,
          text:
            data.status === "PUBLISHED"
              ? "Artikel berhasil diterbitkan."
              : "Draf tersimpan. Perubahan draf tetap privat.",
        });
        if (!articleId) router.replace(`/admin/article/${result.id}`);
        else router.refresh();
      } catch {
        setNotice({
          ok: false,
          text: "Artikel belum tersimpan. Coba kembali; isianmu tetap ada.",
        });
      }
    });
  }
  function save(status: "DRAFT" | "PUBLISHED") {
    setValue("status", status);
    void handleSubmit(onSubmit, () => {
      setPreview(false);
      setNotice({
        ok: false,
        text: "Periksa field yang ditandai sebelum menyimpan.",
      });
    })();
  }
  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-neo-ink/20 bg-white p-4">
        <div className="flex gap-2">
          <button
            type="button"
            aria-pressed={!preview}
            onClick={() => setPreview(false)}
            className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-bold ${!preview ? "bg-neo-ink text-white" : "bg-muted"}`}
          >
            <FileText className="size-4" />
            Tulis
          </button>
          <button
            type="button"
            aria-pressed={preview}
            onClick={() => setPreview(true)}
            className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-bold ${preview ? "bg-neo-ink text-white" : "bg-muted"}`}
          >
            <Eye className="size-4" />
            Pratinjau
          </button>
        </div>
        <span className="text-xs text-foreground/65">
          {hasDraft
            ? "Ada perubahan draf yang belum terbit"
            : liveStatus === "PUBLISHED"
              ? "Versi publik tersedia"
              : "Hanya admin yang dapat melihat draf"}
        </span>
      </div>
      {notice && (
        <p
          role="status"
          className={`rounded-lg border px-4 py-3 text-sm ${notice.ok ? "border-green-300 bg-green-50 text-green-900" : "border-red-300 bg-red-50 text-red-900"}`}
        >
          {notice.text}
        </p>
      )}
      <fieldset disabled={isPending} className="contents">
        {preview ? (
          <div className="grid gap-6">
            <div className="rounded-lg border border-neo-ink/20 bg-white p-6">
              <p className="text-xs font-bold text-foreground/60">Pratinjau privat</p>
              <h2 className="mt-3 text-3xl">{values.title || "Judul artikel"}</h2>
              <p className="mt-3 text-foreground/70">{values.excerpt}</p>
            </div>
            {body.success ? (
              <ArticleReader
                blocks={body.data}
                hasJapanese={Boolean(values.titleJa)}
                glossary={values.glossary?.filter(
                  (
                    entry,
                  ): entry is NonNullable<typeof entry> & {
                    word: string;
                    meaning: string;
                  } => Boolean(entry?.word && entry.meaning),
                )}
                contextKey="admin-preview"
                preview
              />
            ) : (
              <p className="rounded-lg bg-neo-yellow/30 p-6 text-sm">
                Lengkapi isi blok untuk melihat pratinjau.
              </p>
            )}
          </div>
        ) : (
          <>
            <section className="grid gap-5 rounded-lg border border-neo-ink/20 bg-white p-5 sm:p-6">
              <h2 className="text-lg">Identitas artikel</h2>
              <Field>
                <FieldLabel htmlFor="title">Judul Indonesia</FieldLabel>
                <Input id="title" {...register("title")} />
                <FieldError errors={[errors.title]} />
              </Field>
              <Field>
                <FieldLabel htmlFor="excerpt">Ringkasan Indonesia</FieldLabel>
                <Textarea id="excerpt" rows={3} {...register("excerpt")} />
                <FieldError errors={[errors.excerpt]} />
              </Field>
              <Field>
                <FieldLabel htmlFor="slug">Alamat artikel</FieldLabel>
                <div className="flex gap-2">
                  <Input id="slug" {...register("slug")} readOnly={slugLocked} />
                  <button
                    type="button"
                    disabled={slugLocked}
                    onClick={() =>
                      setValue("slug", slugifyArticleValue(values.title ?? ""), {
                        shouldValidate: true,
                      })
                    }
                    className="shrink-0 rounded border px-3 text-xs font-bold disabled:opacity-40"
                  >
                    Dari judul
                  </button>
                </div>
                <FieldError errors={[errors.slug]} />
              </Field>
            </section>
            <section className="grid gap-5 rounded-lg border border-neo-ink/20 bg-white p-5 sm:p-6">
              <div>
                <h2 className="text-lg">Versi Jepang</h2>
                <p className="mt-1 text-sm text-foreground/65">
                  Opsional. Untuk bacaan bilingual, lengkapi judul, ringkasan, dan pasangan Jepang
                  pada setiap blok.
                </p>
              </div>
              <Field>
                <FieldLabel htmlFor="titleJa">Judul Jepang</FieldLabel>
                <Input id="titleJa" lang="ja" {...register("titleJa")} />
                <FieldError errors={[errors.titleJa]} />
              </Field>
              <Field>
                <FieldLabel htmlFor="excerptJa">Ringkasan Jepang</FieldLabel>
                <Textarea id="excerptJa" lang="ja" rows={3} {...register("excerptJa")} />
                <FieldError errors={[errors.excerptJa]} />
              </Field>
              <Field>
                <FieldLabel htmlFor="readingLevel">Perkiraan level bacaan Jepang</FieldLabel>
                <NativeSelect id="readingLevel" {...register("readingLevel")}>
                  <option value="">Tanpa level / Indonesia saja</option>
                  {ARTICLE_LEVELS.map((level) => (
                    <option key={level}>{level}</option>
                  ))}
                </NativeSelect>
                <FieldDescription>
                  Level mengikuti kesulitan teks Jepang, bukan topik ujiannya.
                </FieldDescription>
                <FieldError errors={[errors.readingLevel]} />
              </Field>
            </section>
            <section className="grid gap-4">
              <div>
                <h2 className="text-lg">Isi bacaan</h2>
                <p className="mt-1 text-sm text-foreground/65">
                  Furigana: tulis {"{漢字|かんじ}"}. Pasangan Indonesia dan Jepang tetap berada
                  dalam satu blok.
                </p>
              </div>
              <Controller
                control={control}
                name="bodyJson"
                render={({ field }) => (
                  <ArticleBlockEditor value={field.value} onChange={field.onChange} />
                )}
              />
              <FieldError errors={[errors.bodyJson]} />
            </section>
            <section className="grid gap-4 rounded-lg border border-neo-ink/20 bg-white p-5 sm:p-6">
              <h2 className="text-lg">Kosakata pilihan</h2>
              <Controller
                control={control}
                name="glossary"
                render={({ field }) => (
                  <div className="grid gap-4">
                    {field.value.map((entry, index) => (
                      <div
                        key={index}
                        className="grid items-end gap-3 border-b border-neo-ink/10 pb-4 sm:grid-cols-[1fr_1fr_auto]"
                      >
                        <label className="grid gap-2 text-xs font-semibold">
                          Kata Jepang
                          <Input
                            lang="ja"
                            value={entry.word}
                            onChange={(e) =>
                              field.onChange(
                                field.value.map((item, i) =>
                                  i === index ? { ...item, word: e.target.value } : item,
                                ),
                              )
                            }
                          />
                        </label>
                        <label className="grid gap-2 text-xs font-semibold">
                          Arti Indonesia
                          <Input
                            value={entry.meaning}
                            onChange={(e) =>
                              field.onChange(
                                field.value.map((item, i) =>
                                  i === index ? { ...item, meaning: e.target.value } : item,
                                ),
                              )
                            }
                          />
                        </label>
                        <label className="grid gap-2 text-xs font-semibold sm:col-span-2">
                          Catatan (opsional)
                          <Input
                            value={entry.note ?? ""}
                            onChange={(e) =>
                              field.onChange(
                                field.value.map((item, i) =>
                                  i === index ? { ...item, note: e.target.value } : item,
                                ),
                              )
                            }
                          />
                        </label>
                        <button
                          type="button"
                          aria-label={`Hapus kosakata ${index + 1}`}
                          onClick={() => field.onChange(field.value.filter((_, i) => i !== index))}
                          className="p-3 text-red-700"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      disabled={field.value.length >= 40}
                      onClick={() => field.onChange([...field.value, { word: "", meaning: "" }])}
                      className="inline-flex w-fit items-center gap-2 text-sm font-bold"
                    >
                      <Plus className="size-4" />
                      Tambah kosakata
                    </button>
                  </div>
                )}
              />
              <FieldError errors={[errors.glossary]} />
            </section>
            <section className="grid gap-5 rounded-lg border border-neo-ink/20 bg-white p-5 sm:grid-cols-2 sm:p-6">
              <h2 className="text-lg sm:col-span-2">Sampul dan pengelompokan</h2>
              {(
                [
                  { name: "coverImage", label: "URL / path sampul" },
                  { name: "coverAlt", label: "Deskripsi sampul" },
                  { name: "coverCredit", label: "Kredit foto (opsional)" },
                  {
                    name: "coverCreditUrl",
                    label: "Tautan sumber / lisensi foto",
                  },
                  { name: "authorName", label: "Nama penulis" },
                  { name: "authorRole", label: "Peran penulis" },
                  { name: "category", label: "Kategori utama" },
                ] as const
              ).map((item) => (
                <Field key={item.name}>
                  <FieldLabel htmlFor={item.name}>{item.label}</FieldLabel>
                  <Input id={item.name} {...register(item.name)} />
                  <FieldError errors={[errors[item.name]]} />
                </Field>
              ))}
              <Field>
                <FieldLabel htmlFor="readTime">Estimasi menit membaca</FieldLabel>
                <Input
                  id="readTime"
                  type="number"
                  min={1}
                  max={120}
                  {...register("readTime", { valueAsNumber: true })}
                />
                <FieldError errors={[errors.readTime]} />
              </Field>
              <Controller
                control={control}
                name="tags"
                render={({ field }) => (
                  <Field className="sm:col-span-2">
                    <FieldLabel htmlFor="tags">Tag topik</FieldLabel>
                    <Input
                      id="tags"
                      defaultValue={field.value.join(", ")}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value
                            .split(",")
                            .map((tag) => tag.trim())
                            .filter(Boolean),
                        )
                      }
                    />
                    <FieldDescription>
                      Pisahkan dengan koma. Tag tersedia: {knownTags.join(", ") || "belum ada"}.
                    </FieldDescription>
                    <FieldError errors={[errors.tags]} />
                  </Field>
                )}
              />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" {...register("isFeatured")} />
                Pilihan redaksi
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" {...register("discussionEnabled")} />
                Buka diskusi pembaca
              </label>
            </section>
          </>
        )}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-neo-ink/20 bg-white p-4">
          <p className="max-w-sm text-xs leading-5 text-foreground/65">
            Menyimpan draf tidak mengubah versi artikel yang sedang dibaca publik.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              disabled={isPending}
              onClick={() => save("DRAFT")}
              className="neo-button bg-white text-xs"
            >
              <Save className="size-4" />
              Simpan draf
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => save("PUBLISHED")}
              className="neo-button bg-neo-blue text-xs text-black"
            >
              <Send className="size-4" />
              {isPending ? "Menyimpan..." : "Terbitkan"}
            </button>
          </div>
        </div>
      </fieldset>
    </form>
  );
}
