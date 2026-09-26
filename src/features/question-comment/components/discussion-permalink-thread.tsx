"use client";

import { useRouter } from "next/navigation";
import type { DiscussionRoot } from "../queries";
import { DiscussionRootCard, DiscussionThread } from "./discussion-thread";

// Halaman permalink dirender di server, jadi thread-nya butuh pembungkus client
// untuk menyegarkan data setelah ada balasan baru.
export function DiscussionPermalinkThread({
  root,
  currentUserId,
  reportEnabled,
}: {
  root: DiscussionRoot;
  currentUserId: number | null;
  reportEnabled: boolean;
}) {
  const router = useRouter();

  return (
    <DiscussionRootCard
      root={root}
      currentUserId={currentUserId}
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
  reportEnabled,
}: {
  roots: DiscussionRoot[];
  currentUserId: number | null;
  reportEnabled: boolean;
}) {
  const router = useRouter();

  return (
    <DiscussionThread
      roots={roots}
      currentUserId={currentUserId}
      onChanged={() => router.refresh()}
      showPermalink
      reportEnabled={reportEnabled}
    />
  );
}
