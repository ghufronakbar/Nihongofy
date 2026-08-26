"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  CircleHelp,
  Headphones,
  RotateCcw,
  Trophy,
  X,
} from "lucide-react";
import { JapanesePassage } from "@/components/japanese-passage";
import { JapaneseText } from "@/components/japanese-text";
import { ImageWithLightbox } from "@/components/image-with-lightbox";
import { JLPT_SECTION_LABELS, mondaiTypeFullLabel } from "@/constants/jlpt";
import { cn } from "@/lib/utils";
import {
  restartPracticeSessionAction,
  submitPracticeAnswerAction,
} from "../actions";

type Feedback = {
  correctAnswer: number;
  explanation: string | null;
};

type PracticeQuestion = {
  id: number;
  order: number;
  assignmentOrder: number;
  selectedAnswer: number | null;
  isCorrect: boolean | null;
  answeredAt: string | null;
  feedback: Feedback | null;
  questionText: string;
  questionImage: string | null;
  questionAudio: string | null;
  questionChoices: {
    id: number;
    codeAnswer: number;
    answerText: string;
    answerImage: string | null;
  }[];
  questionContext: {
    id: number;
    storyText: string | null;
    storyImage: string | null;
    storyAudio: string | null;
  } | null;
  testPackageItem: {
    instruction: string | null;
    mondaiType: string;
  };
};

type PracticeRunnerProps = {
  practiceSession: {
    id: number;
    jlptLevel: string;
    section: string;
    mondaiType: string;
    questionCount: number;
    status: string;
    questions: PracticeQuestion[];
  };
};

export function PracticeRunner({ practiceSession }: PracticeRunnerProps) {
  const initialQuestions = practiceSession.questions;
  const firstUnanswered = initialQuestions.findIndex((question) => question.answeredAt === null);
  const [questions, setQuestions] = useState(initialQuestions);
  const [currentIndex, setCurrentIndex] = useState(
    firstUnanswered >= 0 ? firstUnanswered : Math.max(initialQuestions.length - 1, 0),
  );
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(practiceSession.status === "COMPLETED");
  const [isPending, startTransition] = useTransition();

  const answeredCount = useMemo(
    () => questions.filter((question) => question.answeredAt !== null).length,
    [questions],
  );
  const correctCount = useMemo(
    () => questions.filter((question) => question.isCorrect === true).length,
    [questions],
  );
  const scorePercentage = questions.length
    ? Math.round((correctCount / questions.length) * 100)
    : 0;

  if (questions.length === 0) {
    return (
      <div className="neo-surface mx-auto max-w-xl p-8 text-center">
        <h1 className="text-2xl font-black">Sesi ini tidak memiliki soal.</h1>
        <Link href="/exercises" className="neo-button mt-6">
          Kembali ke konfigurasi
        </Link>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const isAnswered = currentQuestion.answeredAt !== null;
  const activeSelection = isAnswered ? currentQuestion.selectedAnswer : selectedAnswer;
  const hideFurigana = currentQuestion.testPackageItem.mondaiType === "MOJI_GOI_READ_KANJI";
  const progressPercentage = Math.round((answeredCount / questions.length) * 100);

  function goToQuestion(index: number) {
    const nextIndex = Math.min(Math.max(index, 0), questions.length - 1);
    setCurrentIndex(nextIndex);
    setSelectedAnswer(null);
    setError(null);
    setShowSummary(false);
  }

  function submitCurrentAnswer() {
    if (selectedAnswer === null || isAnswered) return;
    setError(null);
    startTransition(async () => {
      const result = await submitPracticeAnswerAction({
        sessionId: practiceSession.id,
        questionId: currentQuestion.id,
        selectedAnswer,
      });

      if (!result.ok) {
        setError(result.message);
        return;
      }

      setQuestions((current) =>
        current.map((question) =>
          question.id === result.questionId
            ? {
                ...question,
                selectedAnswer: result.selectedAnswer,
                isCorrect: result.isCorrect,
                answeredAt: result.answeredAt,
                feedback: {
                  correctAnswer: result.correctAnswer,
                  explanation: result.explanation,
                },
              }
            : question,
        ),
      );
      setSelectedAnswer(null);
    });
  }

  function handleContinue() {
    const nextUnanswered = questions.findIndex(
      (question, index) => index > currentIndex && question.answeredAt === null,
    );
    if (nextUnanswered >= 0) {
      goToQuestion(nextUnanswered);
      return;
    }

    const anyUnanswered = questions.findIndex((question) => question.answeredAt === null);
    if (anyUnanswered >= 0) {
      goToQuestion(anyUnanswered);
      return;
    }

    setShowSummary(true);
  }

  function restart() {
    startTransition(() => restartPracticeSessionAction({ sessionId: practiceSession.id }));
  }

  if (showSummary) {
    return (
      <main className="page-reveal mx-auto flex w-full max-w-5xl flex-1 items-center justify-center py-6 sm:py-12">
        <section className="neo-surface w-full overflow-hidden">
          <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
            <div className="bg-neo-green p-7 sm:p-10">
              <Trophy className="size-16" strokeWidth={2.5} />
              <p className="mt-6 font-mono text-xs font-black tracking-[0.12em] uppercase">
                Latihan selesai
              </p>
              <h1 className="mt-2 text-4xl leading-none font-black sm:text-6xl">
                {scorePercentage}% akurat.
              </h1>
              <p className="mt-4 max-w-md text-base font-bold">
                Kamu menjawab {correctCount} dari {questions.length} soal dengan benar. Ini hasil
                latihan, bukan proyeksi skor resmi JLPT.
              </p>
            </div>

            <div className="bg-card p-7 sm:p-10">
              <h2 className="text-2xl font-black">Ringkasan sesi</h2>
              <dl className="mt-6 grid grid-cols-2 gap-3">
                <div className="border-[3px] border-neo-ink bg-neo-blue p-4 text-black shadow-neo-sm">
                  <dt className="text-xs font-bold uppercase">Benar</dt>
                  <dd className="mt-1 text-4xl font-black">{correctCount}</dd>
                </div>
                <div className="border-[3px] border-neo-ink bg-neo-coral p-4 text-black shadow-neo-sm">
                  <dt className="text-xs font-bold uppercase">Perlu ulang</dt>
                  <dd className="mt-1 text-4xl font-black">{questions.length - correctCount}</dd>
                </div>
              </dl>

              <div className="mt-7 flex flex-col gap-3">
                <button type="button" onClick={restart} disabled={isPending} className="neo-button w-full bg-neo-yellow">
                  <RotateCcw className="size-5" />
                  {isPending ? "Menyiapkan ulang..." : "Ulangi soal yang sama"}
                </button>
                <button type="button" onClick={() => goToQuestion(0)} disabled={isPending} className="neo-button w-full bg-white text-black">
                  <CircleHelp className="size-5" />
                  Tinjau jawaban
                </button>
                <Link href="/exercises" className="neo-button w-full bg-neo-blue">
                  Buat latihan baru
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="page-reveal mx-auto w-full max-w-6xl space-y-5 pb-10">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link href="/exercises" className="inline-flex items-center gap-2 text-sm font-black underline underline-offset-4">
            <ArrowLeft className="size-4" />
            Kembali ke latihan
          </Link>
          <p className="mt-5 text-sm font-bold text-muted-foreground">
            {practiceSession.jlptLevel} · {JLPT_SECTION_LABELS[practiceSession.section as keyof typeof JLPT_SECTION_LABELS]}
          </p>
          <h1 className="mt-1 text-3xl font-black sm:text-4xl">
            {mondaiTypeFullLabel(practiceSession.mondaiType as Parameters<typeof mondaiTypeFullLabel>[0])}
          </h1>
        </div>
        <button type="button" onClick={restart} disabled={isPending} className="neo-button self-start bg-white text-black lg:self-auto">
          <RotateCcw className="size-4" />
          Mulai ulang
        </button>
      </header>

      <section className="neo-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-black">
          <span>Soal {currentIndex + 1} dari {questions.length}</span>
          <span>{correctCount} benar dari {answeredCount} dijawab</span>
        </div>
        <div className="mt-3 h-4 overflow-hidden border-[3px] border-neo-ink bg-white" aria-label={`${progressPercentage}% selesai`}>
          <div className="h-full bg-neo-blue transition-[width] duration-300" style={{ width: `${progressPercentage}%` }} />
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_15rem]">
        <section className="space-y-5">
          {currentQuestion.testPackageItem.instruction && (
            <div className="border-[3px] border-neo-ink bg-neo-yellow p-4 text-sm font-bold text-black shadow-neo-sm">
              <JapaneseText text={currentQuestion.testPackageItem.instruction} />
            </div>
          )}

          {currentQuestion.questionContext && (
            <div className="neo-surface space-y-4 p-5 sm:p-7">
              {currentQuestion.questionContext.storyText && (
                <JapanesePassage text={currentQuestion.questionContext.storyText} className="font-japanese leading-8" />
              )}
              {currentQuestion.questionContext.storyImage && (
                <ImageWithLightbox
                  src={currentQuestion.questionContext.storyImage}
                  alt="Materi pendukung soal"
                  className="max-h-[32rem] max-w-full border-[3px] border-neo-ink object-contain"
                />
              )}
              {currentQuestion.questionContext.storyAudio && (
                <div className="border-[3px] border-neo-ink bg-[#e8fff4] p-4 text-black">
                  <div className="mb-3 flex items-center gap-2 font-black">
                    <Headphones className="size-5" />
                    Audio mondai
                  </div>
                  <audio controls preload="metadata" src={currentQuestion.questionContext.storyAudio} className="w-full" />
                </div>
              )}
            </div>
          )}

          <div className="neo-surface p-5 sm:p-7">
            <p className="font-mono text-xs font-black tracking-[0.12em] uppercase">Pertanyaan</p>
            <div className="mt-3 font-japanese text-xl leading-9 font-bold sm:text-2xl">
              {currentQuestion.questionText ? (
                <JapaneseText
                  text={currentQuestion.questionText}
                  hideFuriganaInUnderline={hideFurigana}
                />
              ) : (
                <span>Dengarkan audio, lalu pilih jawaban yang paling tepat.</span>
              )}
            </div>

            {currentQuestion.questionImage && (
              <ImageWithLightbox
                src={currentQuestion.questionImage}
                alt="Gambar pertanyaan"
                className="mt-5 max-h-96 max-w-full border-[3px] border-neo-ink object-contain"
              />
            )}

            {currentQuestion.questionAudio && (
              <div className="mt-5 border-[3px] border-neo-ink bg-[#e8fff4] p-4 text-black">
                <div className="mb-3 flex items-center gap-2 font-black">
                  <Headphones className="size-5" />
                  Audio soal
                </div>
                <audio controls preload="metadata" src={currentQuestion.questionAudio} className="w-full" />
              </div>
            )}
          </div>

          <div className="grid gap-3">
            {currentQuestion.questionChoices.map((choice) => {
              const isSelected = activeSelection === choice.codeAnswer;
              const isCorrectChoice = isAnswered && currentQuestion.feedback?.correctAnswer === choice.codeAnswer;
              const isWrongSelection = isAnswered && isSelected && !isCorrectChoice;

              return (
                <button
                  key={choice.id}
                  type="button"
                  disabled={isAnswered || isPending}
                  aria-pressed={isSelected}
                  onClick={() => {
                    setSelectedAnswer(choice.codeAnswer);
                    setError(null);
                  }}
                  className={cn(
                    "flex min-h-16 w-full items-start gap-4 border-[3px] border-neo-ink bg-card p-4 text-left shadow-neo-sm transition-[transform,box-shadow,background-color,opacity]",
                    !isAnswered && "hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-neo",
                    isSelected && !isAnswered && "translate-x-1 translate-y-1 bg-neo-blue shadow-none",
                    isCorrectChoice && "bg-neo-green text-black shadow-none",
                    isWrongSelection && "bg-neo-coral text-black shadow-none",
                    isAnswered && !isCorrectChoice && !isWrongSelection && "opacity-55",
                  )}
                >
                  <span className="flex size-8 shrink-0 items-center justify-center border-[3px] border-neo-ink bg-white text-sm font-black text-black">
                    {choice.codeAnswer}
                  </span>
                  <span className="flex-1 font-japanese text-base leading-7 font-bold">
                    {choice.answerText && <JapaneseText text={choice.answerText} />}
                    {choice.answerImage && (
                      <ImageWithLightbox
                        src={choice.answerImage}
                        alt={`Pilihan ${choice.codeAnswer}`}
                        className="mt-2 max-h-64 max-w-full border-2 border-neo-ink object-contain"
                      />
                    )}
                    {!choice.answerText && !choice.answerImage && "Pilihan dari audio"}
                  </span>
                  {isCorrectChoice && <Check className="mt-1 size-6 shrink-0" />}
                  {isWrongSelection && <X className="mt-1 size-6 shrink-0" />}
                </button>
              );
            })}
          </div>

          {error && (
            <p role="alert" className="border-[3px] border-neo-ink bg-neo-coral p-4 font-bold text-black shadow-neo-sm">
              {error}
            </p>
          )}

          {!isAnswered ? (
            <button
              type="button"
              disabled={selectedAnswer === null || isPending}
              onClick={submitCurrentAnswer}
              className="neo-button w-full bg-neo-blue py-4 text-base sm:w-auto sm:min-w-56"
            >
              <CheckCircle2 className="size-5" />
              {isPending ? "Memeriksa..." : "Periksa jawaban"}
            </button>
          ) : (
            <div
              className={cn(
                "border-[3px] border-neo-ink p-5 text-black shadow-neo-sm",
                currentQuestion.isCorrect ? "bg-[#c8ffe5]" : "bg-[#fff0ae]",
              )}
            >
              <h2 className="flex items-center gap-2 text-xl font-black">
                {currentQuestion.isCorrect ? (
                  <CheckCircle2 className="size-6" />
                ) : (
                  <CircleHelp className="size-6" />
                )}
                {currentQuestion.isCorrect ? "Tepat." : "Belum tepat."}
              </h2>
              <div className="mt-3 font-japanese leading-7">
                {currentQuestion.feedback?.explanation ? (
                  <JapanesePassage text={currentQuestion.feedback.explanation} />
                ) : (
                  <p>Kunci jawaban sudah ditandai. Penjelasan untuk soal ini belum tersedia.</p>
                )}
              </div>
            </div>
          )}

          <nav className="flex items-center justify-between gap-3" aria-label="Navigasi soal latihan">
            <button
              type="button"
              disabled={currentIndex === 0 || isPending}
              onClick={() => goToQuestion(currentIndex - 1)}
              className="neo-button bg-white text-black"
            >
              <ArrowLeft className="size-4" />
              Sebelumnya
            </button>

            {isAnswered && (
              <button type="button" disabled={isPending} onClick={handleContinue} className="neo-button bg-neo-blue">
                {answeredCount === questions.length ? "Lihat ringkasan" : "Soal berikutnya"}
                <ArrowRight className="size-4" />
              </button>
            )}
          </nav>
        </section>

        <aside className="neo-surface h-fit p-4 lg:sticky lg:top-4">
          <p className="font-mono text-xs font-black tracking-[0.12em] uppercase">Peta soal</p>
          <div className="mt-4 grid grid-cols-5 gap-2 lg:grid-cols-4">
            {questions.map((question, index) => (
              <button
                key={question.id}
                type="button"
                onClick={() => goToQuestion(index)}
                aria-label={`Buka soal ${index + 1}`}
                aria-current={currentIndex === index ? "step" : undefined}
                className={cn(
                  "flex aspect-square items-center justify-center border-[3px] border-neo-ink bg-white text-sm font-black text-black",
                  question.isCorrect === true && "bg-neo-green",
                  question.isCorrect === false && "bg-neo-coral",
                  currentIndex === index && "translate-x-0.5 translate-y-0.5 shadow-none ring-2 ring-neo-blue ring-offset-2",
                )}
              >
                {index + 1}
              </button>
            ))}
          </div>
          <div className="mt-5 space-y-2 text-xs font-bold">
            <p>Hijau: benar</p>
            <p>Merah: perlu ulang</p>
            <p>Putih: belum dijawab</p>
          </div>
        </aside>
      </div>
    </main>
  );
}
