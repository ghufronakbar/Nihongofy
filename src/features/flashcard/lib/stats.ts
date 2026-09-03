/**
 * Perhitungan statistik.
 *
 * Dipisah dari query supaya bisa diuji dengan data buatan: rumus true retention
 * dan pembagian bucket adalah tempat yang paling mudah salah tanpa ketahuan.
 */

export type ReviewSample = {
  reviewedAt: Date;
  rating: "AGAIN" | "HARD" | "GOOD" | "EASY";
  kind: "LEARN" | "REVIEW" | "RELEARN" | "MANUAL" | "RESCHEDULED";
  takenMs: number;
};

export type RetentionSummary = {
  /** Review kartu matang (kind REVIEW) yang dijawab benar. */
  passed: number;
  total: number;
  /** null bila belum ada review yang bisa dihitung. */
  rate: number | null;
};

/**
 * True retention: proporsi kartu REVIEW yang berhasil diingat.
 *
 * Review `LEARN` dan `RELEARN` sengaja tidak dihitung. Keduanya terjadi beberapa
 * kali per kartu dalam satu sesi, jadi memasukkannya akan menenggelamkan angka
 * dan membuat retensi terlihat jauh lebih buruk daripada kenyataannya.
 */
export function computeTrueRetention(reviews: ReviewSample[]): RetentionSummary {
  const mature = reviews.filter((review) => review.kind === "REVIEW");
  const passed = mature.filter((review) => review.rating !== "AGAIN").length;

  return {
    passed,
    total: mature.length,
    rate: mature.length === 0 ? null : passed / mature.length,
  };
}

export type DailyBucket = {
  /** Offset hari dari hari ini; negatif untuk masa lalu. */
  offset: number;
  count: number;
};

/**
 * Perkiraan beban review ke depan.
 *
 * Kartu yang sudah lewat due dikumpulkan ke offset 0 — di Anki backlog memang
 * jatuh ke hari ini, bukan tersebar mundur ke tanggal aslinya.
 */
export function buildForecast(
  dueDates: Date[],
  todayStart: Date,
  days: number,
): DailyBucket[] {
  const buckets = new Map<number, number>();
  const dayMs = 86_400_000;

  for (const due of dueDates) {
    const offset = Math.max(
      0,
      Math.floor((due.getTime() - todayStart.getTime()) / dayMs),
    );
    if (offset >= days) continue;
    buckets.set(offset, (buckets.get(offset) ?? 0) + 1);
  }

  return Array.from({ length: days }, (_, offset) => ({
    offset,
    count: buckets.get(offset) ?? 0,
  }));
}

/** Jumlah review per hari selama `days` terakhir, termasuk hari tanpa review. */
export function buildReviewHistory(
  reviews: ReviewSample[],
  todayStart: Date,
  days: number,
): DailyBucket[] {
  const buckets = new Map<number, number>();
  const dayMs = 86_400_000;

  for (const review of reviews) {
    const offset = Math.floor((review.reviewedAt.getTime() - todayStart.getTime()) / dayMs);
    if (offset > 0 || offset <= -days) continue;
    buckets.set(offset, (buckets.get(offset) ?? 0) + 1);
  }

  return Array.from({ length: days }, (_, index) => {
    const offset = index - days + 1;
    return { offset, count: buckets.get(offset) ?? 0 };
  });
}

export type IntervalBucket = {
  label: string;
  count: number;
};

const INTERVAL_BUCKETS: { label: string; max: number }[] = [
  { label: "< 1 minggu", max: 7 },
  { label: "1-2 minggu", max: 14 },
  { label: "2 minggu-1 bulan", max: 30 },
  { label: "1-3 bulan", max: 90 },
  { label: "3-6 bulan", max: 180 },
  { label: "6 bulan-1 tahun", max: 365 },
  { label: "> 1 tahun", max: Number.POSITIVE_INFINITY },
];

export function buildIntervalDistribution(intervals: number[]): IntervalBucket[] {
  return INTERVAL_BUCKETS.map((bucket, index) => {
    const min = index === 0 ? 0 : INTERVAL_BUCKETS[index - 1]!.max;
    return {
      label: bucket.label,
      count: intervals.filter((value) => value > min && value <= bucket.max).length,
    };
  });
}

/** Rata-rata waktu menjawab dalam detik; null bila belum ada review. */
export function averageAnswerSeconds(reviews: ReviewSample[]): number | null {
  const timed = reviews.filter((review) => review.takenMs > 0);
  if (timed.length === 0) return null;
  return timed.reduce((total, review) => total + review.takenMs, 0) / timed.length / 1_000;
}
