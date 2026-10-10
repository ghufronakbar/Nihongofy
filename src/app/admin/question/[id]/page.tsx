import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AlertTriangle, ArrowLeft, Pencil } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { getAdminQuestion } from "@/features/admin/test-package/queries";
import { QuestionForm } from "@/features/admin/test-package/components/question-form";
import { JLPT_SECTION_LABELS, mondaiTypeFullLabel } from "@/constants/jlpt";
import { testPackageStorageSlug } from "@/lib/storage-keys";

export const metadata: Metadata = { title: "Edit Soal - Admin" };

export default async function AdminQuestionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();

  const { id } = await params;
  const questionId = Number(id);
  if (!Number.isInteger(questionId) || questionId <= 0) notFound();

  const question = await getAdminQuestion(questionId);
  if (!question) notFound();

  const { testPackageItem, explanation, questionContext } = question;
  const packageSlug = testPackageStorageSlug(
    testPackageItem.testPackage.name,
    testPackageItem.testPackage.jlptLevel,
  );
  if (!packageSlug) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/admin/test-package/${testPackageItem.testPackage.id}`}
          className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-foreground/60 hover:text-neo-blue"
        >
          <ArrowLeft className="size-3.5" />
          {testPackageItem.testPackage.name}
        </Link>
        <h1 className="mt-2 text-2xl font-black uppercase text-neo-ink sm:text-3xl">
          Soal {question.order}
        </h1>
        <p className="mt-1 text-sm font-semibold text-foreground/70">
          {testPackageItem.testPackage.jlptLevel} ·{" "}
          {mondaiTypeFullLabel(testPackageItem.mondaiType)} ·{" "}
          {JLPT_SECTION_LABELS[testPackageItem.section]} · sesi {testPackageItem.session}
        </p>
      </div>

      {explanation?.answerKeyDoubt && (
        <div className="flex flex-col gap-1 border-[3px] border-neo-ink bg-neo-coral px-4 py-3 text-white shadow-neo-sm">
          <p className="flex items-center gap-2 text-sm font-black">
            <AlertTriangle className="size-4 shrink-0 stroke-[2.5]" />
            Kunci jawaban ditandai meragukan oleh generator pembahasan
          </p>
          {explanation.answerKeyDoubtNote && (
            <p className="pl-6 text-xs font-semibold">{explanation.answerKeyDoubtNote}</p>
          )}
        </div>
      )}

      {questionContext && (
        <section className="neo-surface flex flex-col gap-2 border-[3px] border-neo-ink bg-neo-paper p-5 shadow-neo">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-mono text-[10px] font-black uppercase tracking-wider text-foreground/60">
              Wacana bersama (context #{questionContext.id})
            </p>
            <Link
              href={`/admin/context/${questionContext.id}`}
              className="inline-flex shrink-0 items-center gap-1 font-mono text-[11px] font-bold text-foreground/60 hover:text-neo-blue"
            >
              <Pencil className="size-3" />
              Edit wacana
            </Link>
          </div>
          {questionContext.storyText && (
            <pre className="font-japanese whitespace-pre-wrap text-xs font-semibold text-foreground/80">
              {questionContext.storyText}
            </pre>
          )}
          <p className="font-mono text-[10px] text-foreground/50">
            {questionContext.storyImage ? "punya gambar · " : ""}
            {questionContext.storyAudio ? "punya audio" : ""}
          </p>
        </section>
      )}

      <QuestionForm
        testPackageId={testPackageItem.testPackage.id}
        packageSlug={packageSlug}
        question={{
          id: question.id,
          questionText: question.questionText,
          questionImage: question.questionImage,
          questionAudio: question.questionAudio,
          questionAnswer: question.questionAnswer,
          instruction: testPackageItem.instruction,
          choices: question.questionChoices.map((choice) => ({
            id: choice.id,
            codeAnswer: choice.codeAnswer,
            answerText: choice.answerText,
            answerImage: choice.answerImage,
          })),
        }}
      />

      {!explanation && (
        <Link
          href={`/admin/explanation/${question.id}`}
          className="neo-button self-start bg-white text-xs font-extrabold text-black"
        >
          <Pencil className="size-4" />
          Tulis pembahasan
        </Link>
      )}

      {explanation && (
        <section className="neo-surface flex flex-col gap-2 border-[3px] border-neo-ink bg-white p-5 shadow-neo">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-mono text-[10px] font-black uppercase tracking-wider text-foreground/60">
              Pembahasan ({explanation.source}
              {explanation.reviewedAt ? ", sudah direview" : ", belum direview"})
            </p>
            <Link
              href={`/admin/explanation/${question.id}`}
              className="inline-flex shrink-0 items-center gap-1 font-mono text-[11px] font-bold text-foreground/60 hover:text-neo-blue"
            >
              <Pencil className="size-3" />
              Edit pembahasan
            </Link>
          </div>
          <p className="font-japanese text-xs font-semibold text-foreground/80">
            {explanation.summary}
          </p>
        </section>
      )}
    </div>
  );
}
