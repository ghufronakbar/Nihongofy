"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Send } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Field, FieldError } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { CommentImageUploader } from "@/features/question-comment/components/comment-image-uploader";
import { createPostAction, updatePostAction } from "../actions";
import { CreatePostSchema, POST_TEXT_MAX_LENGTH, type CreatePostInput } from "../schemas";

/**
 * Form postingan baru, atau menyunting postingan yang ada bila `postId` diisi.
 * Gambar memakai uploader komentar (prefix object dan kuotanya sama).
 */
export function PostComposer({
  postId,
  initial,
  isPrivateAccount,
  onDone,
  onCancel,
}: {
  postId?: number;
  initial?: CreatePostInput;
  /** Akun penulis private: diberi tahu bahwa postingannya tidak masuk feed global. */
  isPrivateAccount?: boolean;
  onDone?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const empty: CreatePostInput = initial ?? { text: "", images: [] };
  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    formState: { errors },
  } = useForm<CreatePostInput>({
    resolver: zodResolver(CreatePostSchema),
    defaultValues: empty,
  });
  const text = useWatch({ control, name: "text" });
  const images = useWatch({ control, name: "images" });

  function onSubmit(values: CreatePostInput) {
    startTransition(async () => {
      const result =
        postId === undefined ? await createPostAction(values) : await updatePostAction({ postId, ...values });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      if (postId === undefined) reset({ text: "", images: [] });
      toast.success(postId === undefined ? "Postingan terbit." : "Postingan disunting.");
      onDone?.();
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-3">
      <Field>
        <Textarea
          rows={postId === undefined ? 3 : 4}
          maxLength={POST_TEXT_MAX_LENGTH}
          placeholder="Bagikan progres, pertanyaan, atau tips belajar bahasa Jepang..."
          aria-label="Isi postingan"
          aria-invalid={Boolean(errors.text)}
          className="min-h-24 border-2 border-black bg-white text-base"
          {...register("text")}
        />
        <FieldError errors={[errors.text]} className="font-semibold" />
      </Field>
      <CommentImageUploader value={images} onChange={(urls) => setValue("images", urls, { shouldDirty: true })} />
      <FieldError errors={[errors.images]} className="font-semibold" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold text-black/60">
          {text.length}/{POST_TEXT_MAX_LENGTH}
          {isPrivateAccount
            ? " · Akunmu private: hanya kamu dan follower yang disetujui yang melihat postingan ini."
            : " · Teks polos; tautan tidak dapat diklik."}
        </p>
        <div className="flex gap-2">
          {onCancel ? (
            <button type="button" onClick={onCancel} disabled={isPending} className="neo-button bg-white text-sm">
              Batal
            </button>
          ) : null}
          <button type="submit" disabled={isPending} className="neo-button bg-neo-blue text-sm">
            <Send className="size-4" aria-hidden="true" />
            {isPending ? "Mengirim..." : postId === undefined ? "Posting" : "Simpan"}
          </button>
        </div>
      </div>
    </form>
  );
}
