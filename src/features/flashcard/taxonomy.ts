import taxonomyData from "@/flashcard-data/taxonomy.json";

/**
 * Taxonomy tag flashcard. Sumber tunggalnya `src/flashcard-data/taxonomy.json`,
 * yang juga dibaca script seed dan prompt generator AI — jangan menyalin daftar
 * tag ke tempat lain.
 */

export type FlashcardTagDimension = "level" | "pos" | "register" | "category" | "topic";

export type FlashcardTag = {
  slug: string;
  dimension: string;
  label: string;
  labelJa: string;
  deck: boolean;
  deckName?: string;
  description: string;
};

export type FlashcardTagView = {
  slug: string;
  label: string;
  dimension: string;
};

const TAGS: FlashcardTag[] = taxonomyData.tags;

export const FLASHCARD_LICENSE = taxonomyData.license;

/** Deck bawaan dengan kata lebih sedikit dari ini tidak ditampilkan. */
export const FLASHCARD_DECK_MIN_NOTES = taxonomyData.deckMinNotes;

export const FLASHCARD_TAG_BY_SLUG = new Map(TAGS.map((tag) => [tag.slug, tag]));

const DIMENSION_ORDER = taxonomyData.dimensions.map((dimension) => dimension.id);

/**
 * Tag kartu dalam bentuk siap tampil, diurutkan per dimensi. Tag level tidak
 * ikut karena levelnya sudah ditampilkan terpisah, dan slug yang tidak dikenal
 * dibuang alih-alih ditampilkan mentah.
 */
export function describeTags(slugs: readonly string[]): FlashcardTagView[] {
  return slugs
    .map((slug) => FLASHCARD_TAG_BY_SLUG.get(slug))
    .filter((tag): tag is FlashcardTag => tag !== undefined && tag.dimension !== "level")
    .sort(
      (left, right) =>
        DIMENSION_ORDER.indexOf(left.dimension) - DIMENSION_ORDER.indexOf(right.dimension),
    )
    .map((tag) => ({ slug: tag.slug, label: tag.label, dimension: tag.dimension }));
}
