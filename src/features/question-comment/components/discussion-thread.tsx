"use client";

import { useState } from "react";
import Link from "next/link";
import { Link2, MessageSquareReply } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DiscussionReply, DiscussionRoot } from "../queries";
import { discussionThreadHref } from "../target";
import {
  CommentAuthorLine,
  CommentAvatar,
  CommentImages,
  CommentTombstone,
} from "./comment-body";
import { ReportButton } from "@/features/report/components/report-button";
import { ReplyForm } from "./reply-form";

type ReplyTarget = { parentId: number; repliedTo: { id: number; username: string } | null } | null;

function ReplyRow({
  reply,
  currentUserId,
  onReply,
  reportEnabled,
}: {
  reply: DiscussionReply;
  currentUserId: number | null;
  onReply?: () => void;
  // Status `FEATURES.report` diteruskan sebagai props: komponen client tidak
  // boleh mengimpor `@/constants`.
  reportEnabled: boolean;
}) {
  // Melaporkan catatan sendiri tidak ada gunanya — pemiliknya punya tombol hapus,
  // dan action pun menolaknya.
  const canReport = reportEnabled && currentUserId !== reply.author.id;
  return (
    <div id={`comment-${reply.id}`} className="flex gap-2 scroll-mt-24">
      <CommentAvatar author={reply.author} />
      <div className="min-w-0 flex-1">
        <CommentAuthorLine
          displayName={reply.author.displayName}
          username={reply.author.username}
          createdAt={reply.createdAt}
          updatedAt={reply.updatedAt}
          isOwn={currentUserId === reply.author.id}
        />
        {reply.repliedTo && (
          <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
            Membalas{" "}
            <a href={`#comment-${reply.repliedTo.id}`} className="font-mono font-black hover:underline">
              @{reply.repliedTo.username}
            </a>
          </p>
        )}
        <p className="mt-1 text-sm break-words whitespace-pre-wrap">{reply.commentText}</p>
        <CommentImages images={reply.commentImages} />
        <div className="mt-1 flex flex-wrap items-center gap-3">
          {onReply && (
            <button
              type="button"
              onClick={onReply}
              className="text-xs text-muted-foreground hover:underline"
            >
              Balas
            </button>
          )}
          {canReport && (
            <ReportButton
              target={{ targetType: "COMMENT", commentId: reply.id }}
              variant="link"
            />
          )}
        </div>
      </div>
    </div>
  );
}

export function DiscussionRootCard({
  root,
  currentUserId,
  onChanged,
  showPermalink = true,
  reportEnabled,
}: {
  root: DiscussionRoot;
  currentUserId: number | null;
  onChanged: () => void;
  showPermalink?: boolean;
  reportEnabled: boolean;
}) {
  const [replyTarget, setReplyTarget] = useState<ReplyTarget>(null);

  // Thread yang root-nya sudah disembunyikan atau dihapus menjadi arsip
  // read-only: balasan lama tetap terbaca, balasan baru ditolak server.
  const canReply = root.state === "VISIBLE" && currentUserId !== null;
  // Tombstone tidak menampilkan isi apa pun, jadi tidak ada yang bisa dilaporkan.
  const canReportRoot =
    reportEnabled && root.state === "VISIBLE" && currentUserId !== root.author?.id;

  function openReply(repliedTo: { id: number; username: string } | null = null) {
    setReplyTarget({ parentId: root.id, repliedTo });
  }

  return (
    <div
      id={`comment-${root.id}`}
      className="scroll-mt-24 rounded-lg border-2 border-neo-ink/20 bg-background p-3 shadow-neo-sm"
    >
      {root.state === "VISIBLE" && root.author ? (
        <div className="flex gap-2">
          <CommentAvatar author={root.author} />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <CommentAuthorLine
                displayName={root.author.displayName}
                username={root.author.username}
                createdAt={root.createdAt}
                updatedAt={root.updatedAt}
                isOwn={currentUserId === root.author.id}
              />
              {showPermalink && (
                <Link
                  href={discussionThreadHref(root)}
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                  title="Buka halaman diskusi ini"
                >
                  <Link2 className="size-3.5" />
                </Link>
              )}
            </div>
            <p className="mt-1 text-sm break-words whitespace-pre-wrap">{root.commentText}</p>
            <CommentImages images={root.commentImages} />
          </div>
        </div>
      ) : (
        <CommentTombstone state={root.state === "DELETED" ? "DELETED" : "HIDDEN"} />
      )}

      {root.replies.length > 0 && (
        <div className="mt-3 flex flex-col gap-3 border-l-2 border-neo-ink/15 pl-3">
          {root.replies.map((reply) => (
            <ReplyRow
              key={reply.id}
              reply={reply}
              currentUserId={currentUserId}
              onReply={
                canReply
                  ? () => openReply({ id: reply.id, username: reply.author.username })
                  : undefined
              }
              reportEnabled={reportEnabled}
            />
          ))}
        </div>
      )}

      {replyTarget ? (
        <ReplyForm
          parentId={replyTarget.parentId}
          repliedTo={replyTarget.repliedTo}
          onDone={() => {
            setReplyTarget(null);
            onChanged();
          }}
          onCancel={() => setReplyTarget(null)}
        />
      ) : root.state === "VISIBLE" ? (
        // Guest tidak dapat membalas, tetapi tetap boleh melaporkan: entri inilah
        // yang ia lihat, dan menuntut akun dulu berarti penyalahgunaan dibiarkan
        // lebih lama.
        <div className="mt-1 flex flex-wrap items-center gap-3">
          {currentUserId === null ? (
            <Link
              href="/login"
              className="inline-block text-xs font-semibold text-muted-foreground hover:underline"
            >
              Masuk untuk membalas
            </Link>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() => openReply()}
            >
              <MessageSquareReply className="size-3.5" />
              Balas
            </Button>
          )}
          {canReportRoot && (
            <ReportButton
              target={{ targetType: "COMMENT", commentId: root.id }}
              variant="link"
            />
          )}
        </div>
      ) : null}
    </div>
  );
}

export function DiscussionThread({
  roots,
  currentUserId,
  onChanged,
  showPermalink = true,
  reportEnabled,
  emptyText = "Belum ada catatan yang dibagikan untuk soal ini.",
}: {
  roots: DiscussionRoot[];
  currentUserId: number | null;
  onChanged: () => void;
  showPermalink?: boolean;
  reportEnabled: boolean;
  emptyText?: string;
}) {
  if (roots.length === 0) {
    return (
      <p className="py-6 text-center text-sm font-semibold text-muted-foreground">
        {emptyText}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {roots.map((root) => (
        <DiscussionRootCard
          key={root.id}
          root={root}
          currentUserId={currentUserId}
          onChanged={onChanged}
          showPermalink={showPermalink}
          reportEnabled={reportEnabled}
        />
      ))}
    </div>
  );
}
