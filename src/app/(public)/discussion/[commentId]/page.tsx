import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getSession } from "@/lib/auth";
import { cache } from "react";
import {
  countDiscussionEntries,
  getDiscussionPermalink,
  isPostingSuspended,
  resolveDiscussionRootId,
  withViewerVotes,
} from "@/features/question-comment/queries";
import { questionDiscussionMetadata } from "@/features/question-comment/seo";
import { DiscussionPermalinkThread } from "@/features/question-comment/components/discussion-permalink-thread";
import { DiscussionQuestionCard } from "@/features/question-comment/components/discussion-question-card";
import { FEATURES } from "@/constants";
import { discussionThreadHref } from "@/features/question-comment/target";
import { mondaiTypeFullLabel } from "@/constants/jlpt";
import type { Metadata } from "next";
import { privateMetadata } from "@/lib/seo";

// Thread soal saja; balasan dan thread kata/pola dialihkan oleh halaman ini.
const loadPermalink = cache(async (rawCommentId: string) => {
  const commentId = Number(rawCommentId);
  if (!Number.isInteger(commentId) || commentId <= 0) return null;
  const resolved = await resolveDiscussionRootId(commentId);
  if (!resolved || resolved.isReply || resolved.questionId === null) return null;
  return getDiscussionPermalink(resolved.rootId);
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ commentId: string }>;
}): Promise<Metadata> {
  const permalink = await loadPermalink((await params).commentId);
  if (!permalink) return privateMetadata("Utas diskusi", "Utas diskusi pada satu soal JLPT.");
  // Canonical ke halaman diskusi soalnya: thread ini bagian dari halaman itu.
  return questionDiscussionMetadata(permalink.question, countDiscussionEntries([permalink.root]));
}

export default async function DiscussionPermalinkPage({
  params,
}: {
  params: Promise<{ commentId: string }>;
}) {
  const { commentId } = await params;
  const commentIdNum = Number(commentId);

  if (!Number.isInteger(commentIdNum) || commentIdNum <= 0) {
    notFound();
  }

  const resolved = await resolveDiscussionRootId(commentIdNum);
  if (!resolved) notFound();

  // Thread kata flashcard dibaca di halaman katanya. Tautan yang dibuat aplikasi
  // sudah langsung ke sana; ini untuk permalink yang dibentuk dari id saja.
  if (resolved.vocabId !== null) {
    if (!FEATURES.flashcardDiscussion) notFound();
    redirect(
      discussionThreadHref(
        { id: resolved.rootId, questionId: null, vocabId: resolved.vocabId, bunpouPointId: null },
        commentIdNum,
      ),
    );
  }

  // Sama untuk thread pola bunpou, yang dibaca di halaman polanya.
  if (resolved.bunpouPointId !== null) {
    if (!FEATURES.bunpouDiscussion) notFound();
    redirect(
      discussionThreadHref(
        {
          id: resolved.rootId,
          questionId: null,
          vocabId: null,
          bunpouPointId: resolved.bunpouPointId,
        },
        commentIdNum,
      ),
    );
  }

  // Balasan tidak punya halaman sendiri — arahkan ke thread induknya dan biarkan
  // anchor membawa pembaca langsung ke balasan yang dimaksud.
  if (resolved.isReply) {
    redirect(`/discussion/${resolved.rootId}#comment-${commentIdNum}`);
  }

  const [permalink, authSession] = await Promise.all([loadPermalink(commentId), getSession()]);
  if (!permalink) notFound();
  const currentUserId = authSession?.userId ?? null;
  const [postingSuspended, [root]] = await Promise.all([
    isPostingSuspended(currentUserId),
    withViewerVotes([permalink.root], currentUserId),
  ]);

  const { question } = permalink;
  const { testPackageItem } = question;
  const { testPackage } = testPackageItem;
  const questionsHref = `/test-package/${testPackage.id}/questions?mondai=${testPackageItem.id}`;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6">
      <div className="neo-surface bg-white p-6 border-[3px] border-neo-ink shadow-neo flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="border-2 border-neo-ink bg-neo-yellow px-2.5 py-0.5 font-mono text-xs font-black uppercase shadow-neo-sm">
            JLPT {testPackage.jlptLevel}
          </span>
          <span className="neo-kicker bg-white">DISKUSI SOAL</span>
        </div>
        <h1 className="text-xl sm:text-3xl font-black uppercase text-neo-ink">
          {mondaiTypeFullLabel(testPackageItem.mondaiType)}
        </h1>
        <p className="text-xs sm:text-sm font-semibold text-foreground/70">
          {testPackage.name} · Sesi {testPackageItem.session} · Soal nomor {question.order}
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/discussion/question/${question.id}`}
            className="neo-button bg-white text-black font-extrabold text-xs"
          >
            <ArrowLeft className="size-4" />
            Semua Diskusi Soal Ini
          </Link>
          <Link href={questionsHref} className="neo-button bg-white text-black font-extrabold text-xs">
            Buka Mode Baca
          </Link>
        </div>
      </div>

      <DiscussionQuestionCard question={question} />

      <div className="neo-surface bg-white p-6 border-[3px] border-neo-ink shadow-neo flex flex-col gap-4">
        <h2 className="font-mono text-xs font-black uppercase text-foreground/70">
          Catatan Pengguna ({root.replies.length + (root.state === "VISIBLE" ? 1 : 0)})
        </h2>
        <DiscussionPermalinkThread
          root={root}
          currentUserId={currentUserId}
          postingSuspended={postingSuspended}
          reportEnabled={FEATURES.report}
        />
      </div>
    </div>
  );
}
