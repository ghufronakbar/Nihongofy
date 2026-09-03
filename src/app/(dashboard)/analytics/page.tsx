import { Suspense } from "react";
import type { JlptSection } from "@prisma/client";
import { getAnalytics, type AnalyticsScope } from "@/features/analytics/actions";
import { AnalyticsFilterBar } from "@/features/analytics/components/analytics-filter-bar";
import { AnalyticsTabs } from "@/features/analytics/components/analytics-tabs";
import { ScoreTrendChart } from "@/features/analytics/components/score-trend-chart";
import { computeJlptScoreProjection } from "@/lib/jlpt-score";
import { resolveDateRangePreset, isDateRangePreset } from "@/lib/date-range-preset";
import { JLPT_SECTION_LABELS } from "@/constants/jlpt";
import { formatInTimeZone } from "@/lib/time-zone";
import { getCurrentUserTimeZone } from "@/lib/user-time-zone";
import {
  BarChart3,
  Layers,
  LineChart,
  Zap,
} from "lucide-react";
import Link from "next/link";

const VALID_SECTIONS = Object.keys(JLPT_SECTION_LABELS) as JlptSection[];

function resolveScope(value: string | undefined): AnalyticsScope {
  if (value === "MOCK") return "MOCK";
  if (value === "PRACTICE") return "PRACTICE";
  if (value && (VALID_SECTIONS as string[]).includes(value)) return value as JlptSection;
  return "ALL";
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string; range?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const scope = resolveScope(params.scope);
  const rangePreset = isDateRangePreset(params.range) ? params.range : "all";
  const timeZone = await getCurrentUserTimeZone();
  const { from, to } = resolveDateRangePreset(
    rangePreset,
    params.from,
    params.to,
    timeZone,
  );

  const { trend, levelStats, practiceSummary } = await getAnalytics({
    scope,
    fromIso: from?.toISOString(),
    toIso: to?.toISOString(),
  });

  const trendData = trend.map((point) => ({
    id: point.id,
    dateLabel: point.finishedAt
      ? formatInTimeZone(point.finishedAt, timeZone, { day: "2-digit", month: "short" })
      : "-",
    packageLabel: point.packageName,
    scorePercentage: point.scorePercentage,
  }));

  return (
    <div className="flex flex-col gap-8 pb-12">
      {/* Hero Banner */}
      <section className="neo-surface neo-grid-paper relative overflow-hidden bg-neo-coral p-6 sm:p-8 md:p-10 border-[3px] border-neo-ink shadow-neo-lg text-white">
        <div
          className="absolute -top-10 -right-8 hidden size-36 rotate-12 border-[3px] border-neo-ink bg-neo-yellow shadow-neo sm:block"
          aria-hidden="true"
        />
        <div
          className="absolute -bottom-8 right-24 hidden size-24 -rotate-12 border-[3px] border-neo-ink bg-neo-blue shadow-neo md:block"
          aria-hidden="true"
        />

        <div className="relative z-10 max-w-3xl">
          <div className="neo-kicker bg-white text-black -rotate-1">
            <BarChart3 className="size-3.5" />
            RAPOR & ANALITIK
          </div>
          <h1 className="mt-4 text-4xl sm:text-6xl font-black uppercase leading-[0.95] text-white [text-shadow:2px_2px_0_#111] tracking-tight">
            Analitik Performa
            <span className="block text-neo-yellow">Ujian & Latihan.</span>
          </h1>
          <p className="mt-4 max-w-xl text-base sm:text-lg font-semibold text-white/90">
            Evaluasi akurasi jawaban, tren skor per attempt, dan identifikasi mondai yang perlu diperkuat sebelum hari ujian.
          </p>

          <div className="mt-6 flex flex-wrap gap-3 font-mono text-xs font-black">
            <span className="border-2 border-neo-ink bg-white text-black px-3 py-1.5 shadow-neo-sm">
              FILTER DINAMIS
            </span>
            <span className="border-2 border-neo-ink bg-neo-yellow text-black px-3 py-1.5 shadow-neo-sm">
              TREN PER ATTEMPT
            </span>
            <span className="border-2 border-neo-ink bg-neo-green text-black px-3 py-1.5 shadow-neo-sm">
              BREAKDOWN MONDAI
            </span>
          </div>
        </div>
      </section>

      {/* Filter Bar */}
      <Suspense>
        <AnalyticsFilterBar />
      </Suspense>

      {/* Score Trend Chart Section */}
      {scope !== "PRACTICE" && (
        <section className="neo-surface bg-white p-6 sm:p-8 border-[3px] border-neo-ink shadow-neo">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b-[3px] border-neo-ink pb-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded border-2 border-neo-ink bg-neo-blue text-white shadow-neo-sm shrink-0">
                <LineChart className="size-5" strokeWidth={2.5} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-neo-ink uppercase">Tren Akurasi Skor</h2>
                <p className="text-xs font-semibold text-foreground/70">
                  Grafik riwayat akurasi skor (%) dari attempt yang selesai secara kronologis.
                </p>
              </div>
            </div>

            <span className="font-mono text-xs font-black border-2 border-neo-ink bg-neo-paper px-2.5 py-1 shadow-neo-sm">
              {trendData.length} DATA POINT
            </span>
          </div>

          {trendData.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-neo-ink/30 p-10 text-center bg-neo-paper/40">
              <p className="font-bold text-sm text-foreground/70">
                Belum ada data attempt yang cocok dengan filter rentang waktu atau lingkup ini.
              </p>
            </div>
          ) : (
            <ScoreTrendChart data={trendData} />
          )}
        </section>
      )}

      {/* Quick Practice Analytics */}
      {scope !== "MOCK" && (
        <section className="neo-surface bg-white p-6 sm:p-8 border-[3px] border-neo-ink shadow-neo">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b-[3px] border-neo-ink pb-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded border-2 border-neo-ink bg-neo-yellow text-black shadow-neo-sm shrink-0">
                <Zap className="size-5" strokeWidth={2.5} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-neo-ink uppercase">Ringkasan Latihan Cepat</h2>
                <p className="text-xs font-semibold text-foreground/70">
                  Latihan instan dengan umpan balik per soal (tidak mempengaruhi proyeksi 180 poin mock test).
                </p>
              </div>
            </div>

            <Link
              href="/exercises"
              className="neo-button !min-h-9 !px-3.5 !py-1.5 bg-neo-yellow text-black font-black text-xs"
            >
              Latihan Cepat Baru →
            </Link>
          </div>

          {practiceSummary.sessions === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-neo-ink/30 p-10 text-center bg-neo-paper/40">
              <p className="font-bold text-sm text-foreground/70">
                Belum ada sesi latihan cepat yang selesai untuk filter ini.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Stat KPIs */}
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="border-[3px] border-neo-ink bg-neo-yellow p-5 text-black shadow-neo-sm rounded-lg">
                  <p className="font-mono text-xs font-black uppercase text-black/70">Sesi Selesai</p>
                  <p className="mt-2 text-4xl font-black tabular-nums">{practiceSummary.sessions}</p>
                </div>
                <div className="border-[3px] border-neo-ink bg-neo-blue p-5 text-white shadow-neo-sm rounded-lg">
                  <p className="font-mono text-xs font-black uppercase text-white/70">Soal Dijawab</p>
                  <p className="mt-2 text-4xl font-black tabular-nums">{practiceSummary.questions}</p>
                </div>
                <div className="border-[3px] border-neo-ink bg-neo-green p-5 text-black shadow-neo-sm rounded-lg">
                  <p className="font-mono text-xs font-black uppercase text-black/70">Akurasi Rata-rata</p>
                  <p className="mt-2 text-4xl font-black tabular-nums">{practiceSummary.accuracy}%</p>
                </div>
              </div>

              {/* By Level Breakdown */}
              <div className="space-y-3">
                <span className="font-mono text-xs font-black uppercase text-foreground/70 block">
                  BREAKDOWN PER LEVEL JLPT
                </span>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {practiceSummary.byLevel.map((row) => (
                    <div
                      key={row.level}
                      className="border-[3px] border-neo-ink bg-neo-paper p-4 shadow-neo-sm rounded-lg flex items-center justify-between"
                    >
                      <div>
                        <span className="border-2 border-neo-ink bg-white px-2.5 py-0.5 font-mono text-xs font-black shadow-neo-sm">
                          JLPT {row.level}
                        </span>
                        <p className="mt-2 text-xs font-semibold text-foreground/70">
                          {row.correct}/{row.questions} benar ({row.sessions} sesi)
                        </p>
                      </div>
                      <span className="font-mono text-2xl font-black text-neo-ink">
                        {row.accuracy}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Level Analytics Tabs (Mondai Breakdown & Score Projection) */}
      {scope !== "PRACTICE" &&
        (levelStats.length === 0 ? (
          <section className="neo-surface bg-white p-8 sm:p-12 text-center border-[3px] border-neo-ink shadow-neo">
            <div className="mx-auto grid size-14 place-items-center rounded-lg border-[3px] border-neo-ink bg-neo-yellow shadow-neo-sm">
              <Layers className="size-6 text-black" strokeWidth={2.5} />
            </div>
            <h3 className="mt-4 text-2xl font-black">Belum Ada Proyeksi Level</h3>
            <p className="mt-2 text-sm font-semibold text-muted-foreground max-w-md mx-auto">
              Selesaikan mock test untuk menghasilkan rapor analisis per level JLPT.
            </p>
          </section>
        ) : (
          <AnalyticsTabs
            levelStats={levelStats.map(({ level, mondaiStats }) => ({
              level,
              projection: computeJlptScoreProjection(mondaiStats),
            }))}
          />
        ))}
    </div>
  );
}
