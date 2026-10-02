import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { CACHE_KEYS, CACHE_TAGS } from "@/constants/cache-key";
import { prisma } from "@/lib/prisma";
import { BunpouComparisonContentSchema, BunpouContentSchema } from "./schemas";
import { BUNPOU_LEVELS, BUNPOU_TAG_BY_SLUG } from "./taxonomy";
import type {
  BunpouComparisonDetail,
  BunpouComparisonLink,
  BunpouPointDetail,
  BunpouPointSummary,
} from "./types";

/**
 * Query katalog bunpou. Katalognya milik aplikasi dan hanya berubah lewat
 * `npm run seed:bunpou`, jadi semuanya di-cache dengan satu tag
 * (`CACHE_TAGS.bunpouCatalog`) dan direvalidasi tiap jam. Daftar ringkas seluruh
 * pola dimuat sekali lalu dipakai ulang untuk family, pola terkait, dan navigasi
 * sebelum/sesudah, alih-alih query terpisah per halaman.
 */

const REVALIDATE_SECONDS = 3600;
const RELATED_LIMIT = 6;

const CACHE_OPTIONS = { tags: [CACHE_TAGS.bunpouCatalog], revalidate: REVALIDATE_SECONDS };

function levelRank(level: BunpouPointSummary["level"]) {
  return BUNPOU_LEVELS.indexOf(level);
}

/** Urutan belajar: N5 → N1, lalu `order` di dalam level. */
export function compareBunpouPoints(left: BunpouPointSummary, right: BunpouPointSummary) {
  return levelRank(left.level) - levelRank(right.level) || left.order - right.order;
}

const getCachedCatalog = unstable_cache(
  async (): Promise<BunpouPointSummary[]> => {
    const rows = await prisma.$queryRaw<BunpouPointSummary[]>`
      SELECT p.key, p.level::text AS level, p."order", p.kind::text AS kind, p."sectionKey",
        p.family, p.content->>'senseLabel' AS "senseLabel", p.title, p."titlePlain",
        p."titleReading", p."titleRomaji", p."meaningId", p."meaningEn", p."searchText", p.tags,
        ARRAY(
          SELECT DISTINCT connection->>'form'
          FROM jsonb_array_elements(
            CASE WHEN jsonb_typeof(p.content->'connections') = 'array'
              THEN p.content->'connections' ELSE '[]'::jsonb END
          ) AS connection
        ) AS "connectionForms"
      FROM "BunpouPoint" p
      WHERE p."retiredAt" IS NULL
    `;
    return rows.sort(compareBunpouPoints);
  },
  CACHE_KEYS.bunpouCatalog,
  CACHE_OPTIONS,
);

/** Semua pola terbit, urut N5 → N1 lalu `order`. */
export const getBunpouCatalog = cache(() => getCachedCatalog());

const getCachedComparisonList = unstable_cache(
  async () => {
    const rows = await prisma.bunpouComparison.findMany({
      where: { retiredAt: null },
      orderBy: { key: "asc" },
      select: {
        key: true,
        title: true,
        content: true,
        updatedAt: true,
        points: { orderBy: { order: "asc" }, select: { point: { select: { key: true } } } },
      },
    });
    return rows.map((row) => {
      const content = BunpouComparisonContentSchema.safeParse(row.content);
      return {
        key: row.key,
        title: row.title,
        summary: content.success ? content.data.summary : "",
        pointKeys: row.points.map((link) => link.point.key),
        updatedAt: row.updatedAt.toISOString(),
      };
    });
  },
  CACHE_KEYS.bunpouComparisonList,
  CACHE_OPTIONS,
);

/** Perbandingan terbit beserta key pola anggotanya, urut key. */
export const getBunpouComparisonList = cache(async () => {
  const rows = await getCachedComparisonList();
  return rows.map((row) => ({ ...row, updatedAt: new Date(row.updatedAt) }));
});

const getCachedPointRow = (key: string) =>
  unstable_cache(
    async (pointKey: string) => {
      const row = await prisma.bunpouPoint.findFirst({
        where: { key: pointKey, retiredAt: null },
        select: { id: true, content: true, updatedAt: true },
      });
      return row
        ? { id: row.id, content: row.content, updatedAt: row.updatedAt.toISOString() }
        : null;
    },
    CACHE_KEYS.bunpouPoint(key),
    CACHE_OPTIONS,
  )(key);

/**
 * Satu entri per makna dalam family. Makna yang sama boleh terbit di beberapa
 * level (level mengikuti slide sumber), tetapi sebagai tab cukup sekali: pola
 * yang sedang dibuka, atau entri dari level terdekat.
 */
function distinctSenses(point: BunpouPointSummary, catalog: BunpouPointSummary[]) {
  if (!point.family) return [point];
  const bySense = new Map<string, BunpouPointSummary>();
  for (const candidate of catalog) {
    if (candidate.family !== point.family) continue;
    const sense = candidate.senseLabel ?? candidate.key;
    const current = bySense.get(sense);
    const better =
      !current ||
      candidate.key === point.key ||
      (current.key !== point.key &&
        Math.abs(levelRank(candidate.level) - levelRank(point.level)) <
          Math.abs(levelRank(current.level) - levelRank(point.level)));
    if (better) bySense.set(sense, candidate);
  }
  return [...bySense.values()].sort(compareBunpouPoints);
}

/**
 * Pola dengan fungsi yang sama di luar family-nya. Level yang sama didahulukan,
 * lalu level terdekat, supaya pembaca N5 tidak langsung disodori pola N1.
 */
function findRelated(point: BunpouPointSummary, catalog: BunpouPointSummary[]) {
  const functions = new Set(
    point.tags.filter((slug) => BUNPOU_TAG_BY_SLUG.get(slug)?.dimension === "function"),
  );
  return catalog
    .filter(
      (candidate) =>
        candidate.key !== point.key &&
        (point.family === null || candidate.family !== point.family) &&
        candidate.tags.some((slug) => functions.has(slug)),
    )
    .map((candidate) => ({
      candidate,
      shared: candidate.tags.filter((slug) => functions.has(slug)).length,
      distance: Math.abs(levelRank(candidate.level) - levelRank(point.level)),
    }))
    .sort(
      (left, right) =>
        left.distance - right.distance ||
        right.shared - left.shared ||
        compareBunpouPoints(left.candidate, right.candidate),
    )
    .slice(0, RELATED_LIMIT)
    .map((item) => item.candidate);
}

export const getBunpouPointDetail = cache(
  async (key: string): Promise<BunpouPointDetail | null> => {
    const [catalog, row, comparisons] = await Promise.all([
      getBunpouCatalog(),
      getCachedPointRow(key),
      getBunpouComparisonList(),
    ]);
    const index = catalog.findIndex((item) => item.key === key);
    if (index === -1 || !row) return null;

    const content = BunpouContentSchema.safeParse(row.content);
    if (!content.success) return null;

    const point = catalog[index];
    const previous = catalog[index - 1];
    const next = catalog[index + 1];
    const comparisonLinks: BunpouComparisonLink[] = comparisons
      .filter((comparison) => comparison.pointKeys.includes(key))
      .map((comparison) => ({
        key: comparison.key,
        title: comparison.title,
        summary: comparison.summary,
      }));

    return {
      id: row.id,
      point,
      content: content.data,
      updatedAt: new Date(row.updatedAt),
      family: distinctSenses(point, catalog),
      comparisons: comparisonLinks,
      related: findRelated(point, catalog),
      previous: previous?.level === point.level ? previous : null,
      next: next?.level === point.level ? next : null,
    };
  },
);

const getCachedComparisonRow = (key: string) =>
  unstable_cache(
    async (comparisonKey: string) => {
      const row = await prisma.bunpouComparison.findFirst({
        where: { key: comparisonKey, retiredAt: null },
        select: {
          id: true,
          key: true,
          title: true,
          content: true,
          updatedAt: true,
          points: { orderBy: { order: "asc" }, select: { point: { select: { key: true } } } },
        },
      });
      if (!row) return null;
      return {
        id: row.id,
        key: row.key,
        title: row.title,
        content: row.content,
        updatedAt: row.updatedAt.toISOString(),
        pointKeys: row.points.map((link) => link.point.key),
      };
    },
    CACHE_KEYS.bunpouComparison(key),
    CACHE_OPTIONS,
  )(key);

export const getBunpouComparisonDetail = cache(
  async (key: string): Promise<BunpouComparisonDetail | null> => {
    const [catalog, row] = await Promise.all([getBunpouCatalog(), getCachedComparisonRow(key)]);
    if (!row) return null;

    const content = BunpouComparisonContentSchema.safeParse(row.content);
    if (!content.success) return null;

    const byKey = new Map(catalog.map((item) => [item.key, item]));
    const points = row.pointKeys.flatMap((pointKey) => {
      const point = byKey.get(pointKey);
      return point ? [point] : [];
    });
    // Seed hanya menerbitkan perbandingan yang semua polanya terbit; kalau ada
    // yang hilang (dipensiunkan belakangan), tabelnya tidak lagi utuh.
    if (points.length !== row.pointKeys.length || points.length < 2) return null;

    return {
      id: row.id,
      key: row.key,
      title: row.title,
      content: content.data,
      updatedAt: new Date(row.updatedAt),
      points,
    };
  },
);

const getCachedSitemapEntries = unstable_cache(
  async () => {
    const points = await prisma.bunpouPoint.findMany({
      where: { retiredAt: null },
      select: { key: true, updatedAt: true },
      orderBy: { key: "asc" },
    });
    return points.map((point) => ({ key: point.key, updatedAt: point.updatedAt.toISOString() }));
  },
  CACHE_KEYS.bunpouSitemap,
  CACHE_OPTIONS,
);

export async function getBunpouSitemapEntries() {
  const [points, comparisons] = await Promise.all([
    getCachedSitemapEntries(),
    getBunpouComparisonList(),
  ]);
  return {
    points: points.map((point) => ({ key: point.key, updatedAt: new Date(point.updatedAt) })),
    comparisons: comparisons.map((comparison) => ({
      key: comparison.key,
      updatedAt: comparison.updatedAt,
    })),
  };
}
