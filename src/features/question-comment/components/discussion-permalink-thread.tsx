"use client";

import { useRouter } from "next/navigation";
import type { DiscussionRoot } from "../queries";
import { DiscussionRootCard, DiscussionThread } from "./discussion-thread";

// Halaman permalink dirender di server, jadi thread-nya butuh pembungkus client
// untuk menyegarkan data setelah ada balasan baru.
export function DiscussionPermalinkThread({
  root,
  currentUserId,
  postingSuspended = false,
  reportEnabled,
}: {
  root: DiscussionRoot;
  currentUserId: number | null;
  postingSuspended?: boolean;
  reportEnabled: boolean;
}) {
  const router = useRouter();

  return (
    <DiscussionRootCard
      root={root}
      currentUserId={currentUserId}
      postingSuspended={postingSuspended}
      onChanged={() => router.refresh()}
      showPermalink={false}
      reportEnabled={reportEnabled}
    />
  );
}

// Versi daftar untuk halaman diskusi per soal: seluruh thread pada satu soal.
export function DiscussionPageThreads({
  roots,
  currentUserId,
  postingSuspended = false,
  reportEnabled,
  emptyText,
}: {
  roots: DiscussionRoot[];
  currentUserId: number | null;
  postingSuspended?: boolean;
  reportEnabled: boolean;
  emptyText?: string;
}) {
  const router = useRouter();

  return (
    <DiscussionThread
      roots={roots}
      currentUserId={currentUserId}
      postingSuspended={postingSuspended}
      onChanged={() => router.refresh()}
      showPermalink
      reportEnabled={reportEnabled}
      emptyText={emptyText}
    />
  );
}
