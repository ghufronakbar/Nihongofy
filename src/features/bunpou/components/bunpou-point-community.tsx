import Link from "next/link";
import { MessagesSquare, NotebookPen } from "lucide-react";
import { CommentItem } from "@/features/question-comment/components/comment-item";
import { DiscussionComposer } from "@/features/question-comment/components/discussion-composer";
import { DiscussionPageThreads } from "@/features/question-comment/components/discussion-permalink-thread";
import { QuestionCommentForm } from "@/features/question-comment/components/question-comment-form";
import type { DiscussionRoot, OwnNote } from "@/features/question-comment/queries";

/**
 * Catatan pribadi dan diskusi publik untuk satu pola, memakai modul catatan soal
 * (`QuestionComment` dengan target `bunpouPointId`). Keduanya dirender server:
 * thread publik sengaja ikut di HTML halaman supaya terindeks mesin pencari
 * bersama isi polanya.
 */
export type BunpouCommunity = {
  pointId: number;
  pointKey: string;
  /** Null untuk guest. */
  viewerId: number | null;
  /** Viewer di-suspend admin: form diskusi diganti keterangan. */
  postingSuspended: boolean;
  notes: OwnNote[];
  roots: DiscussionRoot[];
  entryCount: number;
  reportEnabled: boolean;
};

function loginHref(pointKey: string, anchor: string) {
  return `/login?next=${encodeURIComponent(`/bunpou/${pointKey}#${anchor}`)}`;
}

export function BunpouOwnNotes({ community }: { community: BunpouCommunity }) {
  const target = { type: "bunpou" as const, bunpouPointId: community.pointId };

  return (
    <section id="catatanku" className="neo-surface flex scroll-mt-24 flex-col gap-3 p-5" aria-labelledby="catatanku-title">
      <h2 id="catatanku-title" className="inline-flex items-center gap-1.5 text-lg font-black">
        <NotebookPen className="size-5" aria-hidden /> Catatanku
      </h2>
      {community.viewerId === null ? (
        <p className="text-sm font-semibold text-muted-foreground">
          Simpan catatan pribadi untuk pola ini, mis. contoh kalimat buatanmu atau cara mengingatnya.{" "}
          <Link href={loginHref(community.pointKey, "catatanku")} className="font-black underline">
            Masuk untuk menulis catatan
          </Link>
        </p>
      ) : (
        <>
          <p className="text-xs font-semibold text-muted-foreground">
            Catatan privat hanya terlihat olehmu; bagikan ke diskusi bila ingin dibaca orang lain.
          </p>
          {community.notes.map((note) => (
            <CommentItem
              key={note.id}
              comment={note}
              canShare
              postingSuspended={community.postingSuspended}
            />
          ))}
          <QuestionCommentForm
            target={target}
            placeholder="Catatan untuk pola ini, mis. contoh kalimat buatanmu..."
          />
        </>
      )}
    </section>
  );
}

export function BunpouDiscussion({ community }: { community: BunpouCommunity }) {
  return (
    <section
      id="diskusi"
      className="neo-surface flex scroll-mt-24 flex-col gap-4 p-5"
      aria-labelledby="diskusi-title"
    >
      <h2 id="diskusi-title" className="inline-flex items-center gap-1.5 text-lg font-black">
        <MessagesSquare className="size-5" aria-hidden /> Diskusi ({community.entryCount})
      </h2>
      <p className="-mt-2 text-xs font-semibold text-muted-foreground">
        Contoh lain, nuansa, dan pertanyaan dari pengguna lain. Isi pola keliru? Pakai tombol
        Laporkan pola ini.
      </p>
      <DiscussionPageThreads
        roots={community.roots}
        currentUserId={community.viewerId}
        postingSuspended={community.postingSuspended}
        reportEnabled={community.reportEnabled}
        emptyText="Belum ada diskusi untuk pola ini. Jadilah yang pertama."
      />
      <div className="border-t-2 border-neo-ink/15 pt-4">
        {community.viewerId === null ? (
          <Link href={loginHref(community.pointKey, "diskusi")} className="text-sm font-bold underline">
            Masuk untuk ikut berdiskusi
          </Link>
        ) : (
          <DiscussionComposer
            target={{ type: "bunpou", bunpouPointId: community.pointId }}
            postingSuspended={community.postingSuspended}
            placeholder="Bagikan contoh kalimat, tips mengingat, atau pertanyaan tentang pola ini..."
          />
        )}
      </div>
    </section>
  );
}
