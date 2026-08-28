import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  CheckCircle2,
  Clock,
  Eye,
  Flag,
  HelpCircle,
  Sparkles,
  Trophy,
  XCircle,
} from "lucide-react";
import { getAttemptSummary } from "@/features/result/actions";
import { JlptScoreTable } from "@/components/jlpt-score-table";
import { computeJlptScoreProjection } from "@/lib/jlpt-score";
import { JLPT_SECTION_LABELS } from "@/constants/jlpt";
import type { JlptLevel } from "@prisma/client";

const LEVEL_BADGE_STYLES: Record<JlptLevel, string> = {
  N5: "bg-neo-green text-black",
  N4: "bg-neo-blue text-white",
  N3: "bg-neo-yellow text-black",
  N2: "bg-neo-coral text-white",
  N1: "bg-purple-400 text-white",
};

function formatDuration(startedAt: Date, finishedAt: Date | null) {
  if (!finishedAt) return "-";
  const minutes = Math.round((finishedAt.getTime() - startedAt.getTime()) / 60000);
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
  const projection = computeJlptScoreProjection(mondaiStats);
  const levelStyle =
    LEVEL_BADGE_STYLES[attempt.testPackage.jlptLevel] || "bg-neo-blue text-white";

  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8">
      {/* Hero Result Banner */}
      <section className="neo-surface neo-grid-paper relative overflow-hidden bg-white p-6 sm:p-8 md:p-10 border-[3px] border-neo-ink shadow-neo-lg">
        <div
          className="absolute -top-10 -right-8 hidden size-36 rotate-12 border-[3px] border-neo-ink bg-neo-yellow shadow-neo sm:block"
          aria-hidden="true"
        />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-xl">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`border-2 border-neo-ink ${levelStyle} px-3 py-0.5 font-mono text-xs font-black shadow-neo-sm`}
              >
                JLPT {attempt.testPackage.jlptLevel}
              </span>
              <span className="neo-kicker bg-white">
                {attempt.sectionScope
                  ? `LATIHAN ${JLPT_SECTION_LABELS[attempt.sectionScope]}`
                  : "MOCK TEST SIMULASI"}
              </span>
            </div>

            <h1 className="mt-3 text-3xl sm:text-5xl font-black uppercase text-neo-ink leading-tight">
              {attempt.testPackage.name}
            </h1>

            <p className="mt-2 text-sm sm:text-base font-semibold text-foreground/75">
              Simulasi selesai dikerjakan dalam durasi {formatDuration(attempt.startedAt, attempt.finishedAt)}.
            </p>
          </div>

          {/* Big Score Bubble */}
          <div className="border-[3px] border-neo-ink bg-neo-yellow p-6 rounded-xl shadow-neo text-center shrink-0 self-start md:self-auto min-w-[200px]">
            <span className="font-mono text-xs font-black uppercase text-black/70 block">
              AKURASI KESELURUHAN
            </span>
            <div className="text-5xl sm:text-6xl font-black text-neo-ink mt-1 tracking-tight">
              {stats.scorePercentage}%
            </div>
            <div className="mt-2 inline-flex items-center gap-1.5 border border-neo-ink bg-white px-2.5 py-1 font-mono text-xs font-black shadow-neo-sm">
              <CheckCircle2 className="size-3.5 text-emerald-600" />
              {stats.totalCorrect}/{stats.totalQuestions} Benar
            </div>
          </div>
        </div>
      </section>

      {/* 4 Stat KPI Grid */}
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="neo-surface bg-white p-5 border-[3px] border-neo-ink shadow-neo">
          <div className="flex items-center justify-between">
            <p className="font-mono text-xs font-black uppercase text-foreground/60">Benar</p>
            <CheckCircle2 className="size-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-3xl sm:text-4xl font-black text-emerald-600 tabular-nums">
            {stats.totalCorrect}
          </p>
        </div>

        <div className="neo-surface bg-white p-5 border-[3px] border-neo-ink shadow-neo">
          <div className="flex items-center justify-between">
            <p className="font-mono text-xs font-black uppercase text-foreground/60">Salah</p>
            <XCircle className="size-4 text-rose-600" />
          </div>
          <p className="mt-2 text-3xl sm:text-4xl font-black text-rose-600 tabular-nums">
            {stats.totalWrong}
          </p>
        </div>

        <div className="neo-surface bg-white p-5 border-[3px] border-neo-ink shadow-neo">
          <div className="flex items-center justify-between">
            <p className="font-mono text-xs font-black uppercase text-foreground/60">Kosong</p>
            <HelpCircle className="size-4 text-foreground/40" />
          </div>
          <p className="mt-2 text-3xl sm:text-4xl font-black text-neo-ink tabular-nums">
            {stats.totalUnanswered}
          </p>
        </div>

        <div className="neo-surface bg-white p-5 border-[3px] border-neo-ink shadow-neo">
          <div className="flex items-center justify-between">
            <p className="font-mono text-xs font-black uppercase text-foreground/60">Ragu-ragu</p>
            <Flag className="size-4 text-amber-500" />
          </div>
          <p className="mt-2 text-3xl sm:text-4xl font-black text-neo-ink tabular-nums">
            {stats.totalFlagged}
          </p>
        </div>
      </section>

      {/* Projection Score Section */}
      {projection.sections.length > 0 && (
        <section className="neo-surface bg-white p-6 sm:p-8 border-[3px] border-neo-ink shadow-neo">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b-[3px] border-neo-ink pb-4 mb-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="border-2 border-neo-ink bg-neo-green px-2.5 py-0.5 font-mono text-xs font-black uppercase shadow-neo-sm">
                  SKALA RESMI 180 POIN
                </span>
                <span className="font-mono text-xs font-bold text-foreground/60">
                  JLPT {attempt.testPackage.jlptLevel}
                </span>
              </div>
              <h2 className="mt-2 text-2xl font-black uppercase text-neo-ink">
                Analisis per Mondai & Proyeksi Skor
              </h2>
              <p className="mt-1 text-xs font-semibold text-foreground/70">
                Skala 60 poin per section (言語知識・読解・聴解). Kolom berbobot menerapkan bobot kesulitan per mondai.
              </p>
            </div>

            <div className="border-2 border-neo-ink bg-neo-yellow px-4 py-2 rounded-lg font-mono text-lg font-black shadow-neo-sm">
              Proyeksi: {projection.weightedScore}/{projection.maxScore}
            </div>
          </div>

          <JlptScoreTable projection={projection} />
        </section>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-3">
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
      </div>
    </div>
  );
}
