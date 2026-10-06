import type { JlptLevel, JlptSection, MondaiType } from "@prisma/client";
import {
  JLPT_PASS_MARK,
  JLPT_SECTION_LABELS,
  MONDAI_TYPE_LABELS,
  MONDAI_TYPE_TRANSLATIONS,
} from "@/constants/jlpt";
import {
  computeJlptScoreProjection,
  MONDAI_WEIGHTS,
  SCORING_SECTION_TRANSLATIONS,
  scoringSectionOf,
  type ScoringSectionKey,
} from "@/lib/jlpt-score";
import { formatInTimeZone } from "@/lib/time-zone";
import type { ProgressLevel } from "../actions";

// Model data untuk report PDF /progress (satu level). Murni (tanpa I/O) supaya
// bisa dites — rendering-nya ada di features/progress/report.

export const FULL_TEST_MAX_SCORE = 180;
export const WEAK_ACCURACY = 60;
export const STRONG_ACCURACY = 80;
const FOCUS_LIMIT = 3;

const SECTION_KEYS: ScoringSectionKey[] = ["GENGO_CHISHIKI", "DOKKAI", "CHOUKAI"];

export const SECTION_SHORT_LABELS: Record<ScoringSectionKey, string> = {
  GENGO_CHISHIKI: "言語知識",
  DOKKAI: "読解",
  CHOUKAI: "聴解",
};

const MONDAI_ORDER = Object.keys(MONDAI_WEIGHTS) as MondaiType[];

export type ReportSectionScore = { plainScore: number; weightedScore: number; accuracy: number };

export type ReportAttempt = {
  number: number;
  packageName: string;
  dateLabel: string;
  shortDateLabel: string;
  // Label seksi untuk attempt latihan per seksi; null untuk mock test.
  scopeLabel: string | null;
  // Hanya attempt bernilai maksimal 180 (ketiga seksi ada) yang masuk grafik
  // skor total dan dibandingkan dengan batas lulus.
  isFullTest: boolean;
  sections: Record<ScoringSectionKey, ReportSectionScore | null>;
  totalPlain: number;
  totalWeighted: number;
  totalMax: number;
  accuracy: number;
  correct: number;
  total: number;
  mondaiAccuracy: Partial<Record<MondaiType, number>>;
};

export type ReportSectionSummary = {
  key: ScoringSectionKey;
  label: string;
  translation: string;
  attemptCount: number;
  latest: number | null;
  average: number | null;
  best: number | null;
  worst: number | null;
};

export type ReportMondai = {
  mondaiType: MondaiType;
  label: string;
  translation: string;
  section: ScoringSectionKey;
  correct: number;
  total: number;
  accuracy: number;
  attemptCount: number;
  firstAccuracy: number;
  latestAccuracy: number;
};

export type ProgressReport = {
  level: JlptLevel;
  passMark: number;
  periodLabel: string;
  attempts: ReportAttempt[];
  fullTests: ReportAttempt[];
  sectionOnlyCount: number;
  latest: ReportAttempt | null;
  best: ReportAttempt | null;
  averageTotal: number | null;
  deltaFromFirst: number | null;
  passedCount: number;
  sections: ReportSectionSummary[];
  // Diurutkan dari akurasi terendah.
  mondai: ReportMondai[];
  focus: ReportMondai[];
  insights: string[];
};

function percentage(correct: number, total: number): number {
  return total > 0 ? Math.round((correct / total) * 100) : 0;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function formatSigned(value: number): string {
  if (value === 0) return "±0";
  return value > 0 ? `+${value}` : `−${Math.abs(value)}`;
}

export function buildProgressReport(progress: ProgressLevel, timeZone: string): ProgressReport {
  const passMark = JLPT_PASS_MARK[progress.level];

  const attempts: ReportAttempt[] = progress.attempts.map((attempt, index) => {
    const projection = computeJlptScoreProjection(attempt.mondaiStats);

    const sections = Object.fromEntries(
      SECTION_KEYS.map((key) => {
        const section = projection.sections.find((item) => item.key === key);
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
    ) as ReportAttempt["sections"];

    const mondaiAccuracy: ReportAttempt["mondaiAccuracy"] = {};
    for (const stat of attempt.mondaiStats) {
      mondaiAccuracy[stat.mondaiType] = percentage(stat.correct, stat.total);
    }

    return {
      number: index + 1,
      packageName: attempt.packageName,
      dateLabel: attempt.finishedAt
        ? formatInTimeZone(attempt.finishedAt, timeZone, {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })
        : "-",
      shortDateLabel: attempt.finishedAt
        ? formatInTimeZone(attempt.finishedAt, timeZone, { day: "2-digit", month: "short" })
        : "-",
      scopeLabel: attempt.sectionScope
        ? JLPT_SECTION_LABELS[attempt.sectionScope as JlptSection]
        : null,
      isFullTest: projection.maxScore === FULL_TEST_MAX_SCORE,
      sections,
      totalPlain: projection.plainScore,
      totalWeighted: projection.weightedScore,
      totalMax: projection.maxScore,
      accuracy: projection.accuracy,
      correct: projection.correct,
      total: projection.total,
      mondaiAccuracy,
    };
  });

  const fullTests = attempts.filter((attempt) => attempt.isFullTest);
  const first = fullTests[0] ?? null;
  const latest = fullTests.at(-1) ?? null;
  // Seri skor tertinggi → ambil yang paling baru.
  const best = fullTests.reduce<ReportAttempt | null>(
    (current, attempt) => (!current || attempt.totalPlain >= current.totalPlain ? attempt : current),
    null,
  );
  const deltaFromFirst =
    first && latest && fullTests.length >= 2 ? latest.totalPlain - first.totalPlain : null;
  const passedCount = fullTests.filter((attempt) => attempt.totalPlain >= passMark).length;
  const averageTotal = average(fullTests.map((attempt) => attempt.totalPlain));

  const sections: ReportSectionSummary[] = SECTION_KEYS.map((key) => {
    const scores = attempts
      .map((attempt) => attempt.sections[key]?.plainScore)
      .filter((score): score is number => score !== undefined);
    return {
      key,
      label: SECTION_SHORT_LABELS[key],
      translation: SCORING_SECTION_TRANSLATIONS[key],
      attemptCount: scores.length,
      latest: scores.at(-1) ?? null,
      average: average(scores),
      best: scores.length > 0 ? Math.max(...scores) : null,
      worst: scores.length > 0 ? Math.min(...scores) : null,
    };
  });

  const mondaiMap = new Map<MondaiType, ReportMondai>();
  for (const attempt of progress.attempts) {
    for (const stat of attempt.mondaiStats) {
      const accuracy = percentage(stat.correct, stat.total);
      const existing = mondaiMap.get(stat.mondaiType);
      if (existing) {
        existing.correct += stat.correct;
        existing.total += stat.total;
        existing.attemptCount += 1;
        existing.latestAccuracy = accuracy;
      } else {
        mondaiMap.set(stat.mondaiType, {
          mondaiType: stat.mondaiType,
          label: MONDAI_TYPE_LABELS[stat.mondaiType],
          translation: MONDAI_TYPE_TRANSLATIONS[stat.mondaiType],
          section: scoringSectionOf(stat.mondaiType),
          correct: stat.correct,
          total: stat.total,
          accuracy: 0,
          attemptCount: 1,
          firstAccuracy: accuracy,
          latestAccuracy: accuracy,
        });
      }
    }
  }
  const mondai = Array.from(mondaiMap.values())
    .map((item) => ({ ...item, accuracy: percentage(item.correct, item.total) }))
    .sort(
      (a, b) =>
        a.accuracy - b.accuracy ||
        MONDAI_ORDER.indexOf(a.mondaiType) - MONDAI_ORDER.indexOf(b.mondaiType),
    );
  const focus = mondai.filter((item) => item.accuracy < STRONG_ACCURACY).slice(0, FOCUS_LIMIT);

  const firstAttempt = attempts[0];
  const lastAttempt = attempts.at(-1);
  const periodLabel =
    !firstAttempt || !lastAttempt
      ? "-"
      : firstAttempt.dateLabel === lastAttempt.dateLabel
        ? firstAttempt.dateLabel
        : `${firstAttempt.dateLabel} – ${lastAttempt.dateLabel}`;

  return {
    level: progress.level,
    passMark,
    periodLabel,
    attempts,
    fullTests,
    sectionOnlyCount: attempts.length - fullTests.length,
    latest,
    best,
    averageTotal,
    deltaFromFirst,
    passedCount,
    sections,
    mondai,
    focus,
    insights: buildInsights({
      fullTests,
      first,
      latest,
      deltaFromFirst,
      passedCount,
      passMark,
      averageTotal,
      sections,
    }),
  };
}

function buildInsights({
  fullTests,
  first,
  latest,
  deltaFromFirst,
  passedCount,
  passMark,
  averageTotal,
  sections,
}: {
  fullTests: ReportAttempt[];
  first: ReportAttempt | null;
  latest: ReportAttempt | null;
  deltaFromFirst: number | null;
  passedCount: number;
  passMark: number;
  averageTotal: number | null;
  sections: ReportSectionSummary[];
}): string[] {
  const insights: string[] = [];

  if (!latest || !first) {
    insights.push(
      "Belum ada mock test lengkap (3 seksi) di level ini. Grafik skor total muncul setelah kamu menyelesaikan satu.",
    );
  } else if (deltaFromFirst === null) {
    insights.push(
      `Baru 1 mock test lengkap: ${latest.totalPlain}/${FULL_TEST_MAX_SCORE}. Kerjakan paket lain untuk melihat tren.`,
    );
  } else if (deltaFromFirst === 0) {
    insights.push(
      `Skor total stabil di ${latest.totalPlain}/${FULL_TEST_MAX_SCORE} sejak attempt lengkap pertama.`,
    );
  } else {
    insights.push(
      `Skor total ${deltaFromFirst > 0 ? "naik" : "turun"} ${Math.abs(deltaFromFirst)} poin dari attempt lengkap pertama (${first.totalPlain} → ${latest.totalPlain}).`,
    );
  }

  if (fullTests.length > 0) {
    insights.push(
      `${passedCount} dari ${fullTests.length} mock test lengkap melewati batas lulus total ${passMark}/${FULL_TEST_MAX_SCORE}; rata-rata skor ${averageTotal}/${FULL_TEST_MAX_SCORE}.`,
    );
  }

  const measured = sections.filter((section) => section.average !== null);
  if (measured.length >= 2) {
    const weakest = measured.reduce((low, section) =>
      section.average! < low.average! ? section : low,
    );
    insights.push(
      `Seksi dengan rata-rata terendah: ${weakest.label} (${weakest.translation}), ${weakest.average}/60.`,
    );
  }

  const volatile = measured
    .filter((section) => section.attemptCount >= 2)
    .map((section) => ({ section, range: section.best! - section.worst! }))
    .sort((a, b) => b.range - a.range)[0];
  if (volatile && volatile.range >= 10) {
    insights.push(
      `Skor ${volatile.section.label} paling naik-turun: antara ${volatile.section.worst} dan ${volatile.section.best}/60.`,
    );
  }

  return insights;
}
