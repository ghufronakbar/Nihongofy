import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, Pencil } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import {
  getExplanationEditorData,
  getNextInQueue,
} from "@/features/admin/explanation/queries";
import { ExplanationQueueFilterSchema } from "@/features/admin/explanation/schemas";
import { ExplanationForm } from "@/features/admin/explanation/components/explanation-form";
import { JLPT_SECTION_LABELS, mondaiTypeFullLabel } from "@/constants/jlpt";

export const metadata: Metadata = { title: "Edit Pembahasan - Admin" };

export default async function AdminExplanationEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ questionId: string }>;
  searchParams: Promise<{ filter?: string }>;
}) {
  await requireAdmin();

  const [{ questionId }, search] = await Promise.all([params, searchParams]);
  const id = Number(questionId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const parsedFilter = ExplanationQueueFilterSchema.safeParse(search.filter);
  const filter = parsedFilter.success ? parsedFilter.data : "unreviewed";

  const question = await getExplanationEditorData(id);
  if (!question) notFound();

  const nextId = await getNextInQueue(filter, id);
  const { explanation, testPackageItem, questionContext } = question;

  // Alasan selalu dibentuk untuk keempat pilihan, termasuk yang belum terisi,
  // supaya form punya slot tetap dan aturan "empat atau nol" mudah dipenuhi.
  const reasonByCode = new Map(
    (explanation?.choices ?? []).map((choice) => [choice.codeAnswer, choice.reason]),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/admin/explanation?filter=${filter}`}
          className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-foreground/60 hover:text-neo-blue"
        >
          <ArrowLeft className="size-3.5" />
          Kembali ke antrean
        </Link>
        <h1 className="mt-2 text-2xl font-black uppercase text-neo-ink sm:text-3xl">
          Pembahasan Soal {question.order}
        </h1>
        <p className="mt-1 text-sm font-semibold text-foreground/70">
          {testPackageItem.testPackage.jlptLevel} · {testPackageItem.testPackage.name} ·{" "}
          {mondaiTypeFullLabel(testPackageItem.mondaiType)} ·{" "}
          {JLPT_SECTION_LABELS[testPackageItem.section]}
        </p>
        {explanation && (
          <p className="mt-1 font-mono text-[11px] font-bold text-foreground/50">
            {explanation.source}
            {explanation.aiModel ? ` · ${explanation.aiModel}` : ""}
            {explanation.promptVersion ? ` · prompt ${explanation.promptVersion}` : ""}
            {explanation.reviewedAt
              ? ` · disetujui ${explanation.reviewedAt.toISOString().slice(0, 10)}`
              : " · belum disetujui"}
          </p>
        )}
      </div>

      <section className="neo-surface flex flex-col gap-3 border-[3px] border-neo-ink bg-neo-paper p-5 shadow-neo">
        <div className="flex items-start justify-between gap-3">
          <p className="font-mono text-[10px] font-black uppercase tracking-wider text-foreground/60">
            Soal
          </p>
          <Link
            href={`/admin/question/${question.id}`}
            className="inline-flex shrink-0 items-center gap-1 font-mono text-[11px] font-bold text-foreground/60 hover:text-neo-blue"
          >
            <Pencil className="size-3" />
            Edit soalnya
          </Link>
        </div>

        {questionContext?.storyText && (
          <pre className="font-japanese max-h-52 overflow-y-auto border-l-4 border-neo-ink/30 pl-3 text-xs font-semibold whitespace-pre-wrap text-foreground/70">
            {questionContext.storyText}
          </pre>
        )}

        <p className="font-japanese text-sm font-bold text-neo-ink">
          {question.questionText.trim() || (
            <span className="font-sans text-foreground/50">(tanpa teks — soal audio)</span>
          )}
        </p>

        <ol className="flex flex-col gap-1">
          {question.questionChoices.map((choice) => (
            <li key={choice.codeAnswer} className="flex items-center gap-2 text-xs font-semibold">
              <span
                className={`grid size-6 shrink-0 place-items-center border-2 border-neo-ink font-mono text-[10px] font-black ${
                  choice.codeAnswer === question.questionAnswer ? "bg-neo-yellow" : "bg-white"
                }`}
              >
                {choice.codeAnswer}
              </span>
              <span className="font-japanese">
                {choice.answerText || <span className="text-foreground/40">(tanpa teks)</span>}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <ExplanationForm
        defaultValues={{
          questionId: question.id,
          summary: explanation?.summary ?? "",
          detail: explanation?.detail ?? null,
          translation: explanation?.translation ?? null,
          keyPointsText: (explanation?.keyPoints ?? []).join("\n"),
          answerKeyDoubt: explanation?.answerKeyDoubt ?? false,
          answerKeyDoubtNote: explanation?.answerKeyDoubtNote ?? null,
          choices: question.questionChoices.map((choice) => ({
            codeAnswer: choice.codeAnswer,
            reason: reasonByCode.get(choice.codeAnswer) ?? "",
          })),
        }}
        choices={question.questionChoices.map((choice) => ({
          codeAnswer: choice.codeAnswer,
          answerText: choice.answerText,
          isKey: choice.codeAnswer === question.questionAnswer,
        }))}
        reviewedAt={explanation?.reviewedAt ?? null}
        source={explanation?.source ?? null}
        nextHref={nextId ? `/admin/explanation/${nextId}?filter=${filter}` : null}
      />
    </div>
  );
}
