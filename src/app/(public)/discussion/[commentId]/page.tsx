import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getSession } from "@/lib/auth";
import {
  getDiscussionPermalink,
  resolveDiscussionRootId,
} from "@/features/question-comment/queries";
import { DiscussionPermalinkThread } from "@/features/question-comment/components/discussion-permalink-thread";
import { DiscussionQuestionCard } from "@/features/question-comment/components/discussion-question-card";
import { mondaiTypeFullLabel } from "@/constants/jlpt";
import type { Metadata } from "next";
import { privateMetadata } from "@/lib/seo";

export const metadata: Metadata = privateMetadata(
  "Utas diskusi",
  "Utas diskusi pada satu soal JLPT.",
);

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

  // Balasan tidak punya halaman sendiri — arahkan ke thread induknya dan biarkan
  // anchor membawa pembaca langsung ke balasan yang dimaksud.
  if (resolved.isReply) {
    redirect(`/discussion/${resolved.rootId}#comment-${commentIdNum}`);
  }

  const [permalink, authSession] = await Promise.all([
    getDiscussionPermalink(resolved.rootId),
    getSession(),
  ]);
  if (!permalink) notFound();

  const { root, question } = permalink;
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
        <DiscussionPermalinkThread root={root} currentUserId={authSession?.userId ?? null} />
      </div>
    </div>
  );
}
