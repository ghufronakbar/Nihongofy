import Link from "next/link";
import { cn } from "@/lib/utils";
import type { PostPage } from "../queries";
import { PostCard } from "./post-card";

/** Daftar postingan beserta tautan halaman berikutnya (`?before=`). */
export function PostFeed({
  page,
  basePath,
  currentUserId,
  reportEnabled,
  postingSuspended,
  emptyText,
}: {
  page: PostPage;
  basePath: string;
  currentUserId: number | null;
  reportEnabled: boolean;
  postingSuspended: boolean;
  emptyText: string;
}) {
  if (page.posts.length === 0) {
    return <p className="neo-surface bg-white p-8 text-center font-semibold text-black/60">{emptyText}</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      {page.posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          currentUserId={currentUserId}
          reportEnabled={reportEnabled}
          postingSuspended={postingSuspended}
        />
      ))}
      {page.nextCursor !== null ? (
        <Link href={`${basePath}?before=${page.nextCursor}`} className="neo-button w-fit bg-white text-sm">
          Muat postingan sebelumnya
        </Link>
      ) : null}
    </div>
  );
}

export function FeedTabs({ active, followEnabled }: { active: "all" | "following"; followEnabled: boolean }) {
  if (!followEnabled) return null;
  const tabs = [
    { key: "all", href: "/community", label: "Semua" },
    { key: "following", href: "/community/following", label: "Mengikuti" },
  ] as const;

  return (
    <nav aria-label="Feed komunitas" className="flex gap-2">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={tab.key === active ? "page" : undefined}
          className={cn(
            "inline-flex min-h-11 items-center border-[3px] border-black px-4 py-2 text-sm font-black shadow-neo-sm",
            tab.key === active ? "bg-neo-yellow" : "bg-white",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
