"use client";

import { useRouter } from "next/navigation";
import type { CommentTarget } from "../target";
import { NewPublicNoteForm } from "./discussion-sheet";
import { PostingSuspendedNotice } from "./posting-suspended-notice";

/**
 * Form tulis langsung ke diskusi publik di halaman penuh sebuah target (kata,
 * pola); halaman di-refresh setelahnya supaya thread yang dirender server ikut
 * diperbarui.
 */
export function DiscussionComposer({
  target,
  placeholder,
  postingSuspended = false,
}: {
  target: CommentTarget;
  placeholder: string;
  /** Viewer di-suspend admin: form diganti keterangan. */
  postingSuspended?: boolean;
}) {
  const router = useRouter();

  if (postingSuspended) return <PostingSuspendedNotice />;

  return (
    <NewPublicNoteForm target={target} placeholder={placeholder} onDone={() => router.refresh()} />
  );
}
