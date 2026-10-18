"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { AddQuestionCommentSchema, type AddQuestionCommentInput } from "../schemas";
import { addQuestionCommentAction } from "../actions";
import type { CommentTarget } from "../target";
import { CommentImageUploader } from "./comment-image-uploader";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldError } from "@/components/ui/field";

export function QuestionCommentForm({
  target,
  placeholder = "Tambah catatan belajar untuk soal ini...",
  onSaved,
}: {
  target: CommentTarget;
  placeholder?: string;
  /**
   * Dipanggil setelah tersimpan. Tanpa ini halaman di-refresh; reviewer
   * flashcard WAJIB mengisinya, karena refresh halaman belajar membangun ulang
   * antrean dan mereset sesi.
   */
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const empty: AddQuestionCommentInput = {
    target,
    commentText: "",
    commentImages: [],
    visibility: "PRIVATE",
  };

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    formState: { errors },
  } = useForm<AddQuestionCommentInput>({
    resolver: zodResolver(AddQuestionCommentSchema),
    defaultValues: empty,
  });

  const commentImages = useWatch({ control, name: "commentImages" });

  function onSubmit(values: AddQuestionCommentInput) {
    startTransition(async () => {
      const result = await addQuestionCommentAction(values);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      reset(empty);
      if (onSaved) onSaved();
      else router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3" noValidate>
      <Field>
        <Textarea
          placeholder={placeholder}
          aria-label="Catatan belajar"
          aria-invalid={Boolean(errors.commentText)}
          rows={2}
          className="min-h-24 rounded-lg border-[3px] border-neo-ink bg-white px-3 py-3 font-medium text-black shadow-neo-sm focus-visible:border-neo-ink focus-visible:shadow-neo focus-visible:ring-0 dark:bg-white"
          {...register("commentText")}
        />
        <FieldError errors={[errors.commentText]} />
      </Field>
      <CommentImageUploader
        value={commentImages}
        onChange={(urls) => setValue("commentImages", urls)}
      />
      <button type="submit" disabled={isPending} className="neo-button min-h-10 self-end bg-neo-yellow px-4 py-2 text-xs text-black">
        <Plus className="size-4" aria-hidden="true" />
        {isPending ? "Menyimpan..." : "Tambah Catatan"}
      </button>
    </form>
  );
}
