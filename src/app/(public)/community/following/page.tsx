import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FEATURES } from "@/constants";
import { ComposerSection } from "@/features/community/components/composer-section";
import { FeedTabs, PostFeed } from "@/features/community/components/post-feed";
import { getCommunityViewer, getFollowingFeed } from "@/features/community/queries";
import { PostCursorSchema } from "@/features/community/schemas";
import { getSession } from "@/lib/auth";
import { privateMetadata } from "@/lib/seo";

// Isinya berbeda per viewer dan dapat memuat postingan akun private yang ia
// ikuti, jadi tidak pernah diindeks.
export const metadata: Metadata = privateMetadata(
  "Mengikuti · Komunitas",
  "Postingan dari akun yang kamu ikuti.",
);

export default async function FollowingFeedPage({
  searchParams,
}: {
  searchParams: Promise<{ before?: string | string[] }>;
}) {
  if (!FEATURES.follow) notFound();

  const { before: rawBefore } = await searchParams;
  const before = PostCursorSchema.parse(typeof rawBefore === "string" ? rawBefore : undefined) || null;
  const session = await getSession();
  const viewer = await getCommunityViewer(session?.userId ?? null);

  return (
    <div className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-6 px-4 py-10">
      <header>
        <h1 className="text-4xl sm:text-6xl">Komunitas</h1>
        <p className="mt-3 max-w-2xl text-lg text-black/70">
          Postinganmu dan postingan dari akun yang kamu ikuti.
        </p>
      </header>

      <FeedTabs active="following" followEnabled />

      {viewer.viewerId === null ? (
        <section className="neo-surface grid justify-items-start gap-3 bg-neo-paper p-6">
          <p className="font-semibold">Masuk untuk melihat postingan dari akun yang kamu ikuti.</p>
          <Link href="/login?next=%2Fcommunity%2Ffollowing" className="neo-button bg-neo-blue text-sm">
            Masuk
          </Link>
        </section>
      ) : (
        <>
          {!before ? <ComposerSection viewer={viewer} nextPath="/community/following" /> : null}
          <PostFeed
            page={await getFollowingFeed(viewer.viewerId, before)}
            basePath="/community/following"
            currentUserId={viewer.viewerId}
            reportEnabled={FEATURES.report}
            postingSuspended={viewer.postingSuspended}
            emptyText="Belum ada postingan dari akun yang kamu ikuti. Temukan orang untuk diikuti di feed Semua."
          />
        </>
      )}
    </div>
  );
}
