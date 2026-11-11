"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageCircle, Pin } from "lucide-react";
import { toast } from "sonner";
import { NewPublicNoteForm } from "@/features/question-comment/components/discussion-sheet";
import { DiscussionRootCard } from "@/features/question-comment/components/discussion-thread";
import { PostingSuspendedNotice } from "@/features/question-comment/components/posting-suspended-notice";
import type { DiscussionRoot } from "@/features/question-comment/queries";
import {
  sortDiscussionRoots,
  type DiscussionSort,
} from "@/features/question-comment/votes";
import { pinArticleCommentAction } from "../actions";
export function ArticleDiscussion({
  articleId,
  slug,
  roots,
  currentUserId,
  isAdmin,
  postingSuspended,
  enabled,
  reportEnabled,
  total,
}: {
  articleId: number;
  slug: string;
  roots: DiscussionRoot[];
  currentUserId: number | null;
  isAdmin: boolean;
  postingSuspended: boolean;
  enabled: boolean;
  reportEnabled: boolean;
  total: number;
}) {
  const router = useRouter();
  const [sort, setSort] = useState<DiscussionSort>("newest");
  const [pending, startTransition] = useTransition();
  const sorted = [...sortDiscussionRoots(roots, sort)].sort(
    (a, b) => Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned)),
  );
  return (
    <section
      id="diskusi"
      aria-labelledby="article-discussion-title"
      className="scroll-mt-28 rounded-xl border border-slate-200 bg-white p-5 sm:p-8"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2
            id="article-discussion-title"
            className="flex items-center gap-3 text-2xl"
          >
            <MessageCircle className="size-6" />
            Ruang pembaca{" "}
            <span className="text-base font-normal text-slate-500">
              {total}
            </span>
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Ada yang ingin ditanyakan? Bahasa Indonesia dan Jepang sama-sama
            boleh.
          </p>
        </div>
        {isAdmin && (
          <Link
            href="/admin/moderation"
            className="text-xs font-semibold underline underline-offset-4"
          >
            Kelola diskusi
          </Link>
        )}
      </div>
      <div className="my-7 border-b border-slate-200 pb-7">
        {!enabled ? (
          <p className="text-sm text-slate-600">
            Diskusi artikel ini ditutup. Percakapan sebelumnya tetap dapat
            dibaca.
          </p>
        ) : currentUserId === null ? (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-slate-50 p-5">
            <p className="text-sm text-slate-600">
              Punya pengalaman atau pertanyaan? Ikut percakapannya.
            </p>
            <Link
              href={`/login?next=${encodeURIComponent(`/article/${slug}#diskusi`)}`}
              className="neo-button bg-white text-xs"
            >
              Masuk untuk berkomentar
            </Link>
          </div>
        ) : postingSuspended ? (
          <PostingSuspendedNotice />
        ) : (
          <NewPublicNoteForm
            target={{ type: "article", articleId }}
            placeholder="Bagikan pendapat, pertanyaan, atau coba tulis kalimat Jepang..."
            onDone={() => {
              router.push(`/article/${slug}#diskusi`, { scroll: false });
              router.refresh();
            }}
          />
        )}
      </div>
      {roots.length > 1 && (
        <div
          role="group"
          aria-label="Urutkan komentar"
          className="mb-5 flex gap-4 text-xs"
        >
          {(
            [
              { value: "newest", label: "Terbaru" },
              { value: "helpful", label: "Paling membantu di halaman ini" },
            ] as const
          ).map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={sort === item.value}
              onClick={() => setSort(item.value)}
              className={`py-2 ${sort === item.value ? "font-bold text-slate-900 underline underline-offset-8" : "text-slate-500"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
      {roots.length === 0 ? (
        <div className="py-8 text-center">
          <MessageCircle className="mx-auto mb-3 size-7 text-slate-400" />
          <p className="text-sm font-semibold">
            Percakapan bisa dimulai darimu.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Bagian mana dari bacaan ini yang paling menarik?
          </p>
        </div>
      ) : (
        <div className="grid gap-5">
          {sorted.map((root) => (
            <div key={root.id}>
              {root.isPinned && (
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-blue-700">
                  <Pin className="size-3" />
                  Disematkan redaksi
                </p>
              )}
              <DiscussionRootCard
                root={root}
                currentUserId={currentUserId}
                postingSuspended={postingSuspended}
                onChanged={() => router.refresh()}
                reportEnabled={reportEnabled}
                showPermalink={false}
                archived={!enabled}
                manageOwn
              />
              {isAdmin && root.state === "VISIBLE" && (
                <button
                  type="button"
                  disabled={pending}
                  className="mt-2 text-xs text-slate-600 underline underline-offset-4"
                  onClick={() =>
                    startTransition(async () => {
                      const result = await pinArticleCommentAction({
                        commentId: root.id,
                        pinned: !root.isPinned,
                      });
                      if (!result.ok) toast.error(result.message);
                      else router.refresh();
                    })
                  }
                >
                  {root.isPinned ? "Lepas sematan" : "Sematkan komentar"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
