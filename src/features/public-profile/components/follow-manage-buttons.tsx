"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, UserMinus, X } from "lucide-react";
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
import { removeFollowerAction, respondFollowRequestAction } from "../follow-actions";

function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="border-2 border-black bg-neo-coral px-2 py-1 text-xs font-bold text-black">
      {message}
    </p>
  );
}

/** Setujui / tolak satu permintaan follow masuk. */
export function FollowRequestActions({ followerId, username }: { followerId: number; username: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function respond(accept: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await respondFollowRequestAction({ followerId, accept });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="grid justify-items-end gap-2">
      <div className="flex gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() => respond(true)}
          className="neo-button bg-neo-green text-sm"
          aria-label={`Setujui permintaan @${username}`}
        >
          <Check className="size-4" aria-hidden="true" />
          Setujui
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => respond(false)}
          className="neo-button bg-white text-sm"
          aria-label={`Tolak permintaan @${username}`}
        >
          <X className="size-4" aria-hidden="true" />
          Tolak
        </button>
      </div>
      <ErrorNote message={error} />
    </div>
  );
}

/** Pemilik akun menghapus follower dari daftar follower-nya sendiri. */
export function RemoveFollowerButton({ followerId, username }: { followerId: number; username: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function remove() {
    setError(null);
    startTransition(async () => {
      const result = await removeFollowerAction({ followerId });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="grid justify-items-end gap-2">
      <AlertDialog>
        <AlertDialogTrigger
          disabled={isPending}
          className="neo-button bg-white text-sm"
          aria-label={`Hapus @${username} dari follower`}
        >
          <UserMinus className="size-4" aria-hidden="true" />
          Hapus
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus @{username} dari follower?</AlertDialogTitle>
            <AlertDialogDescription>
              @{username} tidak diberi tahu. Bila akunmu private, ia tidak lagi dapat melihat isi
              profilmu sampai kamu menyetujui permintaannya lagi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction disabled={isPending} onClick={remove}>
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <ErrorNote message={error} />
    </div>
  );
}
