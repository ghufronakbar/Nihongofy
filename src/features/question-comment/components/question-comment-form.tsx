"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AddQuestionCommentSchema, type AddQuestionCommentInput } from "../schemas";
import { addQuestionCommentAction } from "../actions";
import { CommentImageUploader } from "./comment-image-uploader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldError } from "@/components/ui/field";

export function QuestionCommentForm({ questionId }: { questionId: number }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    formState: { errors },
  } = useForm<AddQuestionCommentInput>({
    resolver: zodResolver(AddQuestionCommentSchema),
    defaultValues: { questionId, commentText: "", commentImages: [] },
  });

  const commentImages = useWatch({ control, name: "commentImages" });

  function onSubmit(values: AddQuestionCommentInput) {
    startTransition(async () => {
      await addQuestionCommentAction(values);
      reset({ questionId, commentText: "", commentImages: [] });
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-2" noValidate>
      <Field>
        <Textarea
          placeholder="Tambah catatan belajar untuk soal ini..."
          rows={2}
          {...register("commentText")}
        />
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
