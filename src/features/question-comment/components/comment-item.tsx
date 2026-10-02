"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Globe, Lock } from "lucide-react";
import { toast } from "sonner";
import { EditQuestionCommentSchema, type EditQuestionCommentInput } from "../schemas";
import {
  updateQuestionCommentAction,
  deleteQuestionCommentAction,
  setQuestionCommentVisibilityAction,
  type CommentActionResult,
} from "../actions";
import { discussionThreadHref } from "../target";
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
  // Target catatan, untuk tautan "Buka diskusi". Catatan soal lama yang tidak
  // membawa kolom ini dianggap catatan soal.
  questionId?: number | null;
  vocabId?: number | null;
  bunpouPointId?: number | null;
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
  postingSuspended = false,
  onChanged,
}: {
  comment: CommentData;
  // Mati saat flag diskusi target-nya off: catatan tetap bisa ditulis dan
  // diedit, hanya tombol bagikannya yang hilang.
  canShare?: boolean;
  /**
   * Pemilik di-suspend admin: tidak bisa membagikan atau menyunting catatan yang
   * sedang publik. Menarik ke privat dan menghapus tetap bisa. Server menolak
   * sendiri; ini hanya menyembunyikan tombol yang pasti ditolak.
   */
  postingSuspended?: boolean;
  /**
   * Dipanggil setelah catatan berubah. Tanpa ini halaman di-refresh; reviewer
   * flashcard WAJIB mengisinya supaya sesi belajar tidak ter-reset.
   */
  onChanged?: () => void;
}) {
  const router = useRouter();
  const refresh = () => (onChanged ? onChanged() : router.refresh());

  // Pesan penolakan (rate limit) ditampilkan; sukses menyegarkan data.
  function settle(result: CommentActionResult, afterSuccess?: () => void) {
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    afterSuccess?.();
    refresh();
  }
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  const isPublic = comment.visibility === "PUBLIC";
  const canEdit = !(postingSuspended && isPublic);
  const canToggleVisibility = canShare && (isPublic || !postingSuspended);

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
      settle(await updateQuestionCommentAction(values), () => setIsEditing(false));
    });
  }

  function handleDelete() {
    startTransition(async () => {
      settle(await deleteQuestionCommentAction({ commentId: comment.id }));
    });
  }

  function handleToggleVisibility() {
    startTransition(async () => {
      settle(
        await setQuestionCommentVisibilityAction({
          commentId: comment.id,
          visibility: isPublic ? "PRIVATE" : "PUBLIC",
        }),
      );
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
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="text-xs text-muted-foreground hover:underline"
                >
                  Edit
                </button>
              )}

              {canToggleVisibility && (
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
                  href={discussionThreadHref({
                    id: comment.id,
                    questionId: comment.questionId ?? null,
                    vocabId: comment.vocabId ?? null,
                    bunpouPointId: comment.bunpouPointId ?? null,
                  })}
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
