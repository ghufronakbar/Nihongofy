import type { MondaiType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import type { ProgressAttempt } from "../actions";
import { buildProgressReport, formatSigned } from "./report-data";

type Stat = [MondaiType, number, number];

// Satu mondai per scoring section cukup untuk membentuk skor /180.
function attempt(
  id: number,
  finishedAt: string,
  stats: Stat[],
  overrides: Partial<ProgressAttempt> = {},
): ProgressAttempt {
  return {
    id,
    packageName: `JLPT N5 - 20${10 + id}年12月`,
    finishedAt: new Date(finishedAt),
    sectionScope: null,
    mondaiStats: stats.map(([mondaiType, correct, total]) => ({ mondaiType, correct, total })),
    ...overrides,
  };
}

function fullTest(id: number, finishedAt: string, gengo: number, dokkai: number, choukai: number) {
  return attempt(id, finishedAt, [
    ["MOJI_GOI_READ_KANJI", gengo, 10],
    ["DOKKAI_SHORT_TEXT", dokkai, 10],
    ["CHOUKAI_TASK_BASED", choukai, 10],
  ]);
}

const TZ = "Asia/Jakarta";

describe("buildProgressReport", () => {
  it("summarises full mock tests against the level pass mark", () => {
    const report = buildProgressReport(
      {
        level: "N5",
        attempts: [
          fullTest(1, "2026-09-28T12:00:00Z", 8, 6, 7),
          fullTest(2, "2026-10-01T12:00:00Z", 9, 3, 8),
          fullTest(3, "2026-10-06T12:00:00Z", 10, 9, 9),
        ],
      },
      TZ,
    );

    expect(report.passMark).toBe(80);
    expect(report.fullTests.map((item) => item.totalPlain)).toEqual([126, 120, 168]);
    expect(report.latest?.number).toBe(3);
    expect(report.best?.number).toBe(3);
    expect(report.deltaFromFirst).toBe(42);
    expect(report.passedCount).toBe(3);
    expect(report.averageTotal).toBe(138);
    expect(report.periodLabel).toBe("28 Sep 2026 – 06 Okt 2026");

    const dokkai = report.sections.find((section) => section.key === "DOKKAI")!;
    expect(dokkai).toMatchObject({ latest: 54, best: 54, worst: 18, average: 36, attemptCount: 3 });

    expect(report.insights[0]).toContain("naik 42 poin");
    expect(report.insights.some((line) => line.includes("rata-rata terendah: 読解"))).toBe(true);
    expect(report.insights.some((line) => line.includes("paling naik-turun"))).toBe(true);
  });

  it("aggregates mondai accuracy by question count and lists the weakest first", () => {
    const report = buildProgressReport(
      {
        level: "N5",
        attempts: [
          fullTest(1, "2026-09-28T12:00:00Z", 9, 2, 8),
          fullTest(2, "2026-10-01T12:00:00Z", 9, 6, 8),
        ],
      },
      TZ,
    );

    expect(report.mondai.map((item) => item.mondaiType)).toEqual([
      "DOKKAI_SHORT_TEXT",
      "CHOUKAI_TASK_BASED",
      "MOJI_GOI_READ_KANJI",
    ]);
    expect(report.mondai[0]).toMatchObject({
      correct: 8,
      total: 20,
      accuracy: 40,
      firstAccuracy: 20,
      latestAccuracy: 60,
      attemptCount: 2,
    });
    // Hanya mondai di bawah 80% yang jadi prioritas.
    expect(report.focus.map((item) => item.mondaiType)).toEqual(["DOKKAI_SHORT_TEXT"]);
  });

  it("keeps section-only practice out of the total trend", () => {
    const report = buildProgressReport(
      {
        level: "N5",
        attempts: [
          attempt(1, "2026-09-28T12:00:00Z", [["DOKKAI_SHORT_TEXT", 5, 6]], {
            sectionScope: "DOKKAI",
          }),
        ],
      },
      TZ,
    );

    expect(report.attempts[0]).toMatchObject({
      isFullTest: false,
      totalMax: 60,
      scopeLabel: "Dokkai (読解)",
    });
    expect(report.fullTests).toHaveLength(0);
    expect(report.sectionOnlyCount).toBe(1);
    expect(report.latest).toBeNull();
    expect(report.deltaFromFirst).toBeNull();
    expect(report.insights[0]).toContain("Belum ada mock test lengkap");
    expect(report.sections.find((section) => section.key === "DOKKAI")?.latest).toBe(50);
  });
});

describe("formatSigned", () => {
  it("marks direction explicitly", () => {
    expect(formatSigned(5)).toBe("+5");
    expect(formatSigned(-3)).toBe("−3");
    expect(formatSigned(0)).toBe("±0");
  });
});
