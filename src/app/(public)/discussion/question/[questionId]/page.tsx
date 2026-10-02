import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getSession } from "@/lib/auth";
import { cache } from "react";
import {
  countDiscussionEntries,
  getQuestionDiscussionPage,
} from "@/features/question-comment/queries";
import { questionDiscussionMetadata } from "@/features/question-comment/seo";
import { DiscussionPageThreads } from "@/features/question-comment/components/discussion-permalink-thread";
import { DiscussionQuestionCard } from "@/features/question-comment/components/discussion-question-card";
import { FEATURES } from "@/constants";
import { mondaiTypeFullLabel } from "@/constants/jlpt";
import type { Metadata } from "next";
import { privateMetadata } from "@/lib/seo";

type Props = { params: Promise<{ questionId: string }> };

// Dipakai metadata dan halaman dalam satu request; `cache` mencegah query ganda.
const loadDiscussion = cache(async (rawQuestionId: string) => {
  const questionId = Number(rawQuestionId);
  if (!Number.isInteger(questionId) || questionId <= 0) return null;
  return getQuestionDiscussionPage(questionId);
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const discussion = await loadDiscussion((await params).questionId);
  if (!discussion) {
    return privateMetadata("Diskusi soal", "Soal yang dicari tidak ditemukan.");
  }
  return questionDiscussionMetadata(discussion.question, countDiscussionEntries(discussion.roots));
}

export default async function QuestionDiscussionPage({ params }: Props) {
  const { questionId } = await params;

  const [discussion, authSession] = await Promise.all([loadDiscussion(questionId), getSession()]);
  if (!discussion) notFound();

  const { question, roots } = discussion;
  const { testPackageItem } = question;
  const { testPackage } = testPackageItem;

  const entryCount = countDiscussionEntries(roots);

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
            href="/discussion"
            className="neo-button bg-white text-black font-extrabold text-xs"
          >
            <ArrowLeft className="size-4" />
            Semua Diskusi
          </Link>
          <Link
            href={`/test-package/${testPackage.id}/questions?mondai=${testPackageItem.id}`}
            className="neo-button bg-white text-black font-extrabold text-xs"
          >
            Buka Mode Baca
          </Link>
        </div>
      </div>

      <DiscussionQuestionCard question={question} />

      <div className="neo-surface bg-white p-6 border-[3px] border-neo-ink shadow-neo flex flex-col gap-4">
        <h2 className="font-mono text-xs font-black uppercase text-foreground/70">
          Catatan Pengguna ({entryCount})
        </h2>
        <DiscussionPageThreads
          roots={roots}
          currentUserId={authSession?.userId ?? null}
          reportEnabled={FEATURES.report}
        />
      </div>
    </div>
  );
}
