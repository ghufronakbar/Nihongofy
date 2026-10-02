"use client";

import { useRouter } from "next/navigation";
import type { CommentTarget } from "../target";
import { NewPublicNoteForm } from "./discussion-sheet";

/**
 * Form tulis langsung ke diskusi publik di halaman penuh sebuah target (kata,
 * pola); halaman di-refresh setelahnya supaya thread yang dirender server ikut
 * diperbarui.
 */
export function DiscussionComposer({
  target,
  placeholder,
}: {
  target: CommentTarget;
  placeholder: string;
}) {
  const router = useRouter();

  return (
    <NewPublicNoteForm target={target} placeholder={placeholder} onDone={() => router.refresh()} />
  );
}
