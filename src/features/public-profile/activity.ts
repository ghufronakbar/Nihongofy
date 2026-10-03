// Heatmap aktivitas belajar dan streak, dari baris per hari yang sudah
// dikelompokkan di SQL (lihat `getProfileActivity`). Murni dan aman untuk
// client, supaya aturan hari dan streak dapat diuji tanpa database.
//
// Granularitasnya sengaja per hari, tidak pernah per jam: jam aktivitas yang
// tampil di halaman publik membocorkan pola tidur pemiliknya.

export type ActivityDayRow = {
  /** Hari kalender di timezone pemilik, `YYYY-MM-DD`. */
  day: string;
  flashcard: number;
  practice: number;
  exam: number;
};

export type HeatmapLevel = 0 | 1 | 2 | 3 | 4;

export type HeatmapCell = ActivityDayRow & {
  level: HeatmapLevel;
  /** False untuk sel pengisi minggu pertama dan hari setelah hari ini. */
  inRange: boolean;
};

export type ActivitySummary = {
  /** Kolom per minggu (Senin → Minggu), terlama dulu. */
  weeks: HeatmapCell[][];
  monthLabels: { weekIndex: number; label: string }[];
  activeDays: number;
  currentStreak: number;
  longestStreak: number;
  totals: { flashcard: number; practice: number; exam: number };
};

export type CalendarDate = { year: number; month: number; day: number };

/** Jendela heatmap: hari ini dan 364 hari sebelumnya. */
export const ACTIVITY_WINDOW_DAYS = 365;

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

// Bobot hanya untuk intensitas warna; tooltip tetap menampilkan jumlah asli.
// Tanpa bobot, satu mock test (berjam-jam) tampil sepucat satu review kartu,
// karena satu sesi flashcard bisa berisi ratusan review.
const WEIGHTS = { flashcard: 1, practice: 10, exam: 25 } as const;

function toUtcDate(date: CalendarDate) {
  return new Date(Date.UTC(date.year, date.month - 1, date.day));
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 86_400_000);
}

function isoDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function activityLevel(row: Pick<ActivityDayRow, "flashcard" | "practice" | "exam">): HeatmapLevel {
  const points =
    row.flashcard * WEIGHTS.flashcard + row.practice * WEIGHTS.practice + row.exam * WEIGHTS.exam;
  if (points <= 0) return 0;
  if (points < 10) return 1;
  if (points < 30) return 2;
  if (points < 60) return 3;
  return 4;
}

/**
 * Hari pertama jendela heatmap. Dipakai SQL sebagai batas bawah, jadi hari ini
 * (di timezone pemilik) adalah satu-satunya masukan yang menentukan jendelanya.
 */
export function activityWindowStart(today: CalendarDate) {
  return isoDay(addDays(toUtcDate(today), -(ACTIVITY_WINDOW_DAYS - 1)));
}

export function summarizeActivity(rows: ActivityDayRow[], today: CalendarDate): ActivitySummary {
  const byDay = new Map(rows.map((row) => [row.day, row]));
  const end = toUtcDate(today);
  const start = addDays(end, -(ACTIVITY_WINDOW_DAYS - 1));
  // Minggu dimulai Senin: getUTCDay() Minggu = 0, jadi digeser ke 6.
  const gridStart = addDays(start, -((start.getUTCDay() + 6) % 7));

  const weeks: HeatmapCell[][] = [];
  const monthLabels: ActivitySummary["monthLabels"] = [];
  const totals = { flashcard: 0, practice: 0, exam: 0 };
  let activeDays = 0;
  let longestStreak = 0;
  let runningStreak = 0;
  let lastLabeledMonth = -1;

  for (let cursor = gridStart; cursor <= end; cursor = addDays(cursor, 7)) {
    const week: HeatmapCell[] = [];
    for (let offset = 0; offset < 7; offset += 1) {
      const date = addDays(cursor, offset);
      const day = isoDay(date);
      const inRange = date >= start && date <= end;
      const row = inRange ? byDay.get(day) : undefined;
      const cell: HeatmapCell = {
        day,
        flashcard: row?.flashcard ?? 0,
        practice: row?.practice ?? 0,
        exam: row?.exam ?? 0,
        level: 0,
        inRange,
      };
      cell.level = activityLevel(cell);
      week.push(cell);

      if (!inRange) continue;
      totals.flashcard += cell.flashcard;
      totals.practice += cell.practice;
      totals.exam += cell.exam;
      if (cell.level > 0) {
        activeDays += 1;
        runningStreak += 1;
        longestStreak = Math.max(longestStreak, runningStreak);
      } else {
        runningStreak = 0;
      }
    }

    // Label bulan di kolom yang memuat tanggal 1-nya; kolom pertama ikut diberi
    // label untuk bulan awal jendela.
    const monthStart = week.find((cell) => cell.inRange && cell.day.endsWith("-01"));
    const anchor = monthStart ?? (weeks.length === 0 ? week.find((cell) => cell.inRange) : undefined);
    if (anchor) {
      const month = Number(anchor.day.slice(5, 7)) - 1;
      if (month !== lastLabeledMonth) {
        monthLabels.push({ weekIndex: weeks.length, label: MONTH_LABELS[month]! });
        lastLabeledMonth = month;
      }
    }

    weeks.push(week);
  }

  // Label butuh ruang sekitar tiga kolom. Label bulan awal yang terlalu dekat
  // dengan label berikutnya akan bertumpuk, dan label di dua kolom terakhir
  // terpotong tepi grid.
  if (monthLabels.length > 1 && monthLabels[1]!.weekIndex - monthLabels[0]!.weekIndex < 3) {
    monthLabels.shift();
  }
  while (monthLabels.length > 0 && monthLabels.at(-1)!.weekIndex > weeks.length - 3) {
    monthLabels.pop();
  }

  return {
    weeks,
    monthLabels,
    activeDays,
    currentStreak: currentStreakOf(byDay, end),
    longestStreak,
    totals,
  };
}

/**
 * Hari aktif berturut-turut sampai hari ini. Hari ini yang belum ada
 * aktivitasnya tidak memutus streak — harinya belum selesai — jadi hitungan
 * dimulai dari kemarin.
 */
function currentStreakOf(byDay: Map<string, ActivityDayRow>, end: Date) {
  const isActive = (date: Date) => {
    const row = byDay.get(isoDay(date));
    return row ? activityLevel(row) > 0 : false;
  };

  let cursor = isActive(end) ? end : addDays(end, -1);
  let streak = 0;
  for (let index = 0; index < ACTIVITY_WINDOW_DAYS && isActive(cursor); index += 1) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}
