import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { JsonLd } from "@/components/seo/json-ld";
import { FEATURES } from "@/constants";
import { PostCard } from "@/features/community/components/post-card";
import { getCommunityViewer, getPostAccess, getPostDetail } from "@/features/community/queries";
import { PostIdParamSchema } from "@/features/community/schemas";
import { DiscussionComposer } from "@/features/question-comment/components/discussion-composer";
import { DiscussionPageThreads } from "@/features/question-comment/components/discussion-permalink-thread";
import { getDiscussion, withViewerVotes } from "@/features/question-comment/queries";
import { getSession } from "@/lib/auth";
import { socialMediaPostingJsonLd } from "@/lib/json-ld";
import { pageMetadata, privateMetadata } from "@/lib/seo";

type Props = { params: Promise<{ id: string }> };

async function postIdOf(params: Props["params"]) {
  const parsed = PostIdParamSchema.safeParse((await params).id);
  return parsed.success ? parsed.data : null;
}

function excerpt(text: string, max = 155) {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1)}…`;
}

// Metadata tidak bergantung viewer: halaman yang dinilai adalah yang dilihat
// crawler (guest). Postingan akun private selalu noindex, termasuk bagi follower.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const postId = await postIdOf(params);
  const access = postId ? await getPostAccess(postId, null) : null;
  if (!postId || !access) return privateMetadata("Postingan tidak ditemukan", "Postingan ini tidak tersedia.");
  if (!access.canView) {
    return pageMetadata({
      title: `Postingan @${access.authorUsername}`,
      description: "Postingan ini dari akun private.",
      path: `/post/${postId}`,
      noindex: true,
    });
  }

  const post = await getPostDetail(postId, null);
  if (!post) return privateMetadata("Postingan tidak ditemukan", "Postingan ini tidak tersedia.");
  if (post.state === "DELETED" || !post.author || post.text === null) {
    // Tombstone hanya ada demi komentar di bawahnya; tidak ada isi yang layak dicari.
    return pageMetadata({
      title: "Postingan dihapus",
      description: "Postingan ini telah dihapus penulisnya.",
      path: `/post/${postId}`,
      noindex: "follow",
    });
  }

  return pageMetadata({
    title: `${post.author.displayName} (@${post.author.username}): "${excerpt(post.text, 60)}"`,
    description: excerpt(post.text),
    path: `/post/${postId}`,
    ogTitle: `${post.author.displayName} di Nihongofy`,
    article: { publishedTime: post.createdAt.toISOString(), authors: [post.author.displayName] },
  });
}

export default async function PostPage({ params }: Props) {
  const postId = await postIdOf(params);
  if (!postId) notFound();

  const session = await getSession();
  const viewerId = session?.userId ?? null;
  const access = await getPostAccess(postId, viewerId);
  if (!access) notFound();

  if (!access.canView) {
    // Postingan akun private tetap ada, tetapi isinya — dan komentar di bawahnya —
    // tidak pernah dikirim ke viewer yang bukan pemilik atau follower disetujui.
    return (
      <div className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-6 px-4 py-10">
        <section className="neo-surface grid justify-items-center gap-3 bg-white p-8 text-center sm:p-12">
          <span className="grid size-14 place-items-center border-[3px] border-black bg-neo-yellow shadow-neo-sm">
            <LockKeyhole className="size-7" aria-hidden="true" />
          </span>
          <h1 className="text-3xl">Postingan ini dari akun private</h1>
          <p className="max-w-md font-semibold text-black/65">
            Hanya @{access.authorUsername} dan follower yang disetujui yang dapat melihatnya.
          </p>
          <Link href={`/u/${access.authorUsername}`} className="neo-button bg-neo-blue text-sm">
            Lihat profil @{access.authorUsername}
          </Link>
        </section>
      </div>
    );
  }

  const target = { type: "post" as const, postId };
  const [post, viewer, roots] = await Promise.all([
    getPostDetail(postId, viewerId),
    getCommunityViewer(viewerId),
    getDiscussion(target),
  ]);
  if (!post) notFound();
  const threads = await withViewerVotes(roots, viewerId);
  const archived = post.state === "DELETED";

  return (
    <div className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-6 px-4 py-10">
      {post.state === "VISIBLE" && post.author && post.text !== null ? (
        <JsonLd
          data={socialMediaPostingJsonLd({
            path: `/post/${post.id}`,
            text: post.text,
            authorName: post.author.displayName,
            authorPath: post.author.profilePath,
            createdAt: post.createdAt,
            editedAt: post.editedAt,
            images: post.images,
            likeCount: post.likeCount,
            commentCount: post.commentCount,
          })}
        />
      ) : null}
      <Link
        href="/community"
        className="inline-flex w-fit items-center gap-2 font-bold underline decoration-2 underline-offset-4"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Komunitas
      </Link>

      <PostCard
        post={post}
        currentUserId={viewerId}
        reportEnabled={FEATURES.report}
        postingSuspended={viewer.postingSuspended}
        isPermalink
      />

      <section id="komentar" aria-labelledby="komentar-heading" className="grid scroll-mt-24 gap-4">
        <h2 id="komentar-heading" className="text-2xl">
          Komentar
        </h2>
        {archived ? null : viewerId === null ? (
          <Link
            href={`/login?next=${encodeURIComponent(`/post/${postId}`)}`}
            className="text-sm font-bold underline decoration-2 underline-offset-4"
          >
            Masuk untuk berkomentar
          </Link>
        ) : (
          <DiscussionComposer
            target={target}
            placeholder="Tulis komentar..."
            postingSuspended={viewer.postingSuspended}
          />
        )}
        <DiscussionPageThreads
          roots={threads}
          currentUserId={viewerId}
          postingSuspended={viewer.postingSuspended}
          reportEnabled={FEATURES.report}
          emptyText="Belum ada komentar."
          archived={archived}
        />
      </section>
    </div>
  );
}
