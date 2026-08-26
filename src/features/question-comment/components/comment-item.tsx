"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { formatDistanceToNow } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { EditQuestionCommentSchema, type EditQuestionCommentInput } from "../schemas";
import { updateQuestionCommentAction, deleteQuestionCommentAction } from "../actions";
import { CommentImageUploader } from "./comment-image-uploader";
import { ImageWithLightbox } from "@/components/image-with-lightbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldError } from "@/components/ui/field";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type CommentData = {
  id: number;
  commentText: string;
  commentImages: string[];
  createdAt: Date;
  updatedAt: Date;
  user: { displayName: string };
};

export function CommentItem({ comment }: { comment: CommentData }) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<EditQuestionCommentInput>({
    resolver: zodResolver(EditQuestionCommentSchema),
    defaultValues: {
      commentId: comment.id,
      commentText: comment.commentText,
      commentImages: comment.commentImages,
    },
  });

  const commentImages = useWatch({ control, name: "commentImages" });
  const wasEdited = comment.updatedAt.getTime() !== comment.createdAt.getTime();

  function onSubmit(values: EditQuestionCommentInput) {
    startTransition(async () => {
      await updateQuestionCommentAction(values);
      setIsEditing(false);
      router.refresh();
    });
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteQuestionCommentAction({ commentId: comment.id });
      router.refresh();
    });
  }

  return (
    <div className="flex gap-2">
      <Avatar size="sm">
        <AvatarFallback>{comment.user.displayName.slice(0, 1).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{comment.user.displayName}</span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(comment.createdAt, { addSuffix: true, locale: idLocale })}
            {wasEdited && " · diedit"}
          </span>
        </div>

        {isEditing ? (
          <form onSubmit={handleSubmit(onSubmit)} className="mt-1 flex flex-col gap-2" noValidate>
            <Field>
              <Textarea rows={2} {...register("commentText")} />
              <FieldError errors={[errors.commentText]} />
            </Field>
            <CommentImageUploader
              value={commentImages}
              onChange={(urls) => setValue("commentImages", urls)}
            />
            <div className="flex gap-2 self-end">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isPending}
                onClick={() => setIsEditing(false)}
              >
                Batal
              </Button>
              <Button type="submit" size="sm" disabled={isPending}>
                {isPending ? "Menyimpan..." : "Simpan"}
              </Button>
            </div>
          </form>
        ) : (
          <>
            <p className="mt-1 text-sm break-words">{comment.commentText}</p>
            {comment.commentImages.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {comment.commentImages.map((url) => (
                  <ImageWithLightbox
                    key={url}
                    src={url}
                    className="size-16 rounded-md border object-cover"
                  />
                ))}
              </div>
            )}
            <div className="mt-1 flex gap-3">
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="text-xs text-muted-foreground hover:underline"
              >
                Edit
              </button>
              <AlertDialog>
                <AlertDialogTrigger className="text-xs text-muted-foreground hover:underline">
                  Hapus
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Hapus catatan ini?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tindakan ini tidak bisa dibatalkan.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Batal</AlertDialogCancel>
                    <AlertDialogAction disabled={isPending} onClick={handleDelete}>
                      Hapus
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
