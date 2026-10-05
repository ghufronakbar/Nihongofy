import { toPlainJapanese } from "@/lib/japanese-markup";
import { BunpouComparisonContentSchema } from "../schemas";
import { BUNPOU_LEVELS } from "../taxonomy";
import type {
  BunpouComparisonContent,
  BunpouComparisonDetail,
  BunpouComparisonLink,
  BunpouLevel,
  BunpouPointSummary,
} from "../types";

/**
 * Perakitan perbandingan dari baris database dan katalog. Dipisah dari
 * `queries.ts` (server-only) supaya aturan terbitnya bisa diuji tanpa database.
 */

const DESCRIPTION_LIMIT = 160;

/**
 * Pola anggota dalam urutan kolom. Null bila ada anggota yang tidak terbit lagi:
 * tabel perbandingan hanya bermakna bila semua polanya utuh, jadi perbandingan
 * itu diperlakukan tidak ada (sama dengan aturan seed).
 */
export function resolveComparisonPoints(
  pointKeys: readonly string[],
  catalogByKey: ReadonlyMap<string, BunpouPointSummary>,
): BunpouPointSummary[] | null {
  const points = pointKeys.flatMap((key) => {
    const point = catalogByKey.get(key);
    return point ? [point] : [];
  });
  return points.length === pointKeys.length && points.length >= 2 ? points : null;
}

/**
 * Detail perbandingan siap tampil, atau null bila belum lengkap. Baris tabel
 * diurutkan menurut urutan anggota di database, bukan urutan di JSON, dan
 * setiap anggota wajib punya baris.
 */
export function toComparisonDetail(
  row: {
    id: number;
    key: string;
    title: string;
    content: unknown;
    updatedAt: string;
    pointKeys: readonly string[];
  },
  catalogByKey: ReadonlyMap<string, BunpouPointSummary>,
): BunpouComparisonDetail | null {
  const content = BunpouComparisonContentSchema.safeParse(row.content);
  if (!content.success) return null;

  const points = resolveComparisonPoints(row.pointKeys, catalogByKey);
  if (!points) return null;

  const rowByKey = new Map(content.data.rows.map((item) => [item.key, item]));
  const rows: BunpouComparisonContent["rows"] = [];
  for (const point of points) {
    const item = rowByKey.get(point.key);
    if (!item) return null;
    rows.push(item);
  }

  return {
    id: row.id,
    key: row.key,
    title: row.title,
    content: { ...content.data, rows },
    updatedAt: new Date(row.updatedAt),
    points,
  };
}

/** Level anggota tanpa duplikat, urut N5 → N1. */
export function comparisonLevels(points: readonly Pick<BunpouPointSummary, "level">[]): BunpouLevel[] {
  return BUNPOU_LEVELS.filter((level) => points.some((point) => point.level === level));
}

/**
 * Urutan belajar untuk daftar perbandingan: level tersulit anggotanya dulu
 * (perbandingan baru bisa dipahami setelah semua polanya dikenal), lalu level
 * termudah, lalu judul.
 */
export function compareComparisonLinks(left: BunpouComparisonLink, right: BunpouComparisonLink) {
  const rank = (link: BunpouComparisonLink) =>
    comparisonLevels(link.points).map((level) => BUNPOU_LEVELS.indexOf(level));
  const leftRank = rank(left);
  const rightRank = rank(right);
  return (
    (leftRank.at(-1) ?? 0) - (rightRank.at(-1) ?? 0) ||
    (leftRank[0] ?? 0) - (rightRank[0] ?? 0) ||
    left.title.localeCompare(right.title, "id")
  );
}

/** Ringkasan untuk meta description: tanpa markup, dipotong di batas kata. */
export function comparisonDescription(summary: string) {
  const plain = toPlainJapanese(summary).replace(/\s+/g, " ").trim();
  if (plain.length <= DESCRIPTION_LIMIT) return plain;
  return `${plain.slice(0, DESCRIPTION_LIMIT - 3).replace(/\s+\S*$/, "")}…`;
}

/**
 * Judul bervariasi (`〜に伴い／〜に伴って`) dipecah per bentuk supaya kolom
 * tabel yang sempit membungkus di antara bentuk, bukan di tengahnya. Aman pada
 * markup karena `／` tidak pernah muncul di dalam `{kanji|bacaan}`.
 */
export function patternVariants(title: string) {
  const parts = title.split("／").filter((part) => part.length > 0);
  return parts.map((part, index) => (index < parts.length - 1 ? `${part}／` : part));
}
