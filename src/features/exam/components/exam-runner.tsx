"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { JlptLevel, JlptSection, MondaiType } from "@prisma/client";
import { useExam } from "./exam-provider";
import { submitExamSessionAction } from "../actions";
import { JapaneseText } from "@/components/japanese-text";
import { JapanesePassage } from "@/components/japanese-passage";
import { ImageWithLightbox } from "@/components/image-with-lightbox";
import { JLPT_SECTION_LABELS, mondaiTypeFullLabel } from "@/constants/jlpt";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Flag,
  Headphones,
  Send,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type ExamQuestion = {
  id: number;
  order: number;
  questionText: string;
  questionImage: string | null;
  questionAudio: string | null;
  mondaiType: MondaiType;
  instruction: string | null;
  questionContext: {
    id: number;
    storyText: string | null;
    storyImage: string | null;
    storyAudio: string | null;
  } | null;
  questionChoices: {
    id: number;
    codeAnswer: number;
    answerText: string;
    answerImage: string | null;
  }[];
};

type ExamRunnerProps = {
  attemptId: number;
  session: number;
  testPackageName: string;
  jlptLevel?: JlptLevel | null;
  sectionScope?: JlptSection | null;
  questions: ExamQuestion[];
};

export function ExamRunner({
  attemptId,
  session,
  testPackageName,
  jlptLevel,
  sectionScope,
  questions,
}: ExamRunnerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hydrated, getAnswer, setAnswer, toggleFlag } = useExam();
  const [isSubmitting, startTransition] = useTransition();

  const totalQuestions = questions.length;
  const answeredMap = useMemo(
    () => Object.fromEntries(questions.map((q) => [q.id, getAnswer(q.id)])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [questions, hydrated],
  );

  const answeredCount = useMemo(
    () => questions.filter((q) => answeredMap[q.id]?.selectedAnswer != null).length,
    [questions, answeredMap],
  );
  const unansweredCount = totalQuestions - answeredCount;
  const flaggedCount = useMemo(
    () => questions.filter((q) => answeredMap[q.id]?.flagged).length,
    [questions, answeredMap],
  );
  const progressPercentage = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;

  const rawQuestionNumber = Number(searchParams.get("questionNumber"));

  const currentIndex = useMemo(() => {
    if (
      Number.isInteger(rawQuestionNumber) &&
      rawQuestionNumber >= 1 &&
      rawQuestionNumber <= totalQuestions
    ) {
      return rawQuestionNumber - 1;
    }
    const firstUnanswered = questions.findIndex(
      (q) => answeredMap[q.id]?.selectedAnswer == null,
    );
    return firstUnanswered !== -1 ? firstUnanswered : 0;
  }, [rawQuestionNumber, totalQuestions, questions, answeredMap]);

  useEffect(() => {
    if (!hydrated) return;
    const validNumber = currentIndex + 1;
    if (rawQuestionNumber !== validNumber) {
      router.replace(`?questionNumber=${validNumber}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, currentIndex, rawQuestionNumber]);

  const [confirmOpen, setConfirmOpen] = useState(false);

  const currentQuestion = questions[currentIndex];
  const answerState = currentQuestion ? getAnswer(currentQuestion.id) : { selectedAnswer: null, flagged: false };
  const hideFurigana = currentQuestion?.mondaiType === "MOJI_GOI_READ_KANJI";

  function goToQuestion(index: number) {
    const clamped = Math.min(Math.max(index, 0), totalQuestions - 1);
    router.replace(`?questionNumber=${clamped + 1}`);
  }

  // Keyboard navigation & shortcuts
  useEffect(() => {
    if (!hydrated || !currentQuestion || totalQuestions === 0) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }
      if (confirmOpen) return;

      if (e.key >= "1" && e.key <= "4") {
        const code = Number(e.key);
        const choiceExists = currentQuestion.questionChoices.some((c) => c.codeAnswer === code);
        if (choiceExists) {
          setAnswer(currentQuestion.id, code);
        }
      } else if (e.key === "f" || e.key === "F") {
        toggleFlag(currentQuestion.id);
      } else if (e.key === "ArrowLeft" || e.key === "j" || e.key === "J") {
        if (currentIndex > 0) goToQuestion(currentIndex - 1);
      } else if (e.key === "ArrowRight" || e.key === "k" || e.key === "K") {
        if (currentIndex < totalQuestions - 1) goToQuestion(currentIndex + 1);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, confirmOpen, currentIndex, currentQuestion, totalQuestions]);

  function handleSubmit() {
    startTransition(async () => {
      const payload = questions.map((q) => {
        const state = getAnswer(q.id);
        return {
          questionId: q.id,
          selectedAnswer: state.selectedAnswer,
          flagged: state.flagged,
        };
      });
      await submitExamSessionAction({ attemptId, session, answers: payload });
    });
  }

  if (!hydrated || totalQuestions === 0) {
    return (
      <main className="page-reveal mx-auto w-full max-w-2xl px-4 py-16">
        <div className="neo-surface neo-grid-paper border-[3px] border-neo-ink bg-white p-8 text-center shadow-neo space-y-4">
          <div className="inline-flex size-14 items-center justify-center rounded-xl border-[3px] border-neo-ink bg-neo-yellow shadow-neo-sm">
            <span className="font-mono text-2xl font-black">JLPT</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-neo-ink">
            {totalQuestions === 0 ? "Belum Ada Soal di Sesi Ini" : "Menyiapkan Lembar Soal..."}
          </h1>
          <p className="text-sm font-semibold text-foreground/70">
            {totalQuestions === 0
              ? "Sesi ujian ini belum memiliki butir soal yang aktif."
              : "Memuat data ujian dan memulihkan lembar jawaban..."}
          </p>
        </div>
      </main>
    );
  }

  return (
    <div className="page-reveal mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* Header Banner */}
      <header className="neo-surface neo-grid-paper relative overflow-hidden bg-white p-5 sm:p-7 border-[3px] border-neo-ink shadow-neo">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              {jlptLevel && (
                <span className="border-2 border-neo-ink bg-neo-yellow px-2.5 py-0.5 font-mono text-xs font-black uppercase shadow-neo-sm text-black">
                  JLPT {jlptLevel}
                </span>
              )}
              <span className="border-2 border-neo-ink bg-neo-paper px-2.5 py-0.5 font-mono text-xs font-black uppercase shadow-neo-sm text-neo-ink">
                SESI {session}
              </span>
              <span className="neo-kicker bg-white">
                {sectionScope ? `LATIHAN ${JLPT_SECTION_LABELS[sectionScope]}` : "SIMULASI UJIAN"}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black uppercase text-neo-ink tracking-tight">
              {testPackageName}
            </h1>

            <p className="font-mono text-xs sm:text-sm font-bold text-foreground/75">
              {mondaiTypeFullLabel(currentQuestion.mondaiType)}
            </p>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-auto">
            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
              <AlertDialogTrigger
                render={
                  <button
                    type="button"
                    disabled={isSubmitting}
                    className="neo-button bg-neo-coral text-white font-black text-sm px-5 py-2.5 hover:bg-neo-coral/90 shadow-neo-sm"
                  >
                    <Send className="size-4" />
                    {isSubmitting ? "Mengirim..." : "Submit Sesi"}
                  </button>
                }
              />
              <AlertDialogContent className="border-[3px] border-neo-ink bg-white p-6 shadow-neo-lg sm:max-w-md rounded-xl text-neo-ink">
                <AlertDialogHeader className="text-left">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="border-2 border-neo-ink bg-neo-yellow px-2 py-0.5 font-mono text-[11px] font-black uppercase shadow-neo-sm text-black">
                      KONFIRMASI SELESAI
                    </span>
                  </div>
                  <AlertDialogTitle className="text-xl sm:text-2xl font-black text-neo-ink">
                    Submit Sesi {session}?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-sm font-semibold text-foreground/80 mt-1">
                    Setelah disubmit, lembar jawaban untuk sesi ini akan dikunci dan dinilai secara permanen.
                  </AlertDialogDescription>
                </AlertDialogHeader>

                <div className="grid grid-cols-3 gap-2.5 my-2">
                  <div className="border-2 border-neo-ink bg-neo-paper p-2.5 text-center shadow-neo-sm">
                    <span className="font-mono text-[10px] font-black uppercase text-foreground/60 block">Terjawab</span>
                    <span className="font-mono text-xl font-black text-neo-blue">{answeredCount}</span>
                  </div>
                  <div className="border-2 border-neo-ink bg-neo-paper p-2.5 text-center shadow-neo-sm">
                    <span className="font-mono text-[10px] font-black uppercase text-foreground/60 block">Belum</span>
                    <span className={cn("font-mono text-xl font-black", unansweredCount > 0 ? "text-neo-coral" : "text-neo-ink")}>
                      {unansweredCount}
                    </span>
                  </div>
                  <div className="border-2 border-neo-ink bg-neo-paper p-2.5 text-center shadow-neo-sm">
                    <span className="font-mono text-[10px] font-black uppercase text-foreground/60 block">Ragu</span>
                    <span className="font-mono text-xl font-black text-amber-600">{flaggedCount}</span>
                  </div>
                </div>

                {unansweredCount > 0 && (
                  <div className="flex items-start gap-2 border-2 border-neo-ink bg-neo-coral/15 p-3 text-xs font-bold text-neo-ink">
                    <AlertTriangle className="size-4 shrink-0 text-neo-coral mt-0.5" />
                    <span>Ada {unansweredCount} soal yang belum dijawab dan akan dihitung salah jika disubmit sekarang.</span>
                  </div>
                )}

                <AlertDialogFooter className="mt-4 sm:flex-row gap-2">
                  <AlertDialogCancel className="neo-button bg-white text-black font-extrabold text-xs sm:text-sm">
                    Kembali Periksa
                  </AlertDialogCancel>
                  <AlertDialogAction
                    disabled={isSubmitting}
                    onClick={handleSubmit}
                    className="neo-button bg-neo-coral text-white font-black text-xs sm:text-sm"
                  >
                    {isSubmitting ? "Ya, Submit Sekarang" : "Ya, Submit Sekarang"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </header>

      {/* Telemetry Progress Bar */}
      <section className="neo-surface bg-white p-4 sm:p-5 border-[3px] border-neo-ink shadow-neo">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm font-black text-neo-ink">
          <div className="flex items-center gap-2">
            <span className="border-2 border-neo-ink bg-neo-yellow px-2 py-0.5 font-mono font-black shadow-neo-sm text-black">
              SOAL {currentIndex + 1} / {totalQuestions}
            </span>
            <span className="text-foreground/70 hidden sm:inline">
              ({progressPercentage}% selesai)
            </span>
          </div>
          <div className="flex items-center gap-3 font-mono text-xs">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-neo-blue border border-neo-ink inline-block" />
              <span className="font-bold">{answeredCount} Terjawab</span>
            </span>
            {flaggedCount > 0 && (
              <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                <Flag className="size-3 fill-amber-500 text-amber-500" />
                <span className="font-bold">{flaggedCount} Ragu</span>
              </span>
            )}
            <span className="text-foreground/50">{unansweredCount} Tersisa</span>
          </div>
        </div>

        <div className="mt-3 h-3.5 overflow-hidden border-[3px] border-neo-ink bg-neo-paper" aria-label={`${progressPercentage}% selesai`}>
          <div
            className="h-full bg-neo-blue transition-[width] duration-300"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </section>

      {/* Main Grid: Question Workspace vs Sticky Sheet Palette */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
        {/* Left Column: Question Details */}
        <div className="space-y-6">
          {/* Instruction Box */}
          {currentQuestion.instruction && (
            <div className="border-[3px] border-neo-ink bg-neo-yellow p-4 sm:p-5 font-bold text-black shadow-neo-sm space-y-1">
              <span className="font-mono text-[10px] font-black uppercase text-black/70 tracking-wider block">
                PETUNJUK MONDAI
              </span>
              <div className="text-sm font-japanese sm:text-base leading-relaxed">
                <JapaneseText text={currentQuestion.instruction} />
              </div>
            </div>
          )}

          {/* Context / Stimulus Card */}
          {currentQuestion.questionContext && (
            <section className="neo-surface bg-white p-5 sm:p-7 space-y-4 border-[3px] border-neo-ink shadow-neo">
              <div className="border-b-2 border-neo-ink pb-2 flex items-center justify-between">
                <span className="border-2 border-neo-ink bg-neo-paper px-2.5 py-0.5 font-mono text-[11px] font-black uppercase shadow-neo-sm text-neo-ink">
                  WACANA / DOKUMEN BACAAN
                </span>
              </div>

              {currentQuestion.questionContext.storyText && (
                <JapanesePassage
                  text={currentQuestion.questionContext.storyText}
                  className="font-japanese text-base sm:text-lg leading-8 text-neo-ink"
                />
              )}

              {currentQuestion.questionContext.storyImage && (
                <ImageWithLightbox
                  src={currentQuestion.questionContext.storyImage}
                  alt="Materi wacana"
                  className="max-h-[30rem] max-w-full rounded-md border-[3px] border-neo-ink shadow-neo-sm object-contain"
                />
              )}

              {currentQuestion.questionContext.storyAudio && (
                <div className="border-[3px] border-neo-ink bg-[#e8fff4] p-4 text-black shadow-neo-sm">
                  <div className="mb-2 flex items-center gap-2 font-mono text-xs font-black uppercase">
                    <Headphones className="size-4" />
                    Audio Mondai / Wacana
                  </div>
                  <audio controls preload="metadata" src={currentQuestion.questionContext.storyAudio} className="w-full" />
                </div>
              )}
            </section>
          )}

          {/* Question Card */}
          <section className="neo-surface bg-white p-5 sm:p-7 space-y-6 border-[3px] border-neo-ink shadow-neo">
            <div className="flex items-start justify-between gap-4 border-b-2 border-neo-ink pb-4">
              <div className="flex items-center gap-3">
                <span className="grid size-9 sm:size-10 place-items-center border-[3px] border-neo-ink bg-neo-yellow font-mono text-base sm:text-lg font-black text-black shadow-neo-sm shrink-0">
                  {currentQuestion.order}
                </span>
                <div>
                  <span className="font-mono text-[11px] font-black uppercase text-foreground/60 block">
                    SOAL NOMOR {currentQuestion.order}
                  </span>
                  <span className="font-mono text-xs font-bold text-foreground/80">
                    Pilih satu jawaban yang paling tepat
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => toggleFlag(currentQuestion.id)}
                aria-label={answerState.flagged ? "Hapus tanda ragu-ragu" : "Tandai ragu-ragu"}
                className={cn(
                  "neo-button text-xs font-black py-2 px-3 sm:px-4",
                  answerState.flagged
                    ? "bg-neo-coral text-white border-[3px] border-neo-ink shadow-neo-sm"
                    : "bg-white text-black border-2 border-neo-ink hover:bg-neo-paper",
                )}
              >
                <Flag className={cn("size-3.5", answerState.flagged ? "fill-white text-white" : "text-black")} />
                <span className="hidden sm:inline">
                  {answerState.flagged ? "Ditandai Ragu" : "Tandai Ragu"}
                </span>
              </button>
            </div>

            {/* Question Text */}
            <div className="font-japanese text-xl sm:text-2xl leading-relaxed font-bold text-neo-ink">
              {currentQuestion.questionText ? (
                <JapaneseText
                  text={currentQuestion.questionText}
                  hideFuriganaInUnderline={hideFurigana}
                />
              ) : (
                <span className="text-base sm:text-lg font-semibold text-foreground/75 font-sans">
                  Dengarkan rekaman audio di bawah, lalu tentukan pilihan jawaban yang tepat.
                </span>
              )}
            </div>

            {currentQuestion.questionImage && (
              <ImageWithLightbox
                src={currentQuestion.questionImage}
                alt="Gambar soal"
                className="max-h-96 max-w-full rounded-md border-[3px] border-neo-ink shadow-neo-sm object-contain"
              />
            )}

            {currentQuestion.questionAudio && (
              <div className="border-[3px] border-neo-ink bg-[#e8fff4] p-4 text-black shadow-neo-sm">
                <div className="mb-2 flex items-center gap-2 font-mono text-xs font-black uppercase">
                  <Headphones className="size-4" />
                  Audio Pertanyaan
                </div>
                <audio controls preload="metadata" src={currentQuestion.questionAudio} className="w-full" />
              </div>
            )}

            {/* Choices Grid */}
            <div className="grid gap-3 pt-2">
              {currentQuestion.questionChoices.map((choice) => {
                const isSelected = answerState.selectedAnswer === choice.codeAnswer;

                return (
                  <button
                    key={choice.id}
                    type="button"
                    onClick={() => setAnswer(currentQuestion.id, choice.codeAnswer)}
                    aria-pressed={isSelected}
                    className={cn(
                      "flex min-h-16 w-full items-start gap-4 border-[3px] border-neo-ink p-4 text-left font-bold transition-all",
                      isSelected
                        ? "translate-x-1 translate-y-1 bg-neo-blue text-white shadow-none"
                        : "bg-card text-card-foreground shadow-neo-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-neo hover:bg-neo-paper/50",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-8 sm:size-9 shrink-0 items-center justify-center border-2 border-neo-ink font-mono text-sm sm:text-base font-black transition-colors",
                        isSelected ? "bg-white text-black" : "bg-neo-yellow text-black",
                      )}
                    >
                      {choice.codeAnswer}
                    </span>
                    <span className="flex-1 font-japanese text-base sm:text-lg leading-7 font-bold">
                      {choice.answerText && <JapaneseText text={choice.answerText} />}
                      {choice.answerImage && (
                        <ImageWithLightbox
                          src={choice.answerImage}
                          alt={`Pilihan ${choice.codeAnswer}`}
                          className="mt-2 max-h-60 max-w-full rounded border-2 border-neo-ink object-contain"
                        />
                      )}
                      {!choice.answerText && !choice.answerImage && (
                        <span className="font-sans text-sm font-semibold opacity-80">
                          Pilihan dari audio
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Navigation Controls */}
          <nav className="flex items-center justify-between gap-3 pt-2" aria-label="Navigasi soal">
            <button
              type="button"
              disabled={currentIndex === 0}
              onClick={() => goToQuestion(currentIndex - 1)}
              className="neo-button bg-white text-black font-extrabold text-xs sm:text-sm"
            >
              <ArrowLeft className="size-4" />
              Sebelumnya
            </button>

            <div className="hidden sm:flex items-center gap-2 font-mono text-xs font-bold text-foreground/60">
              <span>Shortcut: [1-4] Pilih · [F] Ragu · [←/→] Nav</span>
            </div>

            {currentIndex < totalQuestions - 1 ? (
              <button
                type="button"
                onClick={() => goToQuestion(currentIndex + 1)}
                className="neo-button bg-neo-blue text-white font-black text-xs sm:text-sm"
              >
                Selanjutnya
                <ArrowRight className="size-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                className="neo-button bg-neo-coral text-white font-black text-xs sm:text-sm"
              >
                Submit Sesi
                <Send className="size-4" />
              </button>
            )}
          </nav>
        </div>

        {/* Right Column: Sticky Question Palette Sidebar */}
        <aside className="space-y-4">
          <div className="neo-surface sticky top-20 bg-white p-4 sm:p-5 border-[3px] border-neo-ink shadow-neo">
            <div className="border-b-2 border-neo-ink pb-3 mb-4 flex items-center justify-between">
              <div>
                <span className="font-mono text-xs font-black uppercase text-neo-ink tracking-wider block">
                  LEMBAR JAWABAN
                </span>
                <span className="font-mono text-[11px] font-bold text-foreground/60">
                  Klik nomor untuk melompat
                </span>
              </div>
              <span className="border-2 border-neo-ink bg-neo-yellow px-2 py-0.5 font-mono text-xs font-black shadow-neo-sm text-black">
                {answeredCount}/{totalQuestions}
              </span>
            </div>

            {/* Question Grid Buttons */}
            <div className="max-h-[calc(100vh-19rem)] overflow-y-auto overflow-x-hidden p-2 -mx-1.5">
              <div className="grid grid-cols-5 gap-2.5">
                {questions.map((q, index) => {
                  const state = getAnswer(q.id);
                  const isCurrent = index === currentIndex;
                  const isAnswered = state.selectedAnswer != null;
                  const isFlagged = state.flagged;

                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => goToQuestion(index)}
                      aria-label={`Buka soal ${q.order}`}
                      aria-current={isCurrent ? "step" : undefined}
                      className={cn(
                        "relative flex aspect-square items-center justify-center border-2 sm:border-[3px] border-neo-ink font-mono text-xs sm:text-sm font-black transition-all",
                        isCurrent
                          ? "bg-neo-yellow text-black ring-2 sm:ring-3 ring-neo-ink ring-offset-2 z-10 shadow-neo-sm"
                          : isAnswered
                            ? "bg-neo-blue text-white shadow-none hover:opacity-90"
                            : "bg-white text-black hover:bg-neo-paper",
                      )}
                    >
                      {q.order}
                      {isFlagged && (
                        <span className="absolute -top-1.5 -right-1.5 z-20 grid size-4 place-items-center rounded-full border-[1.5px] border-neo-ink bg-neo-coral shadow-neo-sm">
                          <Flag className="size-2.5 fill-white text-white" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Color Legend */}
            <div className="mt-5 border-t-2 border-neo-ink pt-3 space-y-2 font-mono text-[11px] font-bold text-neo-ink">
              <div className="flex items-center gap-2">
                <span className="size-3.5 border-2 border-neo-ink bg-neo-blue" />
                <span>Terjawab ({answeredCount})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="size-3.5 border-2 border-neo-ink bg-white" />
                <span>Belum Dijawab ({unansweredCount})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="size-3.5 border-2 border-neo-ink bg-neo-coral flex items-center justify-center">
                  <Flag className="size-2 fill-white text-white" />
                </span>
                <span>Ragu-ragu ({flaggedCount})</span>
              </div>
            </div>

            {/* Quick Submit Shortcut in Palette */}
            <div className="mt-5 pt-3 border-t-2 border-neo-ink">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setConfirmOpen(true)}
                className="neo-button w-full bg-neo-coral text-white font-black text-xs py-2.5"
              >
                <Send className="size-3.5" />
                Submit Sesi Ujian
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
