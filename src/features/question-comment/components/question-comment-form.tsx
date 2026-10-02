"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { AddQuestionCommentSchema, type AddQuestionCommentInput } from "../schemas";
import { addQuestionCommentAction } from "../actions";
import type { CommentTarget } from "../target";
import { CommentImageUploader } from "./comment-image-uploader";
import { Button } from "@/components/ui/button";
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
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-2" noValidate>
      <Field>
        <Textarea placeholder={placeholder} rows={2} {...register("commentText")} />
        <FieldError errors={[errors.commentText]} />
      </Field>
      <CommentImageUploader
        value={commentImages}
        onChange={(urls) => setValue("commentImages", urls)}
      />
      <Button type="submit" size="sm" variant="outline" disabled={isPending} className="self-end">
        {isPending ? "Menyimpan..." : "Tambah Catatan"}
      </Button>
    </form>
  );
}
