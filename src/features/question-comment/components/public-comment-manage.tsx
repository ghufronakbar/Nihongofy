"use client";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
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
import {
  EditQuestionCommentSchema,
  type EditQuestionCommentInput,
} from "../schemas";
import {
  deleteQuestionCommentAction,
  updateQuestionCommentAction,
} from "../actions";
export function PublicCommentManage({
  id,
  text,
  images,
  canEdit,
  onChanged,
}: {
  id: number;
  text: string;
  images: string[];
  canEdit: boolean;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EditQuestionCommentInput>({
    resolver: zodResolver(EditQuestionCommentSchema),
    defaultValues: { commentId: id, commentText: text, commentImages: images },
  });
  function save(values: EditQuestionCommentInput) {
    startTransition(async () => {
      try {
        const result = await updateQuestionCommentAction(values);
        if (!result.ok) {
          toast.error(result.message);
          return;
        }
        setEditing(false);
        onChanged();
      } catch {
        toast.error("Komentar belum tersimpan. Coba lagi.");
      }
    });
  }
  return (
    <div className="mt-2">
      {editing ? (
        <form onSubmit={handleSubmit(save)} className="grid gap-2">
          <Field>
            <FieldLabel htmlFor={`edit-comment-${id}`} className="text-xs">
              Edit komentar
            </FieldLabel>
            <Textarea
              id={`edit-comment-${id}`}
              rows={3}
              {...register("commentText")}
            />
            <FieldError errors={[errors.commentText]} />
          </Field>
          <div className="flex gap-2">
            <Button size="sm" type="submit" disabled={pending}>
              Simpan
            </Button>
            <Button
              size="sm"
              type="button"
              variant="ghost"
              onClick={() => setEditing(false)}
            >
              Batal
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex gap-4 text-xs text-muted-foreground">
          {canEdit && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="py-1 hover:underline"
            >
              Edit
            </button>
          )}
          <AlertDialog>
            <AlertDialogTrigger className="py-1 hover:underline">
              Hapus
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Hapus komentar ini?</AlertDialogTitle>
                <AlertDialogDescription>
                  Isi komentarmu akan disembunyikan. Balasan pembaca lain tetap
                  tersedia.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Batal</AlertDialogCancel>
                <AlertDialogAction
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      try {
                        const result = await deleteQuestionCommentAction({
                          commentId: id,
                        });
                        if (!result.ok) toast.error(result.message);
                        else onChanged();
                      } catch {
                        toast.error("Komentar belum dapat dihapus.");
                      }
                    })
                  }
                >
                  Hapus komentar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
}
