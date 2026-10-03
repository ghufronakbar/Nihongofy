import Link from "next/link";
import { Ban, ExternalLink, Heart, ImageIcon, LockKeyhole, MessageCircle } from "lucide-react";
import type { ModerationStateFilter } from "../schemas";
import type { PostModerationEntry } from "../queries";
import { PostModerationActions } from "./post-moderation-actions";

const STATE_BADGE: Record<PostModerationEntry["state"], { label: string; className: string }> = {
  VISIBLE: { label: "Tampil", className: "bg-neo-paper" },
  REMOVED_BY_OWNER: { label: "Dihapus pemilik", className: "bg-white" },
  TAKEN_DOWN: { label: "Takedown admin", className: "bg-neo-coral text-white" },
};

/** Antrean postingan komunitas di /admin/moderation?kind=posts. */
export function PostModerationList({
  entries,
  state,
}: {
  entries: PostModerationEntry[];
  state: ModerationStateFilter;
}) {
  if (entries.length === 0) {
    return (
      <div className="neo-surface border-[3px] border-neo-ink bg-white p-6 text-sm font-semibold text-foreground/70 shadow-neo">
        Tidak ada postingan yang cocok.
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {entries.map((entry) => {
        const badge = STATE_BADGE[entry.state];
        return (
          <li
            key={entry.id}
            className="neo-surface flex flex-col gap-3 border-[3px] border-neo-ink bg-white p-4 shadow-neo"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center border-2 border-neo-ink bg-white px-2 py-0.5 font-mono text-[10px] font-black uppercase shadow-neo-sm">
                Postingan #{entry.id}
              </span>
              <span
                className={`inline-flex items-center border-2 border-neo-ink px-2 py-0.5 font-mono text-[10px] font-black uppercase shadow-neo-sm ${badge.className}`}
              >
                {badge.label}
              </span>
              {entry.user.profileVisibility === "PRIVATE" && (
                <span
                  title="Akun private: postingan hanya terlihat pemilik dan follower yang disetujui"
                  className="inline-flex items-center gap-1 border-2 border-neo-ink bg-white px-1.5 py-0 font-mono text-[10px] font-black"
                >
                  <LockKeyhole className="size-3" />
                  private
                </span>
              )}
              <Link
                href={`/admin/moderation?kind=posts&state=${state}&user=${entry.user.id}`}
                className="text-xs font-black text-neo-ink underline-offset-4 hover:underline"
              >
                {entry.user.displayName}
              </Link>
              <span className="font-mono text-[11px] text-foreground/50">
                @{entry.user.username} · #{entry.user.id}
              </span>
              <Link
                href={`/admin/user/${entry.user.id}#posting`}
                title={
                  entry.user.postingSuspendedAt
                    ? "Posting user ini dibatasi — kelola"
                    : "Batasi posting user ini"
                }
                className={`inline-flex items-center gap-1 border-2 border-neo-ink px-1.5 py-0 font-mono text-[10px] font-black ${
                  entry.user.postingSuspendedAt ? "bg-neo-yellow" : "bg-white text-foreground/70"
                }`}
              >
                <Ban className="size-3" />
                {entry.user.postingSuspendedAt ? "dibatasi" : "batasi"}
              </Link>
              <span className="ml-auto inline-flex items-center gap-3 font-mono text-[11px] font-bold text-foreground/60">
                <span className="inline-flex items-center gap-1" title="Like (tidak terhapus oleh takedown)">
                  <Heart className="size-3" />
                  {entry.likeCount}
                </span>
                <span className="inline-flex items-center gap-1" title="Komentar">
                  <MessageCircle className="size-3" />
                  {entry.commentCount}
                </span>
                {entry.createdAt.toISOString().slice(0, 16).replace("T", " ")}
              </span>
            </div>

            <p className="text-sm font-semibold whitespace-pre-wrap text-foreground/85">{entry.text}</p>

            {entry.images.length > 0 && (
              <p className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold text-foreground/60">
                <ImageIcon className="size-3.5" />
                {entry.images.length} lampiran gambar — file di storage tidak ikut terhapus saat takedown
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3 border-t-2 border-neo-ink/15 pt-3">
              <Link
                href={`/post/${entry.id}`}
                target="_blank"
                className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-foreground/60 hover:text-neo-blue"
              >
                <ExternalLink className="size-3" />
                Lihat postingan
              </Link>
              {entry.editedAt && (
                <span className="font-mono text-[11px] font-bold text-foreground/50">disunting</span>
              )}
              {entry.deletedBy && (
                <span className="font-mono text-[11px] font-bold text-foreground/50">
                  dihapus oleh {entry.deletedBy.displayName}
                </span>
              )}
              <div className="ml-auto">
                <PostModerationActions postId={entry.id} state={entry.state} canRestore={entry.canRestore} />
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
