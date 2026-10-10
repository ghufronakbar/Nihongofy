import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  AlertTriangle,
  ArrowLeft,
  ExternalLink,
  Image as ImageIcon,
  Pencil,
  Volume2,
} from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { getAdminTestPackage } from "@/features/admin/test-package/queries";
import { DeletePackageButton } from "@/features/admin/test-package/components/delete-package-button";
import { JLPT_SECTION_LABELS, mondaiTypeFullLabel } from "@/constants/jlpt";

export const metadata: Metadata = { title: "Detail Paket - Admin" };

export default async function AdminTestPackageDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();

  const { id } = await params;
  const packageId = Number(id);
  if (!Number.isInteger(packageId) || packageId <= 0) notFound();

  const testPackage = await getAdminTestPackage(packageId);
  if (!testPackage) notFound();

  const allQuestions = testPackage.testPackageItems.flatMap((item) => item.questions);
  const explained = allQuestions.filter((question) => question.explanation).length;
  const doubted = allQuestions.filter((question) => question.explanation?.answerKeyDoubt).length;
  const sessions = [...new Set(testPackage.testPackageItems.map((item) => item.session))].sort();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/admin/test-package"
          className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-foreground/60 hover:text-neo-blue"
        >
          <ArrowLeft className="size-3.5" />
          Kembali ke daftar
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-black uppercase text-neo-ink sm:text-3xl">
            {testPackage.name}
          </h1>
          <span className="inline-flex items-center border-2 border-neo-ink bg-neo-yellow px-2.5 py-0.5 font-mono text-xs font-black shadow-neo-sm">
            {testPackage.jlptLevel}
          </span>
        </div>
        <p className="mt-1 text-sm font-semibold text-foreground/70">
          {allQuestions.length} soal · {testPackage.testPackageItems.length} mondai ·{" "}
          {sessions.length} sesi · {testPackage._count.questionContexts} context ·{" "}
          {explained}/{allQuestions.length} punya pembahasan · {testPackage._count.attempts} attempt
        </p>
        <Link
          href={`/test-package/${testPackage.id}/questions`}
          target="_blank"
          className="mt-2 inline-flex items-center gap-1 font-mono text-[11px] font-bold text-foreground/60 hover:text-neo-blue"
        >
          <ExternalLink className="size-3" />
          Buka mode baca publik
        </Link>
      </div>

      {doubted > 0 && (
        <p className="flex items-center gap-2 border-[3px] border-neo-ink bg-neo-coral px-4 py-2.5 text-sm font-bold text-white shadow-neo-sm">
          <AlertTriangle className="size-4 shrink-0 stroke-[2.5]" />
          {doubted} soal punya kunci jawaban yang ditandai meragukan oleh generator pembahasan.
        </p>
      )}

      {testPackage.questionContexts.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-mono text-xs font-black uppercase tracking-wider text-foreground/60">
            Wacana bersama ({testPackage.questionContexts.length})
          </h2>
          <ul className="neo-surface flex flex-col border-[3px] border-neo-ink bg-white shadow-neo">
            {testPackage.questionContexts.map((context) => (
              <li
                key={context.id}
                className="flex flex-wrap items-center gap-3 border-b-2 border-neo-ink/15 px-4 py-2.5 last:border-b-0"
              >
                <span className="font-mono text-[10px] font-black text-foreground/50">
                  #{context.id}
                </span>
                <span className="font-japanese line-clamp-1 min-w-0 flex-1 text-sm font-semibold">
                  {context.storyText?.trim() || (
                    <span className="font-sans text-foreground/40">(tanpa teks)</span>
                  )}
                </span>
                <span className="flex shrink-0 items-center gap-2 font-mono text-[10px] text-foreground/50">
                  {context.storyImage && (
                    <span className="inline-flex items-center gap-0.5">
                      <ImageIcon className="size-3" /> gambar
                    </span>
                  )}
                  {context.storyAudio && (
                    <span className="inline-flex items-center gap-0.5">
                      <Volume2 className="size-3" /> audio
                    </span>
                  )}
                  {context._count.questions} soal
                </span>
                <Link
                  href={`/admin/context/${context.id}`}
                  className="neo-button shrink-0 bg-white text-[11px] font-extrabold text-black"
                >
                  <Pencil className="size-3.5" />
                  Edit
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {testPackage.testPackageItems.map((item) => (
        <section key={item.id} className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline gap-2">
            <h2 className="text-lg font-black uppercase text-neo-ink">
              {mondaiTypeFullLabel(item.mondaiType)}
            </h2>
            <span className="font-mono text-[11px] font-bold text-foreground/60">
              sesi {item.session} · urutan {item.order} · {JLPT_SECTION_LABELS[item.section]} ·{" "}
              {item.questions.length} soal
            </span>
          </div>

          {item.instruction && (
            <p className="border-l-4 border-neo-ink bg-neo-paper px-3 py-2 text-xs font-semibold text-foreground/75">
              {item.instruction}
            </p>
          )}

          <div className="neo-surface min-w-0 overflow-x-auto border-[3px] border-neo-ink bg-white shadow-neo">
            <table className="w-full min-w-2xl border-collapse text-sm">
              <thead>
                <tr className="border-b-[3px] border-neo-ink bg-neo-paper text-left">
                  <th className="w-16 px-3 py-2 font-mono text-[10px] font-black uppercase">No</th>
                  <th className="px-3 py-2 font-mono text-[10px] font-black uppercase">Soal</th>
                  <th className="w-28 px-3 py-2 font-mono text-[10px] font-black uppercase">
                    Media
                  </th>
                  <th className="w-20 px-3 py-2 font-mono text-[10px] font-black uppercase">Kunci</th>
                  <th className="w-44 px-3 py-2 font-mono text-[10px] font-black uppercase">
                    Pembahasan
                  </th>
                </tr>
              </thead>
              <tbody>
                {item.questions.map((question) => {
                  const imageSources = [
                    question.questionContext?.storyImage ? "wacana" : null,
                    question.questionImage ? "soal" : null,
                    question.questionChoices.some((choice) => Boolean(choice.answerImage))
                      ? "jawaban"
                      : null,
                  ].filter((source): source is string => source !== null);
                  const audioSources = [
                    question.questionContext?.storyAudio ? "wacana" : null,
                    question.questionAudio ? "soal" : null,
                  ].filter((source): source is string => source !== null);

                  return (
                    <tr
                      key={question.id}
                      className="border-b-2 border-neo-ink/15 last:border-b-0"
                    >
                      <td className="px-3 py-2 font-mono text-xs font-black">{question.order}</td>
                      <td className="px-3 py-2">
                        <Link
                          href={`/admin/question/${question.id}`}
                          className="line-clamp-2 font-semibold text-neo-ink underline-offset-4 hover:underline"
                        >
                          {question.questionText.trim() || (
                            <span className="text-foreground/50">(tanpa teks — soal audio)</span>
                          )}
                        </Link>
                        <span className="mt-0.5 flex flex-wrap items-center gap-2 font-mono text-[10px] text-foreground/50">
                          {question.questionContextId && (
                            <span>context #{question.questionContextId}</span>
                          )}
                          {question._count.questionChoices !== 4 && (
                            <span className="font-black text-neo-coral">
                              {question._count.questionChoices} pilihan
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="flex items-center gap-1.5">
                          {imageSources.length > 0 && (
                            <span
                              className="grid size-7 place-items-center border-2 border-neo-ink bg-neo-yellow text-black shadow-neo-sm"
                              aria-label={`Memiliki gambar dari ${imageSources.join(", ")}`}
                              title={`Gambar: ${imageSources.join(", ")}`}
                            >
                              <ImageIcon className="size-3.5" aria-hidden="true" />
                            </span>
                          )}
                          {audioSources.length > 0 && (
                            <span
                              className="grid size-7 place-items-center border-2 border-neo-ink bg-neo-blue text-white shadow-neo-sm"
                              aria-label={`Memiliki audio dari ${audioSources.join(", ")}`}
                              title={`Audio: ${audioSources.join(", ")}`}
                            >
                              <Volume2 className="size-3.5" aria-hidden="true" />
                            </span>
                          )}
                          {imageSources.length === 0 && audioSources.length === 0 && (
                            <span className="font-mono text-xs text-foreground/30">—</span>
                          )}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono text-sm font-black">
                        {question.questionAnswer}
                      </td>
                      <td className="px-3 py-2">
                        {!question.explanation ? (
                          <Link
                            href={`/admin/explanation/${question.id}`}
                            className="font-mono text-[10px] font-bold text-foreground/50 underline-offset-4 hover:text-neo-blue hover:underline"
                          >
                            belum ada — tulis
                          </Link>
                        ) : (
                          <Link
                            href={`/admin/explanation/${question.id}`}
                            className="flex flex-wrap items-center gap-1.5 underline-offset-4 hover:underline"
                          >
                            <span className="inline-flex items-center border-2 border-neo-ink bg-white px-1.5 py-0 font-mono text-[10px] font-black">
                              {question.explanation.source}
                            </span>
                            {question.explanation.reviewedAt ? (
                              <span className="inline-flex items-center border-2 border-neo-ink bg-neo-paper px-1.5 py-0 font-mono text-[10px] font-black">
                                direview
                              </span>
                            ) : (
                              <span className="font-mono text-[10px] font-bold text-foreground/50">
                                belum direview
                              </span>
                            )}
                            {question.explanation.answerKeyDoubt && (
                              <span className="inline-flex items-center border-2 border-neo-ink bg-neo-coral px-1.5 py-0 font-mono text-[10px] font-black text-white">
                                kunci ragu
                              </span>
                            )}
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <section className="flex flex-col gap-3 border-t-[3px] border-neo-ink pt-6">
        <h2 className="font-mono text-xs font-black uppercase tracking-wider text-foreground/60">
          Zona Berbahaya
        </h2>
        <DeletePackageButton
          id={testPackage.id}
          name={testPackage.name}
          attemptCount={testPackage._count.attempts}
        />
      </section>
    </div>
  );
}
