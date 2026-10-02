import { describe, expect, it } from "vitest";
import {
  bunpouComparisonRegenerateCommand,
  bunpouComparisonReportLabel,
  bunpouPointCategoryNote,
  bunpouPointFixtureFile,
  bunpouPointRegenerateCommand,
  bunpouPointReportLabel,
} from "./bunpou-target";

describe("target laporan bunpou", () => {
  it("label memuat key supaya fixture tetap bisa ditemukan bila FK menjadi NULL", () => {
    expect(bunpouPointReportLabel({ key: "de-tempat", level: "N5" })).toBe("Bunpou · N5 · de-tempat");
    expect(bunpouComparisonReportLabel({ key: "alasan-kara-node" })).toBe(
      "Bunpou · perbandingan · alasan-kara-node",
    );
  });

  it("menunjuk fixture level dan perintah generate ulang untuk key itu", () => {
    expect(bunpouPointFixtureFile("N4")).toBe("src/bunpou-data/points/n4.json");
    expect(bunpouPointRegenerateCommand("de-tempat")).toBe(
      'npm run gen:bunpou -- --key "de-tempat" --overwrite',
    );
    expect(bunpouComparisonRegenerateCommand("alasan-kara-node")).toBe(
      'npm run gen:bunpou-comparisons -- --key "alasan-kara-node" --overwrite',
    );
  });

  it("memberi catatan khusus hanya untuk kategori yang butuh langkah lain", () => {
    expect(bunpouPointCategoryNote("CONNECTION_ERROR")).toContain("taxonomy.json");
    expect(bunpouPointCategoryNote("READING_ERROR")).toBeTruthy();
    expect(bunpouPointCategoryNote("MEANING_ERROR")).toBeNull();
  });
});
