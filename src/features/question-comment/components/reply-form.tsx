"use client";

import { useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ReplyQuestionCommentSchema, type ReplyQuestionCommentInput } from "../schemas";
import { replyToQuestionCommentAction } from "../actions";
import { CommentImageUploader } from "./comment-image-uploader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldError } from "@/components/ui/field";

export function ReplyForm({
  parentId,
  // Membalas sebuah balasan tetap menghasilkan balasan pada root yang sama —
  // mention hanya penanda tujuan, bukan cabang baru.
  defaultText = "",
  onDone,
  onCancel,
}: {
  parentId: number;
  defaultText?: string;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    formState: { errors },
  } = useForm<ReplyQuestionCommentInput>({
    resolver: zodResolver(ReplyQuestionCommentSchema),
    defaultValues: { parentId, commentText: defaultText, commentImages: [] },
  });

  const commentImages = useWatch({ control, name: "commentImages" });

  function onSubmit(values: ReplyQuestionCommentInput) {
    startTransition(async () => {
      await replyToQuestionCommentAction(values);
      reset({ parentId, commentText: "", commentImages: [] });
      onDone();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-2 flex flex-col gap-2" noValidate>
      <Field>
        <Textarea placeholder="Tulis balasan..." rows={2} {...register("commentText")} />
        <FieldError errors={[errors.commentText]} />
      </Field>
      <CommentImageUploader
        value={commentImages}
        onChange={(urls) => setValue("commentImages", urls)}
      />
      <div className="flex gap-2 self-end">
        {onCancel && (
          <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={onCancel}>
            Batal
          </Button>
        )}
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Mengirim..." : "Balas"}
        </Button>
      </div>
    </form>
  );
}
