"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Ban, CheckCircle2, Undo2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldError } from "@/components/ui/field";
import {
  liftUserPostingSuspensionAction,
  suspendUserPostingAction,
  type UserActionResult,
} from "../actions";
import { SuspendUserPostingSchema, type SuspendUserPostingInput } from "../schemas";

export type PostingSuspensionView = {
  /** ISO string. */
  since: string;
  reason: string | null;
  /** Null bila akun admin yang men-suspend sudah tidak ada. */
  byName: string | null;
};

/**
 * Suspend posting diskusi publik per user (`User.postingSuspendedAt`). Section
 * ini punya anchor `#posting` supaya antrean moderasi dapat menautkannya
 * langsung dari baris penulis.
 */
export function PostingSuspensionPanel({
  userId,
  isSelf,
  isAnonymized,
  suspension,
}: {
  userId: number;
  isSelf: boolean;
  isAnonymized: boolean;
  suspension: PostingSuspensionView | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [notice, setNotice] = useState<UserActionResult | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SuspendUserPostingInput>({
    resolver: zodResolver(SuspendUserPostingSchema),
    defaultValues: { userId, reason: "" },
  });

  function run(work: () => Promise<UserActionResult>, afterSuccess?: () => void) {
    setNotice(null);
    startTransition(async () => {
      const result = await work();
      setNotice(result);
      if (result.ok) {
        afterSuccess?.();
        router.refresh();
      }
    });
  }

  function onSuspend(values: SuspendUserPostingInput) {
    run(
      () => suspendUserPostingAction(values),
      () => reset({ userId, reason: "" }),
    );
  }

  return (
    <section
      id="posting"
      className="neo-surface flex scroll-mt-24 flex-col gap-3 border-[3px] border-neo-ink bg-white p-5 shadow-neo"
    >
      <p className="font-mono text-[10px] font-black uppercase tracking-wider text-foreground/60">
        Posting diskusi publik
      </p>

      {notice && (
        <p
          className={`flex items-start gap-2 border-2 border-neo-ink px-3 py-2 text-xs font-bold ${
            notice.ok ? "bg-white text-neo-ink" : "bg-neo-coral text-white"
          }`}
        >
          {notice.ok && <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-neo-blue" />}
          {notice.message}
        </p>
      )}

      {suspension ? (
        <>
          <p className="inline-flex items-center gap-1.5 self-start border-2 border-neo-ink bg-neo-yellow px-2 py-0.5 font-mono text-[11px] font-black">
            <Ban className="size-3.5" />
            Dibatasi sejak {suspension.since.slice(0, 16).replace("T", " ")}
            {suspension.byName ? ` oleh ${suspension.byName}` : ""}
          </p>
          {suspension.reason && (
            <p className="text-sm font-semibold whitespace-pre-wrap text-foreground/85">
              {suspension.reason}
            </p>
          )}
          <p className="text-xs font-semibold text-foreground/70">
            User ini tidak dapat membagikan catatan, membalas, menulis langsung, atau menyunting
            entri publik di diskusi soal, kata, maupun pola. Catatan privat tetap bisa ditulis.
          </p>
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(() => liftUserPostingSuspensionAction({ userId }))}
            className="neo-button self-start bg-white text-xs font-extrabold text-black"
          >
            <Undo2 className="size-4" />
            Cabut Pembatasan
          </button>
        </>
      ) : isSelf ? (
        <p className="text-xs font-semibold text-foreground/60">
          Tidak dapat membatasi posting akun sendiri.
        </p>
      ) : isAnonymized ? (
        <p className="text-xs font-semibold text-foreground/60">
          Akun ini sudah dihapus; tidak ada yang perlu dibatasi.
        </p>
      ) : (
        <form onSubmit={handleSubmit(onSuspend)} className="flex flex-col gap-2" noValidate>
          <p className="text-xs font-semibold text-foreground/70">
            Rem darurat untuk penyalahgunaan berulang tanpa menghapus akun. Konten publik yang
            sudah ada tidak berubah — takedown tetap lewat Moderasi. Alasan dapat dibaca pemilik
            akun lewat export data akunnya.
          </p>
          <Field>
            <Textarea
              rows={2}
              placeholder="Alasan, mis. spam berulang di diskusi soal setelah takedown"
              {...register("reason")}
            />
            <FieldError errors={[errors.reason]} />
          </Field>
          <button
            type="submit"
            disabled={isPending}
            className="neo-button self-start bg-neo-coral text-xs font-extrabold text-white"
          >
            <Ban className="size-4" />
            Batasi Posting
          </button>
        </form>
      )}
    </section>
  );
}
