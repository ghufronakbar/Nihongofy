import taxonomyData from "@/bunpou-data/taxonomy.json";
import type { BunpouKind, BunpouLevel } from "./types";

/**
 * Taxonomy bunpou. Sumber tunggalnya `src/bunpou-data/taxonomy.json`, yang juga
 * dibaca validator seed dan prompt generator — jangan menyalin daftar ke tempat
 * lain.
 */

export type BunpouSection = (typeof taxonomyData.sections)[number];
export type BunpouTag = (typeof taxonomyData.tags)[number];
export type BunpouConnectionForm = (typeof taxonomyData.connectionForms)[number];
export type BunpouTagDimension = "function" | "register" | "nuance";

export const BUNPOU_LICENSE = taxonomyData.license;

export const BUNPOU_LEVELS: BunpouLevel[] = ["N5", "N4", "N3", "N2", "N1"];

export const BUNPOU_SECTIONS: BunpouSection[] = [...taxonomyData.sections].sort(
  (left, right) => left.order - right.order,
);

export const BUNPOU_SECTION_BY_KEY = new Map(BUNPOU_SECTIONS.map((section) => [section.key, section]));

export const BUNPOU_TAG_BY_SLUG = new Map(taxonomyData.tags.map((tag) => [tag.slug, tag]));

export const BUNPOU_DIMENSIONS = taxonomyData.dimensions.map((dimension) => ({
  id: dimension.id as BunpouTagDimension,
  label: dimension.label,
}));

export const BUNPOU_TAGS_BY_DIMENSION = new Map(
  BUNPOU_DIMENSIONS.map((dimension) => [
    dimension.id,
    taxonomyData.tags.filter((tag) => tag.dimension === dimension.id),
  ]),
);

export const BUNPOU_CONNECTION_FORMS = taxonomyData.connectionForms;

export const BUNPOU_CONNECTION_FORM_BY_SLUG = new Map(
  taxonomyData.connectionForms.map((form) => [form.slug, form]),
);

export const BUNPOU_KIND_LABEL: Record<BunpouKind, string> = {
  PATTERN: "Pola kalimat",
  PARTICLE: "Partikel",
  CONJUGATION: "Konjugasi",
  FOUNDATION: "Dasar",
};

export const BUNPOU_KINDS = Object.keys(BUNPOU_KIND_LABEL) as BunpouKind[];

export function sectionLabel(key: string) {
  return BUNPOU_SECTION_BY_KEY.get(key)?.label ?? key;
}

/** Tag siap tampil per dimensi; slug yang tidak dikenal dibuang. */
export function describeBunpouTags(slugs: readonly string[]) {
  return slugs
    .map((slug) => BUNPOU_TAG_BY_SLUG.get(slug))
    .filter((tag): tag is BunpouTag => tag !== undefined)
    .map((tag) => ({
      slug: tag.slug,
      label: tag.label,
      labelJa: tag.labelJa,
      dimension: tag.dimension as BunpouTagDimension,
    }));
}
