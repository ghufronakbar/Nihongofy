import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { BUNPOU_LEVELS } from "../taxonomy";
import type { BunpouComparisonLink, BunpouLevel, BunpouPointSummary } from "../types";
import {
  comparisonDescription,
  comparisonLevels,
  compareComparisonLinks,
  patternVariants,
  resolveComparisonPoints,
  toComparisonDetail,
} from "./comparison";

function summary(key: string, level: BunpouLevel, title = key): BunpouPointSummary {
  return {
    key,
    level,
    order: 1,
    kind: "PATTERN",
    sectionKey: "sentence-patterns",
    family: null,
    senseLabel: null,
    title,
    titlePlain: title,
    titleReading: title,
    titleRomaji: key,
    meaningId: "",
    meaningEn: "",
    searchText: key,
    tags: [],
    connectionForms: [],
  };
}

const kara = summary("kara-alasan", "N5", "〜から");
const node = summary("node", "N4", "〜ので");
const tame = summary("tame-alasan", "N3", "〜ため");
const catalog = new Map([kara, node, tame].map((point) => [point.key, point]));

function row(key: string) {
  return { key, nuance: `nuansa ${key}`, register: `ragam ${key}`, restriction: `batasan ${key}` };
}

const content = {
  summary: "から lebih subjektif, ので lebih halus.",
  rows: [row("kara-alasan"), row("node")],
  contrasts: [
    {
      jp: "{危|あぶ}ない[_]、{下|さ}がってください。",
      id: "Berbahaya, jadi mundurlah.",
      options: [
        { key: "kara-alasan", text: "から", verdict: "ok" },
        { key: "node", text: "ので", verdict: "ok", note: "Lebih halus." },
      ],
    },
  ],
};

function dbRow(overrides: { content?: unknown; pointKeys?: string[] } = {}) {
  return {
    id: 7,
    key: "alasan-kara-node",
    title: "Alasan: kara dan node",
    content: "content" in overrides ? overrides.content : content,
    updatedAt: "2026-10-05T00:00:00.000Z",
    pointKeys: overrides.pointKeys ?? ["kara-alasan", "node"],
  };
}

describe("resolveComparisonPoints", () => {
  it("keeps the member order", () => {
    expect(resolveComparisonPoints(["node", "kara-alasan"], catalog)).toEqual([node, kara]);
  });

  it("rejects comparisons with a member missing from the catalog", () => {
    expect(resolveComparisonPoints(["kara-alasan", "retired"], catalog)).toBeNull();
  });

  it("rejects comparisons with fewer than two members", () => {
    expect(resolveComparisonPoints(["kara-alasan"], catalog)).toBeNull();
    expect(resolveComparisonPoints([], catalog)).toBeNull();
  });
});

describe("toComparisonDetail", () => {
  it("assembles a published comparison", () => {
    const detail = toComparisonDetail(dbRow(), catalog);
    expect(detail).toMatchObject({ id: 7, key: "alasan-kara-node", points: [kara, node] });
    expect(detail?.updatedAt).toEqual(new Date("2026-10-05T00:00:00.000Z"));
    expect(detail?.content.contrasts[0].options).toHaveLength(2);
  });

  it("orders table rows by the database member order, not the JSON order", () => {
    const detail = toComparisonDetail(
      dbRow({ content: { ...content, rows: [row("node"), row("kara-alasan")] } }),
      catalog,
    );
    expect(detail?.content.rows.map((item) => item.key)).toEqual(["kara-alasan", "node"]);

    const reordered = toComparisonDetail(dbRow({ pointKeys: ["node", "kara-alasan"] }), catalog);
    expect(reordered?.points.map((point) => point.key)).toEqual(["node", "kara-alasan"]);
    expect(reordered?.content.rows.map((item) => item.key)).toEqual(["node", "kara-alasan"]);
  });

  it("returns null when a member is retired", () => {
    expect(toComparisonDetail(dbRow({ pointKeys: ["kara-alasan", "gone"] }), catalog)).toBeNull();
  });

  it("returns null when the content is incomplete", () => {
    expect(toComparisonDetail(dbRow({ content: null }), catalog)).toBeNull();
    expect(toComparisonDetail(dbRow({ content: { ...content, summary: undefined } }), catalog)).toBeNull();
    // Baris rusak jatuh ke [] di skema baca; tanpa baris, tabelnya tidak utuh.
    expect(toComparisonDetail(dbRow({ content: { ...content, rows: "rusak" } }), catalog)).toBeNull();
    expect(
      toComparisonDetail(dbRow({ content: { ...content, rows: [row("kara-alasan")] } }), catalog),
    ).toBeNull();
  });

  it("keeps repeated option keys (one pattern in a correct and a wrong form)", () => {
    const options = [
      { key: "node", text: "ので", verdict: "ok" },
      { key: "node", text: "なので", verdict: "wrong", note: "Salah sambung." },
    ];
    const detail = toComparisonDetail(
      dbRow({ content: { ...content, contrasts: [{ ...content.contrasts[0], options }] } }),
      catalog,
    );
    expect(detail?.content.contrasts[0].options.map((option) => option.verdict)).toEqual([
      "ok",
      "wrong",
    ]);
  });

  it("drops internal AI and review fields that leak into content", () => {
    const detail = toComparisonDetail(
      dbRow({
        content: {
          ...content,
          ai: { model: "x", promptVersion: "v1", tokens: 10 },
          reviewedAt: "2026-10-04",
          rows: content.rows.map((item) => ({ ...item, doubt: "?" })),
        },
      }),
      catalog,
    );
    const json = JSON.stringify(detail);
    for (const field of ["ai", "model", "promptVersion", "tokens", "reviewedAt", "doubt"]) {
      expect(json).not.toContain(`"${field}"`);
    }
  });
});

describe("comparisonLevels", () => {
  it("lists distinct levels from N5 to N1", () => {
    expect(comparisonLevels([tame, kara, node, kara])).toEqual(["N5", "N4", "N3"]);
  });
});

describe("compareComparisonLinks", () => {
  const link = (title: string, points: BunpouPointSummary[]): BunpouComparisonLink => ({
    key: title,
    title,
    summary: "",
    points,
  });

  it("sorts by the hardest member level, then the easiest, then title", () => {
    const sorted = [
      link("Beta", [kara, tame]),
      link("Gamma", [node, tame]),
      link("Alfa", [kara, tame]),
      link("Delta", [kara, node]),
    ].sort(compareComparisonLinks);
    expect(sorted.map((item) => item.title)).toEqual(["Delta", "Alfa", "Beta", "Gamma"]);
  });
});

describe("comparisonDescription", () => {
  it("strips furigana markup", () => {
    expect(comparisonDescription("{危|あぶ}ない  ので\nmundur.")).toBe("危ない ので mundur.");
  });

  it("cuts long summaries at a word boundary", () => {
    const description = comparisonDescription(`${"kata ".repeat(60)}akhir`);
    expect(description.length).toBeLessThanOrEqual(160);
    expect(description.endsWith("kata…")).toBe(true);
  });
});

describe("patternVariants", () => {
  it("splits variants after the separator", () => {
    expect(patternVariants("〜に{伴|ともな}い／〜に{伴|ともな}って")).toEqual([
      "〜に{伴|ともな}い／",
      "〜に{伴|ともな}って",
    ]);
  });

  it("keeps single-form titles whole", () => {
    expect(patternVariants("〜ので")).toEqual(["〜ので"]);
  });
});

// Seluruh perbandingan di fixture harus lolos jalur baca yang sama dengan
// halaman, dengan katalog berisi semua point terbit.
describe("comparison fixtures", () => {
  const dataDir = fileURLToPath(new URL("../../../bunpou-data/", import.meta.url));
  const readJson = (file: string): unknown => JSON.parse(readFileSync(`${dataDir}${file}`, "utf8"));

  const ComparisonFileSchema = z.object({
    comparisons: z.array(
      z.object({
        key: z.string(),
        title: z.string(),
        points: z.array(z.string()),
        content: z.unknown(),
        reviewedAt: z.string().nullable(),
      }),
    ),
  });
  const PointFileSchema = z.object({
    points: z.array(z.object({ key: z.string(), content: z.object({ title: z.string() }).nullable() })),
  });

  const fixtureCatalog = new Map(
    BUNPOU_LEVELS.flatMap((level) =>
      PointFileSchema.parse(readJson(`points/${level.toLowerCase()}.json`)).points.flatMap((point) =>
        point.content ? [summary(point.key, level, point.content.title)] : [],
      ),
    ).map((point) => [point.key, point]),
  );
  const published = ComparisonFileSchema.parse(readJson("comparisons.json")).comparisons.filter(
    (comparison) => comparison.reviewedAt !== null,
  );

  it("has reviewed comparisons to check", () => {
    expect(published.length).toBeGreaterThan(0);
  });

  it.each(published.map((comparison) => [comparison.key, comparison] as const))(
    "%s renders with every member and verdict",
    (_key, comparison) => {
      const detail = toComparisonDetail(
        {
          id: 1,
          key: comparison.key,
          title: comparison.title,
          content: comparison.content,
          updatedAt: "2026-10-05T00:00:00.000Z",
          pointKeys: comparison.points,
        },
        fixtureCatalog,
      );
      expect(detail).not.toBeNull();
      expect(detail?.content.rows.map((item) => item.key)).toEqual(comparison.points);
      expect(detail?.content.contrasts.length).toBeGreaterThan(0);
      for (const contrast of detail?.content.contrasts ?? []) {
        expect(contrast.options.some((option) => option.verdict === "ok")).toBe(true);
      }
    },
  );
});
