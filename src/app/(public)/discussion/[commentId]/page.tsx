import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getSession } from "@/lib/auth";
import {
  getDiscussionPermalink,
  resolveDiscussionRootId,
} from "@/features/question-comment/queries";
import { DiscussionPermalinkThread } from "@/features/question-comment/components/discussion-permalink-thread";
import { JapaneseText } from "@/components/japanese-text";
import { JapanesePassage } from "@/components/japanese-passage";
import { QuestionExplanationBody } from "@/components/question-explanation";
import { FuriganaScope } from "@/components/furigana-scope";
import { mondaiTypeFullLabel } from "@/constants/jlpt";
import { cn } from "@/lib/utils";

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
        <Link
          href={questionsHref}
          className="neo-button bg-white text-black font-extrabold text-xs self-start"
        >
          <ArrowLeft className="size-4" />
          Buka Mode Baca
        </Link>
      </div>

      <FuriganaScope>
        <div className="neo-surface bg-white p-6 border-[3px] border-neo-ink shadow-neo flex flex-col gap-4">
          {question.questionContext && (
            <div className="rounded-lg border-[3px] border-neo-ink bg-neo-paper p-4 text-sm shadow-neo-sm">
              <span className="font-mono text-[10px] font-black uppercase text-foreground/60 block mb-2">
                WACANA / STIMULUS SOAL
              </span>
              {question.questionContext.storyText && (
                <JapanesePassage text={question.questionContext.storyText} />
              )}
              {question.questionContext.storyImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={question.questionContext.storyImage}
                  alt=""
                  className="mt-3 max-w-full rounded-md border-2 border-neo-ink shadow-neo-sm"
                />
              )}
              {question.questionContext.storyAudio && (
                <audio controls src={question.questionContext.storyAudio} className="mt-3 w-full" />
              )}
            </div>
          )}

          <div className="flex gap-3 text-base">
            <span className="grid size-7 place-items-center rounded border-2 border-neo-ink bg-neo-yellow font-mono text-xs font-black shrink-0 shadow-neo-sm">
              {question.order}
            </span>
            <div className="flex flex-col gap-2 font-semibold">
              {question.questionText && <JapaneseText text={question.questionText} />}
              {question.questionImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={question.questionImage}
                  alt=""
                  className="max-w-full rounded-md border-2 border-neo-ink shadow-neo-sm"
                />
              )}
              {question.questionAudio && (
                <audio controls src={question.questionAudio} className="w-full" />
              )}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {question.questionChoices.map((choice) => {
              const isCorrect = choice.codeAnswer === question.questionAnswer;
              return (
                <div
                  key={choice.id}
                  className={cn(
                    "flex items-start gap-2.5 rounded-lg border-2 p-3 text-sm",
                    isCorrect
                      ? "border-neo-ink bg-neo-green text-black font-black shadow-neo-sm"
                      : "border-neo-ink/20 bg-background text-foreground/80 font-medium",
                  )}
                >
                  <span className="font-mono font-black">{choice.codeAnswer}.</span>
                  <div className="flex flex-col gap-1">
                    {choice.answerText && <JapaneseText text={choice.answerText} />}
                    {choice.answerImage && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={choice.answerImage}
                        alt=""
                        className="max-w-36 rounded border border-neo-ink"
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {question.explanation && (
            <div className="rounded-lg border-2 border-neo-ink bg-neo-yellow/20 p-3.5 text-xs font-semibold text-neo-ink shadow-neo-sm">
              <span className="font-mono text-[10px] font-black uppercase text-foreground/70 block mb-1">
                PENJELASAN SOAL:
              </span>
              <QuestionExplanationBody explanation={question.explanation} />
            </div>
          )}
        </div>
      </FuriganaScope>

      <div className="neo-surface bg-white p-6 border-[3px] border-neo-ink shadow-neo flex flex-col gap-4">
        <h2 className="font-mono text-xs font-black uppercase text-foreground/70">
          Catatan Pengguna ({root.replies.length + (root.state === "VISIBLE" ? 1 : 0)})
        </h2>
        <DiscussionPermalinkThread root={root} currentUserId={authSession?.userId ?? null} />
      </div>
    </div>
  );
}
