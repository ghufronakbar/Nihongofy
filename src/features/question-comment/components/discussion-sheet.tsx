"use client";

import { useCallback, useState, useTransition } from "react";
import Link from "next/link";
import { MessagesSquare } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
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
import {
  addQuestionCommentAction,
  getDiscussionAction,
  type DiscussionThreadData,
} from "../actions";
import { AddQuestionCommentSchema, type AddQuestionCommentInput } from "../schemas";
import { discussionPageHref, type CommentTarget } from "../target";
import { CommentImageUploader } from "./comment-image-uploader";
import { DiscussionThread } from "./discussion-thread";
import { PostingSuspendedNotice } from "./posting-suspended-notice";

const COPY: Record<
  CommentTarget["type"],
  { title: string; description: string; placeholder: string; empty: string }
> = {
  question: {
    title: "Diskusi Soal",
    description: "Catatan belajar yang dibagikan pengguna lain untuk soal ini.",
    placeholder: "Tulis pembahasan versi Anda untuk soal ini...",
    empty: "Belum ada catatan yang dibagikan untuk soal ini.",
  },
  vocab: {
    title: "Diskusi Kata",
    description:
      "Jembatan keledai, nuansa, dan pertanyaan pengguna lain tentang kata ini. Isi kartu keliru? Pakai tombol Laporkan kartu.",
    placeholder: "Bagikan jembatan keledai, nuansa, atau pertanyaan tentang kata ini...",
    empty: "Belum ada diskusi untuk kata ini.",
  },
  bunpou: {
    title: "Diskusi Pola",
    description:
      "Contoh lain, nuansa, dan pertanyaan pengguna lain tentang pola ini. Isi pola keliru? Pakai tombol Laporkan pola ini.",
    placeholder: "Bagikan contoh kalimat, tips mengingat, atau pertanyaan tentang pola ini...",
    empty: "Belum ada diskusi untuk pola ini.",
  },
  post: {
    title: "Komentar",
    description: "Komentar dan balasan pada postingan ini.",
    placeholder: "Tulis komentar...",
    empty: "Belum ada komentar.",
  },
};

export function NewPublicNoteForm({
  target,
  placeholder,
  onDone,
}: {
  target: CommentTarget;
  placeholder: string;
  onDone: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const empty: AddQuestionCommentInput = {
    target,
    commentText: "",
    commentImages: [],
    visibility: "PUBLIC",
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
      const result = await addQuestionCommentAction({ ...values, visibility: "PUBLIC" });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      reset(empty);
      onDone();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-2" noValidate>
      <Field>
        <Textarea
          placeholder={placeholder}
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
  target,
  initialCount,
  currentUserId,
  reportEnabled,
  onOpenChange,
  onPosted,
  triggerClassName,
}: {
  target: CommentTarget;
  initialCount: number;
  currentUserId: number | null;
  reportEnabled: boolean;
  /** Mis. reviewer flashcard mematikan pintasan keyboard selama sheet terbuka. */
  onOpenChange?: (open: boolean) => void;
  /** Setelah user menulis catatan publik baru, mis. untuk menyegarkan "Catatanku". */
  onPosted?: () => void;
  /** Mengganti gaya tombol pemicu bawaan. */
  triggerClassName?: string;
}) {
  const copy = COPY[target.type];
  const [open, setOpen] = useState(false);
  const [thread, setThread] = useState<DiscussionThreadData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Thread baru diambil saat sheet dibuka, bukan saat halaman dirender, supaya
  // satu mondai berisi belasan soal tidak menyeret seluruh percakapannya.
  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setThread(await getDiscussionAction({ target }));
    } finally {
      setIsLoading(false);
    }
  }, [target]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    onOpenChange?.(next);
    if (next && thread === null) void load();
  }

  const count = thread
    ? thread.roots.reduce(
        (total, root) => total + root.replies.length + (root.state === "VISIBLE" ? 1 : 0),
        0,
      )
    : initialCount;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger
        render={
          triggerClassName ? (
            <button type="button" className={triggerClassName} />
          ) : (
            <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" />
          )
        }
      >
        <MessagesSquare className="size-3.5" />
        Diskusi ({count})
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{copy.title}</SheetTitle>
          <SheetDescription>
            {copy.description}{" "}
            <Link
              href={discussionPageHref(target)}
              className="font-semibold underline underline-offset-2"
            >
              Buka halaman penuh
            </Link>
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {isLoading && thread === null ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : (
            <DiscussionThread
              roots={thread?.roots ?? []}
              currentUserId={currentUserId}
              postingSuspended={thread?.postingSuspended ?? false}
              onChanged={() => void load()}
              reportEnabled={reportEnabled}
              emptyText={copy.empty}
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
          ) : thread?.postingSuspended ? (
            <PostingSuspendedNotice />
          ) : (
            <NewPublicNoteForm
              target={target}
              placeholder={copy.placeholder}
              onDone={() => {
                void load();
                onPosted?.();
              }}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
