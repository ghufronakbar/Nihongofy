"use client";

import { useMemo, useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Save, Wand2 } from "lucide-react";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { createArticleAction, updateArticleAction } from "../actions";
import { CreateArticleSchema, type CreateArticleInput } from "../schemas";

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const BODY_TEMPLATE = JSON.stringify(
  [
    { type: "paragraph", text: "Paragraf pembuka artikel." },
    { type: "heading", level: 2, text: "Subjudul" },
    { type: "list", ordered: false, items: ["Poin pertama", "Poin kedua"] },
  ],
  null,
  2,
);

// Form selalu memakai CreateArticleSchema. `id` sengaja tidak menjadi field
// form: resolver yang berganti-ganti schema antara create dan update membuat
// tipe react-hook-form menjadi union dan tidak lagi dapat disempitkan.
export function ArticleForm({
  articleId,
  defaultValues,
  knownTags,
}: {
  articleId?: number;
  defaultValues?: CreateArticleInput;
  knownTags: string[];
}) {
  const isEdit = articleId !== undefined;
  const [isPending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    setError,
    formState: { errors },
  } = useForm<CreateArticleInput>({
    resolver: zodResolver(CreateArticleSchema),
    defaultValues: defaultValues ?? {
      slug: "",
      title: "",
      excerpt: "",
      bodyJson: BODY_TEMPLATE,
      coverImage: "",
      coverAlt: "",
      authorName: "",
      authorRole: "",
      category: "",
      tags: [],
      readTime: 5,
      isFeatured: false,
      status: "DRAFT",
    },
  });

  const title = useWatch({ control, name: "title" });
  const slug = useWatch({ control, name: "slug" });
  const bodyJson = useWatch({ control, name: "bodyJson" });

  // Ringkasan blok menggantikan preview: editor ini memang textarea JSON, dan
  // yang paling sering salah adalah struktur bloknya, bukan tampilannya.
  const blockSummary = useMemo(() => {
    try {
      const parsed = JSON.parse(bodyJson ?? "");
      if (!Array.isArray(parsed)) return null;
      const counts = new Map<string, number>();
      for (const block of parsed) {
        const type = typeof block?.type === "string" ? block.type : "?";
        counts.set(type, (counts.get(type) ?? 0) + 1);
      }
      return { total: parsed.length, counts: [...counts.entries()] };
    } catch {
      return null;
    }
  }, [bodyJson]);

  function onSubmit(values: CreateArticleInput) {
    setNotice(null);
    startTransition(async () => {
      const result =
        articleId === undefined
          ? await createArticleAction(values)
          : await updateArticleAction({ id: articleId, ...values });

      // Action melakukan redirect saat berhasil, jadi apa pun yang kembali ke
      // sini adalah kegagalan.
      if (result && !result.ok) {
        if (result.field) setError(result.field, { message: result.message });
        else setNotice(result.message);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      <fieldset disabled={isPending} className="contents">
        {notice && (
          <p className="border-[3px] border-neo-ink bg-neo-coral px-4 py-2.5 text-sm font-bold text-white shadow-neo-sm">
            {notice}
          </p>
        )}

        <div className="neo-surface flex flex-col gap-5 border-[3px] border-neo-ink bg-white p-5 shadow-neo">
          <Field>
            <FieldLabel htmlFor="title">Judul</FieldLabel>
            <Input id="title" {...register("title")} />
            <FieldError errors={[errors.title]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="slug">Slug</FieldLabel>
            <div className="flex gap-2">
              <Input id="slug" {...register("slug")} className="font-mono" />
              <button
                type="button"
                onClick={() => setValue("slug", slugify(title ?? ""), { shouldValidate: true })}
                className="neo-button shrink-0 bg-neo-yellow text-xs font-extrabold text-black"
              >
                <Wand2 className="size-4" />
                Dari judul
              </button>
            </div>
            <FieldDescription>
              Mengubah slug artikel yang sudah terbit akan mematahkan tautan lama.
            </FieldDescription>
            <FieldError errors={[errors.slug]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="excerpt">Ringkasan</FieldLabel>
            <Textarea id="excerpt" rows={3} {...register("excerpt")} />
            <FieldError errors={[errors.excerpt]} />
          </Field>
        </div>

        <div className="neo-surface flex flex-col gap-3 border-[3px] border-neo-ink bg-white p-5 shadow-neo">
          <Field>
            <FieldLabel htmlFor="bodyJson">Body (JSON)</FieldLabel>
            <Textarea
              id="bodyJson"
              rows={18}
              spellCheck={false}
              {...register("bodyJson")}
              className="font-mono text-xs"
            />
            <FieldDescription>
              Array blok. Tipe yang tersedia: paragraph, heading, list, quote, example, callout.
              Divalidasi dengan schema yang sama dengan yang dipakai halaman publik.
            </FieldDescription>
            <FieldError errors={[errors.bodyJson]} />
          </Field>
          {blockSummary ? (
            <p className="font-mono text-[11px] font-bold text-foreground/60">
              {blockSummary.total} blok ·{" "}
              {blockSummary.counts.map(([type, count]) => `${type} ${count}`).join(" · ")}
            </p>
          ) : (
            <p className="font-mono text-[11px] font-bold text-neo-coral">
              Belum bisa dibaca sebagai JSON array.
            </p>
          )}
        </div>

        <div className="neo-surface grid gap-5 border-[3px] border-neo-ink bg-white p-5 shadow-neo sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="coverImage">Cover</FieldLabel>
            <Input id="coverImage" {...register("coverImage")} className="font-mono text-xs" />
            <FieldDescription>
              Default proyek ini memakai route gambar ter-generate:{" "}
              <code className="font-mono">/article/{slug || "<slug>"}/cover</code>
            </FieldDescription>
            <FieldError errors={[errors.coverImage]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="coverAlt">Teks alternatif cover</FieldLabel>
            <Input id="coverAlt" {...register("coverAlt")} />
            <FieldError errors={[errors.coverAlt]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="authorName">Nama penulis</FieldLabel>
            <Input id="authorName" {...register("authorName")} />
            <FieldError errors={[errors.authorName]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="authorRole">Peran penulis</FieldLabel>
            <Input id="authorRole" {...register("authorRole")} />
            <FieldDescription>Opsional.</FieldDescription>
            <FieldError errors={[errors.authorRole]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="category">Kategori</FieldLabel>
            <Input id="category" list="admin-article-categories" {...register("category")} />
            <FieldDescription>Slug kategori diturunkan otomatis dari nama ini.</FieldDescription>
            <FieldError errors={[errors.category]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="readTime">Waktu baca (menit)</FieldLabel>
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
                <FieldLabel htmlFor="tags">Tag</FieldLabel>
                <Input
                  id="tags"
                  defaultValue={field.value.join(", ")}
                  onChange={(event) =>
                    field.onChange(
                      event.target.value
                        .split(",")
                        .map((tag) => tag.trim())
                        .filter(Boolean),
                    )
                  }
                />
                <FieldDescription>
                  Pisahkan dengan koma. Tag yang belum ada akan dibuat otomatis. Tag yang sudah
                  dipakai: {knownTags.length > 0 ? knownTags.join(", ") : "belum ada"}.
                </FieldDescription>
                <FieldError errors={[errors.tags]} />
              </Field>
            )}
          />
        </div>

        <div className="neo-surface flex flex-col gap-5 border-[3px] border-neo-ink bg-white p-5 shadow-neo">
          <Field>
            <FieldLabel htmlFor="status">Status</FieldLabel>
            <NativeSelect id="status" {...register("status")}>
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
              <option value="ARCHIVED">Archived</option>
            </NativeSelect>
            <FieldDescription>
              Hanya artikel Published yang tampil di halaman publik, search, dan sitemap. Tanggal
              terbit pertama dipertahankan saat artikel diterbitkan ulang.
            </FieldDescription>
            <FieldError errors={[errors.status]} />
          </Field>

          <Controller
            control={control}
            name="isFeatured"
            render={({ field }) => (
              <Field orientation="horizontal">
                <Switch
                  id="isFeatured"
                  checked={field.value}
                  onCheckedChange={(checked: boolean) => field.onChange(checked)}
                />
                <FieldLabel htmlFor="isFeatured">Tandai sebagai featured</FieldLabel>
              </Field>
            )}
          />
        </div>

        <datalist id="admin-article-categories" />

        <button
          type="submit"
          disabled={isPending}
          className="neo-button self-start bg-neo-blue text-sm font-extrabold text-white"
        >
          <Save className="size-4" />
          {isPending ? "Menyimpan..." : isEdit ? "Simpan Perubahan" : "Buat Artikel"}
        </button>
      </fieldset>
    </form>
  );
}
