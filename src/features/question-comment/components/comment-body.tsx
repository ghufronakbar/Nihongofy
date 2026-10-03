"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { EyeOff, Trash2 } from "lucide-react";
import { ImageWithLightbox } from "@/components/image-with-lightbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { DiscussionAuthor, DiscussionRootState } from "../queries";

export function CommentAvatar({
  author,
  size = "sm",
}: {
  author: Pick<DiscussionAuthor, "displayName" | "avatarUrl">;
  size?: "sm" | "default";
}) {
  return (
    <Avatar size={size}>
      {author.avatarUrl && <AvatarImage src={author.avatarUrl} alt="" />}
      <AvatarFallback>{author.displayName.slice(0, 1).toUpperCase()}</AvatarFallback>
    </Avatar>
  );
}

export function CommentAuthorLine({
  displayName,
  username,
  profileHref,
  createdAt,
  updatedAt,
  isOwn,
  badge,
}: {
  displayName: string;
  // Handle publik. displayName tidak unik, jadi ini yang membedakan dua orang
  // dengan nama tampilan sama.
  username?: string;
  // Profil publik penulis (`DiscussionAuthor.profilePath`); null/undefined
  // berarti nama tampil sebagai teks biasa.
  profileHref?: string | null;
  createdAt: Date;
  updatedAt?: Date | null;
  isOwn?: boolean;
  badge?: React.ReactNode;
}) {
  const wasEdited = Boolean(updatedAt && updatedAt.getTime() !== createdAt.getTime());

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {profileHref ? (
        <Link href={profileHref} className="group/author inline-flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-medium group-hover/author:underline">{displayName}</span>
          {username && (
            <span className="font-mono text-xs text-muted-foreground">@{username}</span>
          )}
        </Link>
      ) : (
        <>
          <span className="text-sm font-medium">{displayName}</span>
          {username && (
            <span className="font-mono text-xs text-muted-foreground">@{username}</span>
          )}
        </>
      )}
      {isOwn && (
        <span className="rounded border border-neo-ink/30 px-1 font-mono text-[10px] font-black uppercase text-foreground/60">
          Anda
        </span>
      )}
      {badge}
      <span className="text-xs text-muted-foreground">
        {formatDistanceToNow(createdAt, { addSuffix: true, locale: idLocale })}
        {wasEdited && " · diedit"}
      </span>
    </div>
  );
}

export function CommentImages({ images }: { images: string[] }) {
  if (images.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {images.map((url) => (
        <ImageWithLightbox
          key={url}
          src={url}
          className="size-16 rounded-md border object-cover"
        />
      ))}
    </div>
  );
}

// Root yang dihapus atau disembunyikan pemiliknya. Teks, gambar, dan identitas
// penulisnya memang tidak ikut dikirim dari server, jadi di sini tidak ada apa
// pun yang perlu disembunyikan — yang tersisa hanya keterangan status supaya
// balasan di bawahnya tetap punya konteks.
export function CommentTombstone({ state }: { state: Exclude<DiscussionRootState, "VISIBLE"> }) {
  const Icon = state === "DELETED" ? Trash2 : EyeOff;
  const label =
    state === "DELETED"
      ? "Catatan ini telah dihapus penulisnya."
      : "Catatan ini disembunyikan penulisnya.";

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border-2 border-dashed border-neo-ink/25",
        "bg-muted/40 px-3 py-2 text-xs font-semibold text-muted-foreground",
      )}
    >
      <Icon className="size-3.5 shrink-0" />
      <span>{label} Balasan di bawah tetap ditampilkan.</span>
    </div>
  );
}
