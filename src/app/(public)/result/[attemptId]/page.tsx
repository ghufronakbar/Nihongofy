import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Eye } from "lucide-react";
import { getAttemptSummary } from "@/features/result/actions";
import { ResultSummaryView } from "@/features/result/components/result-summary-view";
import { computeJlptScoreProjection } from "@/lib/jlpt-score";

function formatDuration(startedAt: string, finishedAt: string | null) {
  if (!finishedAt) return "-";
  const startedAtMs = Date.parse(startedAt);
  const finishedAtMs = Date.parse(finishedAt);
  if (!Number.isFinite(startedAtMs) || !Number.isFinite(finishedAtMs)) return "-";

  const minutes = Math.max(0, Math.round((finishedAtMs - startedAtMs) / 60000));
  return `${minutes} Menit`;
}

export default async function ResultSummaryPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;
  const attemptIdNum = Number(attemptId);

  if (!Number.isInteger(attemptIdNum)) {
    notFound();
  }

  const { attempt, stats, mondaiStats } = await getAttemptSummary(attemptIdNum);

  return (
    <ResultSummaryView
      testPackageName={attempt.testPackage.name}
      jlptLevel={attempt.testPackage.jlptLevel}
      sectionScope={attempt.sectionScope}
      subtitle={`Simulasi selesai dikerjakan dalam durasi ${formatDuration(attempt.startedAt, attempt.finishedAt)}.`}
      stats={stats}
      projection={computeJlptScoreProjection(mondaiStats)}
      actions={
        <>
          <Link
            href={`/result/${attempt.id}/detail`}
            className="neo-button bg-neo-blue text-white font-black text-sm"
          >
            <Eye className="size-4" />
            Review Jawaban Soal per Soal
            <ArrowRight className="size-4" />
          </Link>
          <Link
            href={`/test-package/${attempt.testPackage.id}`}
            className="neo-button bg-white text-black font-extrabold text-sm"
          >
            <ArrowLeft className="size-4" />
            Kembali ke Paket
          </Link>
          <Link
            href="/dashboard"
            className="neo-button bg-neo-paper text-black font-extrabold text-sm"
          >
            Dashboard Utama
          </Link>
        </>
      }
    />
  );
}
