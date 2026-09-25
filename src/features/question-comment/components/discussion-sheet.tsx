"use client";

import { useCallback, useState, useTransition } from "react";
import Link from "next/link";
import { MessagesSquare } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldError } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { addQuestionCommentAction, getQuestionDiscussionAction } from "../actions";
import { AddQuestionCommentSchema, type AddQuestionCommentInput } from "../schemas";
import type { DiscussionRoot } from "../queries";
import { CommentImageUploader } from "./comment-image-uploader";
import { DiscussionThread } from "./discussion-thread";

function NewPublicNoteForm({
  questionId,
  onDone,
}: {
  questionId: number;
  onDone: () => void;
}) {
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
    defaultValues: {
      questionId,
      commentText: "",
      commentImages: [],
      visibility: "PUBLIC",
    },
  });

  const commentImages = useWatch({ control, name: "commentImages" });

  function onSubmit(values: AddQuestionCommentInput) {
    startTransition(async () => {
      await addQuestionCommentAction({ ...values, visibility: "PUBLIC" });
      reset({ questionId, commentText: "", commentImages: [], visibility: "PUBLIC" });
      onDone();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-2" noValidate>
      <Field>
        <Textarea
          placeholder="Tulis pembahasan versi Anda untuk soal ini..."
          rows={3}
          {...register("commentText")}
        />
        <FieldError errors={[errors.commentText]} />
      </Field>
      <CommentImageUploader
        value={commentImages}
        onChange={(urls) => setValue("commentImages", urls)}
      />
      <p className="text-[11px] font-semibold text-muted-foreground">
        Catatan ini langsung tampil publik beserta nama tampilan Anda.
      </p>
      <Button type="submit" size="sm" disabled={isPending} className="self-end">
        {isPending ? "Mengirim..." : "Kirim ke Diskusi"}
      </Button>
    </form>
  );
}

export function DiscussionSheet({
  questionId,
  initialCount,
  currentUserId,
}: {
  questionId: number;
  initialCount: number;
  currentUserId: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [roots, setRoots] = useState<DiscussionRoot[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Thread baru diambil saat sheet dibuka, bukan saat halaman dirender, supaya
  // satu mondai berisi belasan soal tidak menyeret seluruh percakapannya.
  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setRoots(await getQuestionDiscussionAction({ questionId }));
    } finally {
      setIsLoading(false);
    }
  }, [questionId]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next && roots === null) void load();
  }

  const count = roots
    ? roots.reduce(
        (total, root) => total + root.replies.length + (root.state === "VISIBLE" ? 1 : 0),
        0,
      )
    : initialCount;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger
        render={<Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" />}
      >
        <MessagesSquare className="size-3.5" />
        Diskusi ({count})
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Diskusi Soal</SheetTitle>
          <SheetDescription>
            Catatan belajar yang dibagikan pengguna lain untuk soal ini.{" "}
            <Link
              href={`/discussion/question/${questionId}`}
              className="font-semibold underline underline-offset-2"
            >
              Buka halaman penuh
            </Link>
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {isLoading && roots === null ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : (
            <DiscussionThread
              roots={roots ?? []}
              currentUserId={currentUserId}
              onChanged={() => void load()}
            />
          )}
        </div>

        <div className="border-t px-4 py-3">
          {currentUserId === null ? (
            <Link
              href="/login"
              className="text-xs font-semibold text-muted-foreground hover:underline"
            >
              Masuk untuk ikut berdiskusi
            </Link>
          ) : (
            <NewPublicNoteForm questionId={questionId} onDone={() => void load()} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
