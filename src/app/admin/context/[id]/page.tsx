import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AlertTriangle, ArrowLeft, Pencil } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { getAdminQuestionContext } from "@/features/admin/test-package/queries";
import { ContextForm } from "@/features/admin/test-package/components/context-form";
import { mondaiTypeFullLabel } from "@/constants/jlpt";

export const metadata: Metadata = { title: "Edit Wacana - Admin" };

export default async function AdminQuestionContextPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();

  const { id } = await params;
  const contextId = Number(id);
  if (!Number.isInteger(contextId) || contextId <= 0) notFound();

  const context = await getAdminQuestionContext(contextId);
  if (!context) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/admin/test-package/${context.testPackage.id}`}
          className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-foreground/60 hover:text-neo-blue"
        >
          <ArrowLeft className="size-3.5" />
          {context.testPackage.name}
        </Link>
        <h1 className="mt-2 text-2xl font-black uppercase text-neo-ink sm:text-3xl">
          Wacana #{context.id}
        </h1>
        <p className="mt-1 text-sm font-semibold text-foreground/70">
          {context.testPackage.jlptLevel} · dipakai {context.questions.length} soal
        </p>
      </div>

      {context.questions.length > 1 && (
        <p className="flex items-start gap-2 border-[3px] border-neo-ink bg-neo-yellow px-4 py-2.5 text-sm font-bold text-black shadow-neo-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 stroke-[2.5]" />
          Wacana ini dipakai bersama oleh {context.questions.length} soal. Perubahan di sini
          terasa di semuanya sekaligus, bukan hanya pada satu soal.
        </p>
      )}

      <ContextForm
        context={{
          id: context.id,
          storyText: context.storyText,
          storyImage: context.storyImage,
          storyAudio: context.storyAudio,
        }}
        questionCount={context.questions.length}
      />

      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-xs font-black uppercase tracking-wider text-foreground/60">
          Soal yang memakai wacana ini
        </h2>
        <ul className="neo-surface flex flex-col border-[3px] border-neo-ink bg-white shadow-neo">
          {context.questions.map((question) => (
            <li
              key={question.id}
              className="flex flex-wrap items-center gap-3 border-b-2 border-neo-ink/15 px-4 py-2.5 last:border-b-0"
            >
              <span className="font-mono text-[10px] font-black text-foreground/50">
                sesi {question.testPackageItem.session}
              </span>
              <span className="font-mono text-[10px] text-foreground/50">
                {mondaiTypeFullLabel(question.testPackageItem.mondaiType)}
              </span>
              <span className="font-mono text-xs font-black">no {question.order}</span>
              <span className="font-japanese line-clamp-1 min-w-0 flex-1 text-sm font-semibold">
                {question.questionText.trim() || (
                  <span className="font-sans text-foreground/40">(tanpa teks — soal audio)</span>
                )}
              </span>
              <Link
                href={`/admin/question/${question.id}`}
                className="neo-button shrink-0 bg-white text-[11px] font-extrabold text-black"
              >
                <Pencil className="size-3.5" />
                Edit soal
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
