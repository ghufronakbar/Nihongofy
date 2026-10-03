"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FollowStatus } from "@prisma/client";
import { Clock3, UserCheck, UserPlus } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { setFollowAction } from "../follow-actions";

export function FollowButton({
  username,
  initialStatus,
  isPrivate,
  isAuthenticated,
}: {
  username: string;
  initialStatus: FollowStatus | null;
  isPrivate: boolean;
  isAuthenticated: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (!isAuthenticated) {
    return (
      <Link
        href={`/login?next=${encodeURIComponent(`/u/${username}`)}`}
        className="neo-button bg-neo-blue text-sm"
      >
        <UserPlus className="size-4" aria-hidden="true" />
        {isPrivate ? "Minta mengikuti" : "Ikuti"}
      </Link>
    );
  }

  function submit(following: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await setFollowAction({ username, following });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setStatus(result.status);
      // Mengikuti akun public atau berhenti mengikuti akun private mengubah isi
      // halaman (jumlah follower, kartu private), jadi halaman dirender ulang.
      router.refresh();
    });
  }

  function onClick() {
    if (status === null) {
      submit(true);
    } else if (status === "ACCEPTED" && isPrivate) {
      // Berhenti mengikuti akun private menutup aksesnya lagi; minta konfirmasi.
      setConfirmOpen(true);
    } else {
      submit(false);
    }
  }

  const label =
    status === "ACCEPTED" ? "Mengikuti" : status === "PENDING" ? "Diminta" : isPrivate ? "Minta mengikuti" : "Ikuti";
  const Icon = status === "ACCEPTED" ? UserCheck : status === "PENDING" ? Clock3 : UserPlus;
  const title =
    status === "ACCEPTED"
      ? "Berhenti mengikuti"
      : status === "PENDING"
        ? "Batalkan permintaan mengikuti"
        : undefined;

  return (
    <div className="grid justify-items-start gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={isPending}
        title={title}
        aria-pressed={status !== null}
        className={cn("neo-button text-sm", status === null ? "bg-neo-blue" : "bg-white")}
      >
        <Icon className="size-4" aria-hidden="true" />
        {isPending ? "Memproses..." : label}
      </button>
      {error ? (
        <p role="alert" className="border-2 border-black bg-neo-coral px-2 py-1 text-sm font-bold text-black">
          {error}
        </p>
      ) : null}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Berhenti mengikuti @{username}?</AlertDialogTitle>
            <AlertDialogDescription>
              Akun ini private. Setelah berhenti mengikuti, kamu perlu mengirim permintaan lagi dan
              menunggu persetujuan untuk melihat isinya.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              onClick={() => {
                setConfirmOpen(false);
                submit(false);
              }}
            >
              Berhenti mengikuti
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
