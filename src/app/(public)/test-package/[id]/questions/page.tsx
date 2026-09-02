import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { getTestPackageQuestions } from "@/features/test-package/actions";
import { QuestionCommentForm } from "@/features/question-comment/components/question-comment-form";
import { CommentItem } from "@/features/question-comment/components/comment-item";
import { CopyQuestionButton } from "@/components/copy-question-button";
import { QuestionNavSidebar, type NavMondaiItem } from "@/components/question-nav";
import { QuestionNavMobile } from "@/components/question-nav-mobile";
import { JapaneseText } from "@/components/japanese-text";
import { JapanesePassage } from "@/components/japanese-passage";
import { FuriganaScope } from "@/components/furigana-scope";
import { mondaiTypeFullLabel } from "@/constants/jlpt";
import { cn } from "@/lib/utils";

export default async function TestPackageQuestionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mondai?: string }>;
}) {
  const { id } = await params;
  const { mondai } = await searchParams;
  const testPackageId = Number(id);

  if (!Number.isInteger(testPackageId)) {
    notFound();
  }

  const testPackage = await getTestPackageQuestions(testPackageId);

  if (testPackage.testPackageItems.length === 0) {
    return (
      <div className="neo-surface bg-white p-8 text-center border-[3px] border-neo-ink shadow-neo">
        <p className="font-mono text-xs font-black uppercase text-foreground/60">{testPackage.jlptLevel}</p>
        <h1 className="mt-2 text-2xl font-black">{testPackage.name}</h1>
        <p className="mt-2 text-sm font-semibold text-muted-foreground">Belum ada soal untuk paket ini.</p>
      </div>
    );
  }

  const navItems: NavMondaiItem[] = testPackage.testPackageItems.map((item) => ({
    id: item.id,
    mondaiType: item.mondaiType,
    section: item.section,
    totalCount: item.questions.length,
  }));

  const requestedId = Number(mondai);
  const selectedItem =
    testPackage.testPackageItems.find((item) => item.id === requestedId) ??
    testPackage.testPackageItems[0];
  const currentIndex = testPackage.testPackageItems.findIndex(
    (item) => item.id === selectedItem.id,
  );
  const prevItem = currentIndex > 0 ? testPackage.testPackageItems[currentIndex - 1] : null;
  const nextItem =
    currentIndex < testPackage.testPackageItems.length - 1
      ? testPackage.testPackageItems[currentIndex + 1]
      : null;

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

  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6">
      {/* Header Banner */}
      <div className="neo-surface bg-white p-6 border-[3px] border-neo-ink shadow-neo relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="border-2 border-neo-ink bg-neo-yellow px-2.5 py-0.5 font-mono text-xs font-black uppercase shadow-neo-sm">
              JLPT {testPackage.jlptLevel}
            </span>
            <span className="neo-kicker bg-white">MODE BACA</span>
          </div>
          <h1 className="mt-2 text-2xl sm:text-4xl font-black uppercase text-neo-ink">
            {testPackage.name}
          </h1>
          <p className="mt-1 text-xs sm:text-sm font-semibold text-foreground/70">
            Kunci jawaban resmi dan pembahasan lengkap ditampilkan langsung untuk eksplorasi materi.
          </p>
        </div>

        <Link
          href={`/test-package/${testPackage.id}`}
          className="neo-button bg-white text-black font-extrabold text-xs shrink-0 self-start sm:self-auto"
        >
          <ArrowLeft className="size-4" />
          Detail Paket
        </Link>
      </div>

      <QuestionNavMobile
        items={navItems}
        activeId={selectedItem.id}
        buildHref={(itemId) => `/test-package/${testPackage.id}/questions?mondai=${itemId}`}
      />

      <div className="flex items-start gap-6">
        <QuestionNavSidebar
          items={navItems}
          activeId={selectedItem.id}
          buildHref={(itemId) => `/test-package/${testPackage.id}/questions?mondai=${itemId}`}
        />

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
                {questionRows.length === 0 && (
                  <p className="text-sm font-bold text-muted-foreground">Belum ada soal pada mondai ini.</p>
                )}

                {questionRows.map(({ question, showContext }) => (
                  <div
                    key={question.id}
                    className="flex flex-col gap-4 border-t-[3px] border-neo-ink/15 pt-6 first:border-t-0 first:pt-0"
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
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={question.questionContext.storyImage}
                            alt=""
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
                      <div className="flex shrink-0 items-center gap-1">
                        <CopyQuestionButton
                          contextText={question.questionContext?.storyText}
                          questionOrder={question.order}
                          questionText={question.questionText}
                          choices={question.questionChoices}
                        />
                      </div>
                    </div>

                    {/* Choices */}
                    <div className="grid gap-2 sm:grid-cols-2">
                      {question.questionChoices.map((choice) => {
                        const isCorrect = choice.codeAnswer === question.questionAnswer;
                        return (
                          <div
                            key={choice.id}
                            className={cn(
                              "flex items-start gap-2.5 rounded-lg border-2 p-3 text-sm transition-all",
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
                            {isCorrect && (
                              <span className="ml-auto font-mono text-[10px] font-black border border-neo-ink bg-white px-1.5 py-0.5 rounded shadow-neo-sm">
                                KUNCI
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
                ))}
              </div>
            </div>
          </FuriganaScope>

          <div className="flex items-center justify-between gap-3">
            {prevItem ? (
              <Link
                href={`/test-package/${testPackage.id}/questions?mondai=${prevItem.id}`}
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
                href={`/test-package/${testPackage.id}/questions?mondai=${nextItem.id}`}
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
