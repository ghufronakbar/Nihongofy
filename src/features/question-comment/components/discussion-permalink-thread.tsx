"use client";

import { useRouter } from "next/navigation";
import type { DiscussionRoot } from "../queries";
import { DiscussionRootCard } from "./discussion-thread";

// Halaman permalink dirender di server, jadi thread-nya butuh pembungkus client
// untuk menyegarkan data setelah ada balasan baru.
export function DiscussionPermalinkThread({
  root,
  currentUserId,
}: {
  root: DiscussionRoot;
  currentUserId: number | null;
}) {
  const router = useRouter();

  return (
    <DiscussionRootCard
      root={root}
      currentUserId={currentUserId}
      onChanged={() => router.refresh()}
      showPermalink={false}
    />
  );
}
