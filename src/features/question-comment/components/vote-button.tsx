"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { voteQuestionCommentAction } from "../actions";

/**
 * - `active`: viewer login dan boleh memberi/menarik suara.
 * - `own`: catatan viewer sendiri — jumlah tampil, tidak bisa diklik.
 * - `guest`: jumlah tampil, klik mengarah ke login.
 * - `readonly`: thread arsip (root sudah tombstone) — jumlah tampil bila ada.
 */
export type VoteButtonMode = "active" | "own" | "guest" | "readonly";

const baseClass =
  "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold tabular-nums";

/**
 * Tombol suara "membantu". Pasang `key` yang memuat jumlah dari server supaya
 * state lokalnya ikut diganti saat thread dimuat ulang.
 */
export function VoteButton({
  commentId,
  voteCount,
  viewerVoted,
  mode,
}: {
  commentId: number;
  voteCount: number;
  viewerVoted: boolean;
  mode: VoteButtonMode;
}) {
  const [state, setState] = useState({ voteCount, viewerVoted });
  const [isPending, startTransition] = useTransition();

  const label = `${state.voteCount} orang merasa ini membantu`;
  const content = (
    <>
      <ThumbsUp className={cn("size-3.5", state.viewerVoted && "fill-current")} aria-hidden />
      {state.voteCount > 0 ? state.voteCount : null}
      <span className="sr-only">{label}</span>
    </>
  );

  if (mode === "guest") {
    return (
      <Link
        href="/login"
        title="Masuk untuk menandai membantu"
        className={cn(baseClass, "text-muted-foreground hover:underline")}
      >
        {content}
        <span>Membantu</span>
      </Link>
    );
  }

  if (mode === "readonly" || mode === "own") {
    if (mode === "readonly" && state.voteCount === 0) return null;
    return (
      <span
        title={mode === "own" ? "Catatan Anda sendiri" : label}
        className={cn(baseClass, "text-muted-foreground")}
      >
        {content}
      </span>
    );
  }

  function toggle() {
    const next = !state.viewerVoted;
    const previous = state;
    // Optimistis; dikoreksi dengan jumlah dari server, atau dikembalikan bila ditolak.
    setState({ viewerVoted: next, voteCount: Math.max(0, state.voteCount + (next ? 1 : -1)) });
    startTransition(async () => {
      const result = await voteQuestionCommentAction({ commentId, voted: next });
      if (!result.ok) {
        setState(previous);
        toast.error(result.message);
        return;
      }
      setState({ viewerVoted: result.voted, voteCount: result.voteCount });
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isPending}
      aria-pressed={state.viewerVoted}
      title={state.viewerVoted ? "Tarik tanda membantu" : "Tandai membantu"}
      className={cn(
        baseClass,
        "hover:bg-muted disabled:opacity-60",
        state.viewerVoted ? "text-neo-blue" : "text-muted-foreground",
      )}
    >
      {content}
      <span>Membantu</span>
    </button>
  );
}
