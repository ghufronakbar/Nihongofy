"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { likePostAction } from "../actions";

/**
 * - `active`: viewer login dan boleh menyukai/menarik like.
 * - `own`: postingan viewer sendiri — jumlah tampil, tidak bisa diklik.
 * - `guest`: jumlah tampil, klik mengarah ke login.
 */
export type LikeButtonMode = "active" | "own" | "guest";

const baseClass =
  "inline-flex min-h-9 items-center gap-1.5 rounded-md border-2 border-transparent px-2 text-sm font-bold tabular-nums";

/** Pasang `key` yang memuat jumlah dari server supaya state lokal ikut diganti saat dimuat ulang. */
export function LikeButton({
  postId,
  likeCount,
  viewerLiked,
  mode,
  loginHref,
}: {
  postId: number;
  likeCount: number;
  viewerLiked: boolean;
  mode: LikeButtonMode;
  loginHref: string;
}) {
  const [state, setState] = useState({ likeCount, viewerLiked });
  const [isPending, startTransition] = useTransition();

  const content = (
    <>
      <Heart className={cn("size-4", state.viewerLiked && "fill-neo-coral text-neo-coral")} aria-hidden />
      {state.likeCount > 0 ? state.likeCount : null}
      <span className="sr-only">{`${state.likeCount} suka`}</span>
    </>
  );

  if (mode === "guest") {
    return (
      <Link href={loginHref} className={cn(baseClass, "hover:border-black")} title="Masuk untuk menyukai">
        {content}
      </Link>
    );
  }

  if (mode === "own") {
    return (
      <span className={cn(baseClass, "text-black/60")} title="Postingan Anda">
        {content}
      </span>
    );
  }

  function toggle() {
    const next = !state.viewerLiked;
    const previous = state;
    // Optimistis: ditarik kembali bila server menolak.
    setState({ viewerLiked: next, likeCount: Math.max(0, state.likeCount + (next ? 1 : -1)) });
    startTransition(async () => {
      const result = await likePostAction({ postId, liked: next });
      if (!result.ok) {
        setState(previous);
        toast.error(result.message);
        return;
      }
      setState({ viewerLiked: result.liked, likeCount: result.likeCount });
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isPending}
      aria-pressed={state.viewerLiked}
      title={state.viewerLiked ? "Batal suka" : "Suka"}
      className={cn(baseClass, "hover:border-black")}
    >
      {content}
    </button>
  );
}
