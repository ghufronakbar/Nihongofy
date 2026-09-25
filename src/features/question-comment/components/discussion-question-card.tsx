import { JapaneseText } from "@/components/japanese-text";
import { JapanesePassage } from "@/components/japanese-passage";
import { QuestionExplanationBody } from "@/components/question-explanation";
import { FuriganaScope } from "@/components/furigana-scope";
import { cn } from "@/lib/utils";
import type { DiscussionQuestion } from "../queries";

// Soal lengkap beserta kunci dan pembahasan resminya. Tidak ada kebocoran kunci
// jawaban di sini: mode baca `/test-package/[id]/questions` memang sudah publik.
export function DiscussionQuestionCard({ question }: { question: DiscussionQuestion }) {
  return (
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
  );
}
