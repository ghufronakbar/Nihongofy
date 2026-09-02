import type { MondaiType } from "@prisma/client";
import { getProgress } from "@/features/progress/actions";
import {
  ProgressTabs,
  type ProgressLevelView,
  type ProgressTableRow,
} from "@/features/progress/components/progress-tabs";
import {
  computeJlptScoreProjection,
  MONDAI_WEIGHTS,
  type ScoringSectionKey,
} from "@/lib/jlpt-score";
import { MONDAI_TYPE_LABELS } from "@/constants/jlpt";
import { Info, TrendingUp, Trophy } from "lucide-react";
import Link from "next/link";

const MONDAI_ORDER = Object.keys(MONDAI_WEIGHTS) as MondaiType[];
const SECTION_KEYS: ScoringSectionKey[] = ["GENGO_CHISHIKI", "DOKKAI", "CHOUKAI"];

export default async function ProgressPage() {
  const progressLevels = await getProgress();

  const levels: ProgressLevelView[] = progressLevels.map(({ level, attempts }) => {
    // Union of every mondai type seen in this level's attempts, in canonical
    // exam order — section-practice attempts only fill a subset of columns.
    const mondaiTypes = MONDAI_ORDER.filter((mondaiType) =>
      attempts.some((attempt) =>
        attempt.mondaiStats.some((stat) => stat.mondaiType === mondaiType),
      ),
    );

    const rows: ProgressTableRow[] = attempts.map((attempt) => {
      const projection = computeJlptScoreProjection(attempt.mondaiStats);

      const mondaiAccuracy: ProgressTableRow["mondaiAccuracy"] = {};
      for (const stat of attempt.mondaiStats) {
        mondaiAccuracy[stat.mondaiType] =
          stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : 0;
      }

      const sections = Object.fromEntries(
        SECTION_KEYS.map((key) => {
          const section = projection.sections.find((s) => s.key === key);
          return [
            key,
            section
              ? {
                  plainScore: section.plainScore,
                  weightedScore: section.weightedScore,
                  accuracy: section.accuracy,
                }
              : null,
          ];
        }),
      ) as ProgressTableRow["sections"];

      return {
        attemptId: attempt.id,
        packageName: attempt.packageName,
        dateLabel: attempt.finishedAt
          ? new Date(attempt.finishedAt).toLocaleDateString("id-ID", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })
          : "-",
        mondaiAccuracy,
        sections,
        totalPlain: projection.plainScore,
        totalWeighted: projection.weightedScore,
        totalMax: projection.maxScore,
        totalAccuracy: projection.accuracy,
      };
    });

    return {
      level,
      mondaiColumns: mondaiTypes.map((mondaiType) => ({
        mondaiType,
        label: MONDAI_TYPE_LABELS[mondaiType],
      })),
      rows,
    };
  });

  return (
    <div className="flex flex-col gap-8 pb-12">
      {/* Hero Banner */}
      <section className="neo-surface neo-grid-paper relative overflow-hidden bg-neo-yellow p-6 sm:p-8 md:p-10 border-[3px] border-neo-ink shadow-neo-lg text-black">
        <div
          className="absolute -top-10 -right-8 hidden size-36 rotate-12 border-[3px] border-neo-ink bg-neo-blue shadow-neo sm:block"
          aria-hidden="true"
        />
        <div
          className="absolute -bottom-8 right-24 hidden size-20 -rotate-12 border-[3px] border-neo-ink bg-neo-coral shadow-neo md:block"
          aria-hidden="true"
        />

        <div className="relative z-10 max-w-3xl">
          <div className="neo-kicker bg-white -rotate-1">
            <TrendingUp className="size-3.5" />
            SKOR & PROYEKSI
          </div>
          <h1 className="mt-4 text-4xl sm:text-6xl font-black uppercase leading-[0.95] text-neo-ink tracking-tight">
            Perkembangan Skor
            <span className="block text-white [text-shadow:2px_2px_0_#111]">Dari Tiap Attempt.</span>
          </h1>
          <p className="mt-4 max-w-xl text-base sm:text-lg font-semibold text-black/80">
            Pantau performa kumulatif dan proyeksi nilai mock test per level. Menggunakan skala JLPT resmi (60 per scoring section, total 180).
          </p>

          <div className="mt-6 flex flex-wrap gap-3 font-mono text-xs font-black">
            <span className="border-2 border-neo-ink bg-white px-3 py-1.5 shadow-neo-sm">
              SKALA RESMI 180 POIN
            </span>
            <span className="border-2 border-neo-ink bg-neo-green px-3 py-1.5 shadow-neo-sm">
              BOBOT MONDAI REALISTIS
            </span>
            <span className="border-2 border-neo-ink bg-neo-blue text-white px-3 py-1.5 shadow-neo-sm">
              EXPORT EXCEL & PDF
            </span>
          </div>
        </div>
      </section>

      {/* Info Callout */}
      <section className="neo-surface bg-white p-5 border-[3px] border-neo-ink shadow-neo flex items-start gap-3.5">
        <div className="grid size-9 place-items-center rounded border-2 border-neo-ink bg-neo-paper shrink-0 mt-0.5">
          <Info className="size-5 text-neo-ink" strokeWidth={2.5} />
        </div>
        <div className="text-xs sm:text-sm font-semibold text-foreground/80 leading-relaxed">
          <p className="font-black text-neo-ink">Tentang Penilaian & Proyeksi:</p>
          <p className="mt-1">
            Skor dihitung dari attempt paling lama ke paling baru. Kolom <strong>Skor Asli</strong> menggunakan bobot linier, sedangkan <strong>Skor Berbobot</strong> menerapkan bobot kesulitan per mondai (aproksimasi statistik). Attempt latihan per seksi hanya mengisi kolom section terkait.
          </p>
        </div>
      </section>

      {/* Content / Tabs */}
      {levels.length === 0 ? (
        <section className="neo-surface bg-white p-10 text-center border-[3px] border-neo-ink shadow-neo">
          <div className="mx-auto grid size-16 place-items-center rounded-lg border-[3px] border-neo-ink bg-neo-yellow shadow-neo-sm">
            <Trophy className="size-8 text-black" strokeWidth={2.5} />
          </div>
          <h2 className="mt-4 text-2xl font-black text-neo-ink">Belum Ada Attempt Selesai</h2>
          <p className="mt-2 text-sm font-semibold text-muted-foreground max-w-md mx-auto">
            Selesaikan setidaknya satu mock test atau latihan per seksi untuk melihat grafik perkembangan skormu di sini.
          </p>
          <div className="mt-6">
            <Link href="/test-package" className="neo-button bg-neo-blue text-white font-black">
              Mulai Ujian Pertama
            </Link>
          </div>
        </section>
      ) : (
        <ProgressTabs levels={levels} />
      )}
    </div>
  );
}
