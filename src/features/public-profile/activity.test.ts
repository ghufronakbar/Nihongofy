import { describe, expect, it } from "vitest";
import {
  ACTIVITY_WINDOW_DAYS,
  activityLevel,
  activityWindowStart,
  summarizeActivity,
  type ActivityDayRow,
} from "./activity";

const TODAY = { year: 2026, month: 10, day: 3 }; // Sabtu

function row(day: string, values: Partial<Omit<ActivityDayRow, "day">> = { flashcard: 1 }): ActivityDayRow {
  return { day, flashcard: 0, practice: 0, exam: 0, ...values };
}

function inRangeCells(summary: ReturnType<typeof summarizeActivity>) {
  return summary.weeks.flat().filter((cell) => cell.inRange);
}

describe("summarizeActivity", () => {
  it("memuat tepat 365 hari dan berakhir hari ini", () => {
    const cells = inRangeCells(summarizeActivity([], TODAY));
    expect(cells).toHaveLength(ACTIVITY_WINDOW_DAYS);
    expect(cells[0]!.day).toBe(activityWindowStart(TODAY));
    expect(cells.at(-1)!.day).toBe("2026-10-03");
  });

  it("menyusun kolom per minggu yang dimulai Senin", () => {
    const { weeks } = summarizeActivity([], TODAY);
    for (const week of weeks) {
      expect(week).toHaveLength(7);
      // 2026-09-28 adalah Senin.
      expect(new Date(`${week[0]!.day}T00:00:00Z`).getUTCDay()).toBe(1);
    }
    // Hari setelah hari ini di minggu terakhir adalah sel pengisi.
    expect(weeks.at(-1)!.filter((cell) => cell.inRange).map((cell) => cell.day)).toEqual([
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
    ]);
  });

  it("mengabaikan baris di luar jendela", () => {
    const summary = summarizeActivity([row("2025-01-01", { flashcard: 50 })], TODAY);
    expect(summary.activeDays).toBe(0);
    expect(summary.totals.flashcard).toBe(0);
  });

  it("menjumlahkan total per jenis", () => {
    const summary = summarizeActivity(
      [row("2026-10-01", { flashcard: 30, practice: 1 }), row("2026-10-02", { exam: 2 })],
      TODAY,
    );
    expect(summary.totals).toEqual({ flashcard: 30, practice: 1, exam: 2 });
    expect(summary.activeDays).toBe(2);
  });
});

describe("streak", () => {
  it("menghitung streak yang berakhir hari ini", () => {
    const summary = summarizeActivity(
      [row("2026-10-01"), row("2026-10-02"), row("2026-10-03")],
      TODAY,
    );
    expect(summary.currentStreak).toBe(3);
    expect(summary.longestStreak).toBe(3);
  });

  it("hari ini yang belum aktif tidak memutus streak", () => {
    const summary = summarizeActivity([row("2026-10-01"), row("2026-10-02")], TODAY);
    expect(summary.currentStreak).toBe(2);
  });

  it("streak putus bila kemarin kosong", () => {
    const summary = summarizeActivity([row("2026-09-30"), row("2026-10-01")], TODAY);
    expect(summary.currentStreak).toBe(0);
    expect(summary.longestStreak).toBe(2);
  });

  it("streak terpanjang diambil dari seluruh jendela", () => {
    const summary = summarizeActivity(
      [
        row("2026-08-01"),
        row("2026-08-02"),
        row("2026-08-03"),
        row("2026-08-04"),
        row("2026-10-03"),
      ],
      TODAY,
    );
    expect(summary.longestStreak).toBe(4);
    expect(summary.currentStreak).toBe(1);
  });
});

describe("activityLevel", () => {
  it("nol berarti tidak aktif", () => {
    expect(activityLevel({ flashcard: 0, practice: 0, exam: 0 })).toBe(0);
  });

  it("satu mock test lebih pekat daripada satu review kartu", () => {
    expect(activityLevel({ flashcard: 0, practice: 0, exam: 1 })).toBeGreaterThan(
      activityLevel({ flashcard: 1, practice: 0, exam: 0 }),
    );
  });

  it("mentok di level 4", () => {
    expect(activityLevel({ flashcard: 500, practice: 10, exam: 5 })).toBe(4);
  });
});

describe("label bulan", () => {
  it("satu label per bulan dan tidak bertumpuk", () => {
    const { monthLabels } = summarizeActivity([], TODAY);
    const labels = monthLabels.map((label) => label.label);
    // Jendela 4 Okt 2025 – 3 Okt 2026. 1 Oktober 2026 jatuh di kolom terakhir,
    // jadi labelnya dibuang alih-alih terpotong tepi grid.
    expect(labels).toEqual(["Okt", "Nov", "Des", "Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep"]);
    for (let index = 1; index < monthLabels.length; index += 1) {
      expect(monthLabels[index]!.weekIndex - monthLabels[index - 1]!.weekIndex).toBeGreaterThanOrEqual(3);
    }
  });

  it("label akhir tetap ada bila masih muat", () => {
    // 1 Oktober 2026 jatuh di kolom ketiga dari kanan.
    const { monthLabels, weeks } = summarizeActivity([], { year: 2026, month: 10, day: 17 });
    expect(monthLabels.at(-1)).toEqual({ weekIndex: weeks.length - 3, label: "Okt" });
  });

  it("label awal dibuang bila bertumpuk dengan bulan berikutnya", () => {
    // Jendela mulai Kamis 25 Sep 2025: kolom pertama hanya berisi September,
    // dan 1 Oktober jatuh di kolom kedua — dua label yang akan bertumpuk.
    const { monthLabels } = summarizeActivity([], { year: 2026, month: 9, day: 24 });
    expect(monthLabels[0]).toEqual({ weekIndex: 1, label: "Okt" });
  });
});
