import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Flag,
} from "lucide-react";
import { getAttemptDetail } from "@/features/result/actions";
import { QuestionCommentForm } from "@/features/question-comment/components/question-comment-form";
import { CommentItem } from "@/features/question-comment/components/comment-item";
import { CopyQuestionButton } from "@/components/copy-question-button";
import { QuestionNavList, type NavMondaiItem } from "@/components/question-nav";
import { QuestionNavMobile } from "@/components/question-nav-mobile";
import { JapaneseText } from "@/components/japanese-text";
import { JapanesePassage } from "@/components/japanese-passage";
import { FuriganaScope } from "@/components/furigana-scope";
import { ImageWithLightbox } from "@/components/image-with-lightbox";
import { mondaiTypeFullLabel } from "@/constants/jlpt";
import { cn } from "@/lib/utils";

export default async function ResultDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ attemptId: string }>;
  searchParams: Promise<{ mondai?: string }>;
}) {
  const { attemptId } = await params;
  const { mondai } = await searchParams;
  const attemptIdNum = Number(attemptId);

  if (!Number.isInteger(attemptIdNum)) {
    notFound();
  }

  const { attempt, testPackageItems } = await getAttemptDetail(attemptIdNum);

  if (testPackageItems.length === 0) {
    return (
      <div className="neo-surface bg-white p-8 text-center border-[3px] border-neo-ink shadow-neo">
        <p className="font-mono text-xs font-black uppercase text-foreground/60">{attempt.testPackage.jlptLevel}</p>
        <h1 className="mt-2 text-2xl font-black">{attempt.testPackage.name} — Review</h1>
        <p className="mt-2 text-sm font-semibold text-muted-foreground">Belum ada soal untuk attempt ini.</p>
      </div>
    );
  }

  const navItems: NavMondaiItem[] = testPackageItems.map((item) => ({
    id: item.id,
    mondaiType: item.mondaiType,
    section: item.section,
    correctCount: item.questions.filter((q) => q.attemptAnswers[0]?.isCorrect).length,
    totalCount: item.questions.length,
  }));

  const requestedId = Number(mondai);
  const selectedItem =
    testPackageItems.find((item) => item.id === requestedId) ?? testPackageItems[0];
  const currentIndex = testPackageItems.findIndex((item) => item.id === selectedItem.id);
  const prevItem = currentIndex > 0 ? testPackageItems[currentIndex - 1] : null;
  const nextItem = currentIndex < testPackageItems.length - 1 ? testPackageItems[currentIndex + 1] : null;
  const selectedQuestions = selectedItem.questions.map((question) => {
    const answer = question.attemptAnswers[0] ?? null;
    return {
      id: question.id,
      order: question.order,
      isCorrect: answer?.isCorrect === true,
      isUnanswered: !answer || answer.selectedAnswer === null,
      isWrong: answer ? !answer.isCorrect && answer.selectedAnswer !== null : false,
      flagged: answer?.flagged ?? false,
    };
  });

  const totalSelectedQuestions = selectedQuestions.length;
  const totalCorrect = selectedQuestions.filter((question) => question.isCorrect).length;
  const totalWrong = selectedQuestions.filter((question) => question.isWrong).length;
  const totalUnanswered = selectedQuestions.filter((question) => question.isUnanswered).length;
  const totalFlagged = selectedQuestions.filter((question) => question.flagged).length;

  // Precomputed (not mutated during render) so a shared QuestionContext only
  // shows once for a contiguous run of questions that reference it.
  const questionRows = selectedItem.questions.reduce<{
    rows: { question: (typeof selectedItem.questions)[number]; showContext: boolean }[];
    lastContextId: number | null;
  }>(
    (acc, question) => {
      const showContext = Boolean(
        question.questionContext && question.questionContext.id !== acc.lastContextId,
      );
      return {
        rows: [...acc.rows, { question, showContext }],
        lastContextId: question.questionContext?.id ?? acc.lastContextId,
      };
    },
    { rows: [], lastContextId: null },
  ).rows;

  const lembarJawabanSection = (
    <div>
      <div className="border-b-2 border-neo-ink pb-3 mb-3 flex items-center justify-between">
        <div>
          <span className="font-mono text-xs font-black uppercase text-neo-ink tracking-wider block">
            LEMBAR JAWABAN
          </span>
          <span className="font-mono text-[11px] font-bold text-foreground/60">
            Klik nomor untuk melompat
          </span>
        </div>
        <span className="border-2 border-neo-ink bg-neo-yellow px-2 py-0.5 font-mono text-xs font-black shadow-neo-sm text-black">
          {totalCorrect}/{totalSelectedQuestions}
        </span>
      </div>

      {/* Grid of question buttons with safe padding so no clipping occurs */}
      <div className="max-h-56 overflow-y-auto overflow-x-hidden p-2 -mx-1.5">
        <div className="grid grid-cols-5 gap-2">
          {selectedQuestions.map((q) => {
            return (
              <Link
                key={q.id}
                href={`#q-${q.order}`}
                title={`Soal ${q.order}: ${q.isCorrect ? "Benar" : q.isUnanswered ? "Kosong" : "Salah"}${q.flagged ? " (Ragu-ragu)" : ""}`}
                className={cn(
                  "relative flex aspect-square items-center justify-center border-2 border-neo-ink font-mono text-xs font-black transition-all hover:-translate-y-0.5",
                  q.isCorrect && "bg-neo-green text-black",
                  q.isWrong && "bg-neo-coral text-white",
                  q.isUnanswered && "bg-neo-paper text-foreground/70",
                )}
              >
                {q.order}
                {q.flagged && (
                  <span className="absolute -top-1.5 -right-1.5 z-20 grid size-3.5 place-items-center rounded-full border border-neo-ink bg-neo-coral shadow-sm">
                    <Flag className="size-2 fill-white text-white" />
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 border-t-2 border-neo-ink pt-2.5 space-y-1.5 font-mono text-[11px] font-bold text-neo-ink">
        <div className="flex items-center gap-2">
          <span className="size-3 border-2 border-neo-ink bg-neo-green" />
          <span>Benar ({totalCorrect})</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="size-3 border-2 border-neo-ink bg-neo-coral" />
          <span>Salah ({totalWrong})</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="size-3 border-2 border-neo-ink bg-neo-paper" />
          <span>Kosong ({totalUnanswered})</span>
        </div>
        {totalFlagged > 0 && (
          <div className="flex items-center gap-2">
            <span className="size-3 border-2 border-neo-ink bg-neo-coral flex items-center justify-center">
              <Flag className="size-1.5 fill-white text-white" />
            </span>
            <span>Ragu-ragu ({totalFlagged})</span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6">
      {/* Header Review Banner */}
      <div className="neo-surface bg-white p-6 border-[3px] border-neo-ink shadow-neo relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="border-2 border-neo-ink bg-neo-yellow px-2.5 py-0.5 font-mono text-xs font-black uppercase shadow-neo-sm">
              JLPT {attempt.testPackage.jlptLevel}
            </span>
            <span className="neo-kicker bg-white">REVIEW HASIL ATTEMPT</span>
          </div>
          <h1 className="mt-2 text-2xl sm:text-4xl font-black uppercase text-neo-ink">
            {attempt.testPackage.name}
          </h1>
          <p className="mt-1 text-xs sm:text-sm font-semibold text-foreground/70">
            Periksa kembali jawabanmu, perhatikan penjelasan tiap soal, dan simpan catatan belajar.
          </p>
        </div>

        <Link
          href={`/result/${attempt.id}`}
          className="neo-button bg-white text-black font-extrabold text-xs shrink-0 self-start sm:self-auto"
        >
          <ArrowLeft className="size-4" />
          Ringkasan Hasil
        </Link>
      </div>

      <QuestionNavMobile
        items={navItems}
        activeId={selectedItem.id}
        buildHref={(itemId) => `/result/${attempt.id}/detail?mondai=${itemId}`}
      >
        {lembarJawabanSection}
      </QuestionNavMobile>

      <div className="flex items-start gap-6">
        <aside className="sticky top-20 hidden max-h-[calc(100vh-6rem)] w-72 shrink-0 self-start overflow-y-auto rounded-lg border-[3px] border-neo-ink bg-white p-4 shadow-neo lg:block space-y-5">
          {lembarJawabanSection}

          <div className="border-t-2 border-neo-ink pt-4">
            <div className="border-b-2 border-neo-ink pb-2 mb-3">
              <span className="font-mono text-xs font-black uppercase text-neo-ink">
                DAFTAR MONDAI
              </span>
            </div>
            <QuestionNavList
              items={navItems}
              activeId={selectedItem.id}
              buildHref={(itemId) => `/result/${attempt.id}/detail?mondai=${itemId}`}
            />
          </div>
        </aside>

        <div className="min-w-0 flex-1 space-y-6">
          <FuriganaScope>
            <div className="neo-surface bg-white p-6 sm:p-8 border-[3px] border-neo-ink shadow-neo space-y-6">
              <div className="border-b-[3px] border-neo-ink pb-4">
                <div className="flex items-center gap-2">
                  <span className="border-2 border-neo-ink bg-neo-paper px-2 py-0.5 font-mono text-xs font-black uppercase shadow-neo-sm">
                    SESI {selectedItem.session}
                  </span>
                  <span className="font-mono text-xs font-bold text-foreground/60">
                    {selectedItem.questions.length} SOAL
                  </span>
                </div>
                <h2 className="mt-2 text-2xl sm:text-3xl font-black text-neo-ink">
                  {mondaiTypeFullLabel(selectedItem.mondaiType)}
                </h2>
                {selectedItem.instruction && (
                  <div className="mt-3 rounded-lg border-2 border-neo-ink bg-neo-paper p-3 text-sm font-bold text-neo-ink shadow-neo-sm">
                    <JapaneseText text={selectedItem.instruction} />
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-8">
                {questionRows.map(({ question, showContext }) => {
                  const userAnswer = question.attemptAnswers[0] ?? null;

                  return (
                    <div
                      key={question.id}
                      id={`q-${question.order}`}
                      className="scroll-mt-24 flex flex-col gap-4 border-t-[3px] border-neo-ink/15 pt-6 first:border-t-0 first:pt-0"
                    >
                      {showContext && question.questionContext && (
                        <div className="rounded-lg border-[3px] border-neo-ink bg-neo-paper p-4 text-sm shadow-neo-sm">
                          <span className="font-mono text-[10px] font-black uppercase text-foreground/60 block mb-2">
                            WACANA / STIMULUS SOAL
                          </span>
                          {question.questionContext.storyText && (
                            <JapanesePassage text={question.questionContext.storyText} />
                          )}
                          {question.questionContext.storyImage && (
                            <ImageWithLightbox
                              src={question.questionContext.storyImage}
                              className="mt-3 max-w-full rounded-md border-2 border-neo-ink shadow-neo-sm"
                            />
                          )}
                          {question.questionContext.storyAudio && (
                            <audio
                              controls
                              src={question.questionContext.storyAudio}
                              className="mt-3 w-full"
                            />
                          )}
                        </div>
                      )}

                      <div className="flex items-start justify-between gap-3">
                        <div className="flex gap-3 text-base">
                          <span className="grid size-7 place-items-center rounded border-2 border-neo-ink bg-neo-yellow font-mono text-xs font-black shrink-0 shadow-neo-sm">
                            {question.order}
                          </span>
                          <div className="flex flex-col gap-2 font-semibold">
                            {question.questionText && (
                              <JapaneseText text={question.questionText} />
                            )}
                            {question.questionImage && (
                              <ImageWithLightbox
                                src={question.questionImage}
                                className="max-w-full rounded-md border-2 border-neo-ink shadow-neo-sm"
                              />
                            )}
                            {question.questionAudio && (
                              <audio controls src={question.questionAudio} className="w-full" />
                            )}
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <CopyQuestionButton
                            contextText={question.questionContext?.storyText}
                            questionOrder={question.order}
                            questionText={question.questionText}
                            choices={question.questionChoices}
                          />
                          {userAnswer && (
                            <span
                              className={cn(
                                "border-2 border-neo-ink px-2.5 py-0.5 font-mono text-xs font-black uppercase shadow-neo-sm",
                                userAnswer.isCorrect
                                  ? "bg-neo-green text-black"
                                  : userAnswer.selectedAnswer === null
                                    ? "bg-neo-paper text-foreground/70"
                                    : "bg-neo-coral text-white",
                              )}
                            >
                              {userAnswer.isCorrect
                                ? "Benar"
                                : userAnswer.selectedAnswer === null
                                  ? "Kosong"
                                  : "Salah"}
                            </span>
                          )}
                          {userAnswer?.flagged && (
                            <span className="inline-flex items-center gap-1 border-2 border-neo-ink bg-neo-yellow px-2.5 py-0.5 font-mono text-xs font-black uppercase text-black shadow-neo-sm">
                              <Flag className="size-3 fill-current" aria-hidden="true" />
                              Ragu-ragu
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Choice List */}
                      <div className="grid gap-2 sm:grid-cols-2">
                        {question.questionChoices.map((choice) => {
                          const isCorrectChoice = choice.codeAnswer === question.questionAnswer;
                          const isUserChoice = choice.codeAnswer === userAnswer?.selectedAnswer;

                          return (
                            <div
                              key={choice.id}
                              className={cn(
                                "flex items-start gap-2.5 rounded-lg border-2 p-3 text-sm transition-all",
                                isCorrectChoice
                                  ? "border-neo-ink bg-neo-green text-black font-black shadow-neo-sm"
                                  : isUserChoice && !isCorrectChoice
                                    ? "border-neo-ink bg-neo-coral text-white font-bold shadow-neo-sm"
                                    : "border-neo-ink/20 bg-background text-foreground/80 font-medium",
                              )}
                            >
                              <span className="font-mono font-black">{choice.codeAnswer}.</span>
                              <div className="flex flex-col gap-1">
                                {choice.answerText && <JapaneseText text={choice.answerText} />}
                                {choice.answerImage && (
                                  <ImageWithLightbox
                                    src={choice.answerImage}
                                    className="max-w-40 rounded border border-neo-ink"
                                  />
                                )}
                              </div>
                              {isUserChoice && (
                                <span
                                  className={cn(
                                    "ml-auto font-mono text-[10px] font-black border border-neo-ink px-1.5 py-0.5 rounded shadow-neo-sm",
                                    isCorrectChoice
                                      ? "bg-white text-black"
                                      : "bg-white text-rose-700",
                                  )}
                                >
                                  Jawabanmu
                                </span>
                              )}
                              {isCorrectChoice && !isUserChoice && (
                                <span className="ml-auto font-mono text-[10px] font-black border border-neo-ink bg-white px-1.5 py-0.5 rounded shadow-neo-sm text-black">
                                  Kunci
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {question.explanation && (
                        <div className="rounded-lg border-2 border-neo-ink bg-neo-yellow/20 p-3.5 text-xs font-semibold text-neo-ink shadow-neo-sm">
                          <span className="font-mono text-[10px] font-black uppercase text-foreground/70 block mb-1">
                            PENJELASAN SOAL:
                          </span>
                          <JapaneseText text={question.explanation} />
                        </div>
                      )}

                      <div className="flex flex-col gap-3 mt-2">
                        {question.questionComments.length > 0 && (
                          <div className="flex flex-col gap-3">
                            <span className="font-mono text-xs font-black uppercase text-foreground/70">
                              Catatan Belajar ({question.questionComments.length})
                            </span>
                            {question.questionComments.map((comment) => (
                              <CommentItem key={comment.id} comment={comment} />
                            ))}
                          </div>
                        )}
                        <QuestionCommentForm questionId={question.id} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </FuriganaScope>

          <div className="flex items-center justify-between gap-3">
            {prevItem ? (
              <Link
                href={`/result/${attempt.id}/detail?mondai=${prevItem.id}`}
                className="neo-button bg-white text-black font-extrabold text-xs sm:text-sm"
              >
                <ArrowLeft className="size-4" />
                Mondai Sebelumnya
              </Link>
            ) : (
              <button disabled className="neo-button bg-white text-black opacity-40 font-bold text-xs sm:text-sm">
                <ArrowLeft className="size-4" />
                Mondai Sebelumnya
              </button>
            )}

            {nextItem ? (
              <Link
                href={`/result/${attempt.id}/detail?mondai=${nextItem.id}`}
                className="neo-button bg-neo-yellow text-black font-black text-xs sm:text-sm"
              >
                Mondai Selanjutnya
                <ArrowRight className="size-4" />
              </Link>
            ) : (
              <button disabled className="neo-button bg-white text-black opacity-40 font-bold text-xs sm:text-sm">
                Mondai Selanjutnya
                <ArrowRight className="size-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
