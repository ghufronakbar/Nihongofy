"use client";

import { useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ReplyQuestionCommentSchema, type ReplyQuestionCommentInput } from "../schemas";
import { replyToQuestionCommentAction } from "../actions";
import { CommentImageUploader } from "./comment-image-uploader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldError } from "@/components/ui/field";

export function ReplyForm({
  parentId,
  // Membalas sebuah balasan tetap menghasilkan balasan pada root yang sama.
  // Tujuannya disimpan sebagai relasi lewat `repliedToId`, bukan teks "@nama"
  // di dalam isi balasan: teks akan basi begitu penulisnya ganti username.
  repliedTo = null,
  onDone,
  onCancel,
}: {
  parentId: number;
  repliedTo?: { id: number; username: string } | null;
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
    defaultValues: {
      parentId,
      repliedToId: repliedTo?.id ?? null,
      commentText: "",
      commentImages: [],
    },
  });

  const commentImages = useWatch({ control, name: "commentImages" });

  function onSubmit(values: ReplyQuestionCommentInput) {
    startTransition(async () => {
      const result = await replyToQuestionCommentAction(values);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      reset({
        parentId,
        repliedToId: repliedTo?.id ?? null,
        commentText: "",
        commentImages: [],
      });
      onDone();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-2 flex flex-col gap-2" noValidate>
      {repliedTo && (
        <p className="text-xs font-semibold text-muted-foreground">
          Membalas <span className="font-mono font-black">@{repliedTo.username}</span>
        </p>
      )}
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
