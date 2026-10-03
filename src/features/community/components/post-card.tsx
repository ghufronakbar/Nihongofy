"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageCircle, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ImageWithLightbox } from "@/components/image-with-lightbox";
import { ReportButton } from "@/features/report/components/report-button";
import {
  CommentAuthorLine,
  CommentAvatar,
} from "@/features/question-comment/components/comment-body";
import { deletePostAction } from "../actions";
import type { PostCardData } from "../queries";
import { LikeButton } from "./like-button";
import { PostComposer } from "./post-composer";

export function PostCard({
  post,
  currentUserId,
  reportEnabled,
  postingSuspended,
  isPermalink = false,
}: {
  post: PostCardData;
  currentUserId: number | null;
  // Komponen client tidak boleh mengimpor `@/constants`; status flag dikirim lewat props.
  reportEnabled: boolean;
  postingSuspended: boolean;
  /** Di halaman permalink: tanpa tautan ke dirinya sendiri, teks tidak dipotong. */
  isPermalink?: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const href = `/post/${post.id}`;

  if (post.state === "DELETED" || !post.author || post.text === null) {
    return (
      <article className="neo-surface border-dashed bg-muted/40 p-5 text-sm font-semibold text-black/60">
        Postingan ini telah dihapus. Komentar di bawahnya tetap ditampilkan.
      </article>
    );
  }

  const author = post.author;
  const isOwn = currentUserId === author.id;
  const loginHref = `/login?next=${encodeURIComponent(href)}`;

  function remove() {
    startTransition(async () => {
      const result = await deletePostAction({ postId: post.id });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Postingan dihapus.");
      if (isPermalink) router.push("/community");
      else router.refresh();
    });
  }

  return (
    <article id={`post-${post.id}`} className="neo-surface grid gap-3 bg-white p-5">
      <header className="flex items-start gap-3">
        <CommentAvatar author={author} size="default" />
        <div className="min-w-0 flex-1">
          <CommentAuthorLine
            displayName={author.displayName}
            username={author.username}
            profileHref={author.profilePath}
            createdAt={post.createdAt}
            updatedAt={post.editedAt}
            isOwn={isOwn}
          />
          {!isPermalink ? (
            <Link href={href} className="font-mono text-[11px] font-bold text-black/50 hover:underline">
              Lihat postingan
            </Link>
          ) : null}
        </div>
      </header>

      {editing ? (
        <PostComposer
          postId={post.id}
          initial={{ text: post.text, images: post.images }}
          onDone={() => setEditing(false)}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <>
          <p className="text-base leading-7 break-words whitespace-pre-line text-black/90">{post.text}</p>
          {post.images.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {post.images.map((url) => (
                <ImageWithLightbox
                  key={url}
                  src={url}
                  className="aspect-square w-full rounded-md border-2 border-black object-cover"
                />
              ))}
            </div>
          ) : null}
        </>
      )}

      <footer className="flex flex-wrap items-center gap-1 border-t-2 border-black/10 pt-2">
        <LikeButton
          key={`${post.id}-${post.likeCount}-${post.viewerLiked}`}
          postId={post.id}
          likeCount={post.likeCount}
          viewerLiked={post.viewerLiked}
          mode={currentUserId === null ? "guest" : isOwn ? "own" : "active"}
          loginHref={loginHref}
        />
        {isPermalink ? (
          <span className="inline-flex min-h-9 items-center gap-1.5 px-2 text-sm font-bold text-black/70">
            <MessageCircle className="size-4" aria-hidden="true" />
            {post.commentCount} komentar
          </span>
        ) : (
          <Link
            href={`${href}#komentar`}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-md border-2 border-transparent px-2 text-sm font-bold text-black/70 hover:border-black"
          >
            <MessageCircle className="size-4" aria-hidden="true" />
            {post.commentCount > 0 ? `${post.commentCount} komentar` : "Komentar"}
          </Link>
        )}

        <div className="ml-auto flex items-center gap-1">
          {isOwn && !editing ? (
            <>
              {!postingSuspended ? (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-xs font-bold text-black/60 hover:underline"
                >
                  <Pencil className="size-3.5" aria-hidden="true" />
                  Sunting
                </button>
              ) : null}
              <AlertDialog>
                <AlertDialogTrigger
                  disabled={isPending}
                  className="inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-xs font-bold text-black/60 hover:underline"
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                  Hapus
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Hapus postingan ini?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Postingan hilang dari feed dan profilmu. Bila sudah ada komentar, postingan
                      diganti keterangan &quot;telah dihapus&quot; dan komentar orang lain tetap
                      ditampilkan.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Batal</AlertDialogCancel>
                    <AlertDialogAction disabled={isPending} onClick={remove}>
                      Hapus
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          ) : null}
          {reportEnabled && !isOwn ? (
            <ReportButton target={{ targetType: "POST", postId: post.id }} variant="link" />
          ) : null}
        </div>
      </footer>
    </article>
  );
}
