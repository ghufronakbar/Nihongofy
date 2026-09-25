"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Globe, Lock } from "lucide-react";
import { EditQuestionCommentSchema, type EditQuestionCommentInput } from "../schemas";
import {
  updateQuestionCommentAction,
  deleteQuestionCommentAction,
  setQuestionCommentVisibilityAction,
} from "../actions";
import { CommentImageUploader } from "./comment-image-uploader";
import { CommentAuthorLine, CommentAvatar, CommentImages } from "./comment-body";
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
  visibility: "PRIVATE" | "PUBLIC";
  createdAt: Date;
  updatedAt: Date;
  user: { displayName: string };
};

export function CommentItem({
  comment,
  canShare = false,
}: {
  comment: CommentData;
  // Mati saat FEATURES_QUESTION_DISCUSSION off: catatan tetap bisa ditulis dan
  // diedit, hanya tombol bagikannya yang hilang.
  canShare?: boolean;
}) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  const isPublic = comment.visibility === "PUBLIC";

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

  function handleToggleVisibility() {
    startTransition(async () => {
      await setQuestionCommentVisibilityAction({
        commentId: comment.id,
        visibility: isPublic ? "PRIVATE" : "PUBLIC",
      });
      router.refresh();
    });
  }

  return (
    <div className="flex gap-2">
      <CommentAvatar author={{ displayName: comment.user.displayName, avatarUrl: null }} />
      <div className="min-w-0 flex-1">
        <CommentAuthorLine
          displayName={comment.user.displayName}
          createdAt={comment.createdAt}
          updatedAt={comment.updatedAt}
          badge={
            <span
              className={
                isPublic
                  ? "inline-flex items-center gap-1 rounded border-2 border-neo-ink bg-neo-green px-1.5 py-0.5 font-mono text-[10px] font-black uppercase"
                  : "inline-flex items-center gap-1 rounded border border-neo-ink/30 px-1.5 py-0.5 font-mono text-[10px] font-black uppercase text-foreground/60"
              }
            >
              {isPublic ? <Globe className="size-3" /> : <Lock className="size-3" />}
              {isPublic ? "Publik" : "Privat"}
            </span>
          }
        />

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
            <p className="mt-1 text-sm break-words whitespace-pre-wrap">{comment.commentText}</p>
            <CommentImages images={comment.commentImages} />
            <div className="mt-1 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="text-xs text-muted-foreground hover:underline"
              >
                Edit
              </button>

              {canShare && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleToggleVisibility}
                  className="text-xs text-muted-foreground hover:underline disabled:opacity-50"
                >
                  {isPublic ? "Jadikan privat" : "Bagikan ke diskusi"}
                </button>
              )}

              {canShare && isPublic && (
                <Link
                  href={`/discussion/${comment.id}`}
                  className="text-xs text-muted-foreground hover:underline"
                >
                  Buka diskusi
                </Link>
              )}

              <AlertDialog>
                <AlertDialogTrigger className="text-xs text-muted-foreground hover:underline">
                  Hapus
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Hapus catatan ini?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {isPublic
                        ? "Catatan ini akan hilang dari diskusi dan diganti keterangan bahwa catatan telah dihapus. Balasan pengguna lain tetap ditampilkan."
                        : "Tindakan ini tidak bisa dibatalkan."}
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
