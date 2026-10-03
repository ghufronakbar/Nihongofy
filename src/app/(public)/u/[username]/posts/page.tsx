import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { FEATURES } from "@/constants";
import { PostFeed } from "@/features/community/components/post-feed";
import { getUserPosts } from "@/features/community/queries";
import { PostCursorSchema } from "@/features/community/schemas";
import { canViewProfileContent } from "@/features/public-profile/access";
import { getViewerFollowStatus } from "@/features/public-profile/follow-queries";
import { resolveProfileParam } from "@/features/public-profile/queries";
import { UsernameParamSchema } from "@/features/public-profile/schemas";
import { isPostingSuspended } from "@/features/question-comment/queries";
import { getSession } from "@/lib/auth";
import { privateMetadata } from "@/lib/seo";

type Props = {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ before?: string | string[] }>;
};

// Daftar penuh tidak diindeks: postingan sudah punya permalink masing-masing,
// dan halaman profilnya memuat halaman pertama.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const parsed = UsernameParamSchema.safeParse((await params).username);
  const username = parsed.success ? parsed.data.toLowerCase() : null;
  return privateMetadata(
    username ? `Postingan @${username}` : "Postingan",
    username ? `Semua postingan @${username} di Nihongofy.` : "Postingan di Nihongofy.",
  );
}

export default async function UserPostsPage({ params, searchParams }: Props) {
  if (!FEATURES.community) notFound();

  const [{ username }, { before: rawBefore }] = await Promise.all([params, searchParams]);
  const resolved = await resolveProfileParam(username);
  if (resolved.kind === "redirect") permanentRedirect(`/u/${resolved.username}/posts`);
  if (resolved.kind === "missing") notFound();

  const { owner } = resolved;
  const session = await getSession();
  const viewerId = session?.userId ?? null;
  const viewerStatus = await getViewerFollowStatus(viewerId, owner.id);
  const canView = canViewProfileContent(owner, viewerId, viewerStatus);
  const before = PostCursorSchema.parse(typeof rawBefore === "string" ? rawBefore : undefined) || null;

  return (
    <div className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-6 px-4 py-10">
      <Link
        href={`/u/${owner.username}`}
        className="inline-flex w-fit items-center gap-2 font-bold underline decoration-2 underline-offset-4"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {owner.displayName}
      </Link>
      <h1 className="text-4xl break-words sm:text-5xl">Postingan @{owner.username}</h1>

      {canView ? (
        <PostFeed
          page={await getUserPosts(owner.id, before, viewerId)}
          basePath={`/u/${owner.username}/posts`}
          currentUserId={viewerId}
          reportEnabled={FEATURES.report}
          postingSuspended={await isPostingSuspended(viewerId)}
          emptyText={`@${owner.username} belum memposting apa pun.`}
        />
      ) : (
        <section className="neo-surface grid justify-items-center gap-3 bg-white p-8 text-center">
          <LockKeyhole className="size-8" aria-hidden="true" />
          <h2 className="text-2xl">Akun ini private</h2>
          <p className="max-w-md font-semibold text-black/65">
            Postingan @{owner.username} hanya terlihat oleh pemiliknya dan follower yang disetujui.
          </p>
        </section>
      )}
    </div>
  );
}
