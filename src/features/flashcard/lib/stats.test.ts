import { describe, expect, it } from "vitest";
import {
  averageAnswerSeconds,
  buildForecast,
  buildIntervalDistribution,
  buildReviewHistory,
  computeTrueRetention,
  type ReviewSample,
} from "./stats";

const TODAY = new Date("2026-09-03T04:00:00+07:00");
const day = (offset: number) => new Date(TODAY.getTime() + offset * 86_400_000);

const review = (overrides: Partial<ReviewSample> = {}): ReviewSample => ({
  reviewedAt: TODAY,
  rating: "GOOD",
  kind: "REVIEW",
  takenMs: 3_000,
  ...overrides,
});

describe("true retention", () => {
  it("menghitung proporsi review yang diingat", () => {
    const result = computeTrueRetention([
      review(),
      review(),
      review({ rating: "AGAIN" }),
      review({ rating: "HARD" }),
    ]);

    expect(result.total).toBe(4);
    expect(result.passed).toBe(3);
    expect(result.rate).toBeCloseTo(0.75, 5);
  });

  it("Hard dihitung sebagai berhasil diingat", () => {
    expect(computeTrueRetention([review({ rating: "HARD" })]).rate).toBe(1);
  });

  it("mengabaikan review LEARN dan RELEARN", () => {
    // Keduanya terjadi beberapa kali per kartu dalam satu sesi; memasukkannya
    // membuat retensi terlihat jauh lebih buruk daripada kenyataannya.
    const result = computeTrueRetention([
      review({ kind: "LEARN", rating: "AGAIN" }),
      review({ kind: "RELEARN", rating: "AGAIN" }),
      review({ kind: "REVIEW", rating: "GOOD" }),
    ]);

    expect(result.total).toBe(1);
    expect(result.rate).toBe(1);
  });

  it("mengembalikan null saat belum ada review matang", () => {
    expect(computeTrueRetention([]).rate).toBeNull();
    expect(computeTrueRetention([review({ kind: "LEARN" })]).rate).toBeNull();
  });
});

describe("perkiraan beban ke depan", () => {
  it("mengelompokkan kartu per hari", () => {
    const forecast = buildForecast([day(0), day(1), day(1), day(3)], TODAY, 5);
    expect(forecast.map((bucket) => bucket.count)).toEqual([1, 2, 0, 1, 0]);
  });

  it("menumpuk backlog ke hari ini", () => {
    // Kartu yang lewat due jatuh ke hari ini, bukan tersebar mundur.
    const forecast = buildForecast([day(-5), day(-1), day(0)], TODAY, 3);
    expect(forecast[0]!.count).toBe(3);
  });

  it("mengabaikan kartu di luar rentang", () => {
    const forecast = buildForecast([day(1), day(99)], TODAY, 3);
    expect(forecast.reduce((total, bucket) => total + bucket.count, 0)).toBe(1);
  });

  it("selalu mengembalikan satu bucket per hari", () => {
    expect(buildForecast([], TODAY, 7)).toHaveLength(7);
  });
});

describe("riwayat review", () => {
  it("menghitung review per hari ke belakang", () => {
    const history = buildReviewHistory(
      [
        review({ reviewedAt: day(0) }),
        review({ reviewedAt: day(-1) }),
        review({ reviewedAt: day(-1) }),
      ],
      TODAY,
      3,
    );

    expect(history.map((bucket) => bucket.offset)).toEqual([-2, -1, 0]);
    expect(history.map((bucket) => bucket.count)).toEqual([0, 2, 1]);
  });

  it("mengabaikan review di luar rentang", () => {
    const history = buildReviewHistory([review({ reviewedAt: day(-30) })], TODAY, 7);
    expect(history.every((bucket) => bucket.count === 0)).toBe(true);
  });
});

describe("distribusi interval", () => {
  it("menempatkan interval pada bucket yang benar", () => {
    const buckets = buildIntervalDistribution([3, 7, 8, 14, 20, 100, 400]);
    const byLabel = Object.fromEntries(buckets.map((b) => [b.label, b.count]));

    expect(byLabel["< 1 minggu"]).toBe(2);
    expect(byLabel["1-2 minggu"]).toBe(2);
    expect(byLabel["2 minggu-1 bulan"]).toBe(1);
    expect(byLabel["1-3 bulan"]).toBe(0);
    expect(byLabel["3-6 bulan"]).toBe(1); // 100 hari
    expect(byLabel["> 1 tahun"]).toBe(1); // 400 hari
  });

  it("batas bucket bersifat inklusif di ujung atas", () => {
    const buckets = buildIntervalDistribution([7]);
    expect(buckets[0]!.count).toBe(1);
    expect(buckets[1]!.count).toBe(0);
  });
});

describe("rata-rata waktu menjawab", () => {
  it("mengabaikan review tanpa catatan waktu", () => {
    expect(
      averageAnswerSeconds([review({ takenMs: 2_000 }), review({ takenMs: 0 })]),
    ).toBe(2);
  });

  it("null bila tidak ada yang tercatat", () => {
    expect(averageAnswerSeconds([review({ takenMs: 0 })])).toBeNull();
  });
});
