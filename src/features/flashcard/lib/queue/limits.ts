import type { FlashcardPresetConfig } from "../../schemas";
import type { DeckBudget } from "./types";

/**
 * Daily limit Anki bekerja per deck, bukan global, dan limit sebuah deck membatasi
 * seluruh subtree-nya. Modul lama menghitung limit global lintas deck karena review
 * log tidak menyimpan deck — itu bug yang ditutup di sini.
 *
 * Aturan yang ditiru:
 *   - Limit berlaku mulai dari deck yang DIPILIH; limit induknya tidak ikut,
 *     kecuali `limitsStartFromTop` aktif.
 *   - Budget sebuah deck = limitnya sendiri dikurangi yang sudah dipelajari hari
 *     ini di subtree-nya, lalu dipotong lagi oleh budget induknya.
 */

export type DeckLimitNode = {
  deckId: number;
  config: FlashcardPresetConfig;
  /** Review hari ini di deck ini saja (bukan subtree). */
  studiedNewToday: number;
  studiedReviewsToday: number;
  children: DeckLimitNode[];
};

const UNLIMITED: DeckBudget = {
  newLimit: Number.POSITIVE_INFINITY,
  reviewLimit: Number.POSITIVE_INFINITY,
};

function subtreeStudied(node: DeckLimitNode): { newCards: number; reviews: number } {
  return node.children.reduce(
    (total, child) => {
      const childTotal = subtreeStudied(child);
      return {
        newCards: total.newCards + childTotal.newCards,
        reviews: total.reviews + childTotal.reviews,
      };
    },
    { newCards: node.studiedNewToday, reviews: node.studiedReviewsToday },
  );
}

export type DeckBudgetPlan = {
  budgets: Map<number, DeckBudget>;
  /**
   * Rantai deck dari root sampai deck itu sendiri.
   *
   * Ini yang membuat limit induk membatasi TOTAL subtree, bukan tiap subdeck
   * secara terpisah: mengambil satu kartu dari subdeck ikut memakan jatah semua
   * leluhurnya. Tanpa ini, induk berlimit 20 dengan dua anak akan menghasilkan
   * 40 kartu.
   */
  chains: Map<number, number[]>;
};

function walk(
  node: DeckLimitNode,
  inherited: DeckBudget,
  budgets: Map<number, DeckBudget>,
  chains: Map<number, number[]>,
  path: number[],
) {
  const studied = subtreeStudied(node);
  const effective: DeckBudget = {
    newLimit: Math.min(
      inherited.newLimit,
      Math.max(0, node.config.newCardsPerDay - studied.newCards),
    ),
    reviewLimit: Math.min(
      inherited.reviewLimit,
      Math.max(0, node.config.maxReviewsPerDay - studied.reviews),
    ),
  };

  const chain = [...path, node.deckId];
  budgets.set(node.deckId, effective);
  chains.set(node.deckId, chain);
  for (const child of node.children) walk(child, effective, budgets, chains, chain);
}

/**
 * Budget per deck untuk sesi belajar yang dimulai dari `root`.
 *
 * `ancestorBudget` hanya diisi saat `limitsStartFromTop` aktif — itulah satu-satunya
 * kondisi di mana limit deck induk ikut membatasi subdeck yang dipilih.
 */
export function computeDeckBudgets(
  root: DeckLimitNode,
  ancestorBudget: DeckBudget = UNLIMITED,
): DeckBudgetPlan {
  const budgets = new Map<number, DeckBudget>();
  const chains = new Map<number, number[]>();
  walk(root, ancestorBudget, budgets, chains, []);
  return { budgets, chains };
}

/** Budget gabungan seluruh rantai induk, dipakai saat `limitsStartFromTop` aktif. */
export function budgetFromAncestors(
  ancestors: { config: FlashcardPresetConfig; studiedNewToday: number; studiedReviewsToday: number }[],
): DeckBudget {
  return ancestors.reduce<DeckBudget>(
    (budget, ancestor) => ({
      newLimit: Math.min(
        budget.newLimit,
        Math.max(0, ancestor.config.newCardsPerDay - ancestor.studiedNewToday),
      ),
      reviewLimit: Math.min(
        budget.reviewLimit,
        Math.max(0, ancestor.config.maxReviewsPerDay - ancestor.studiedReviewsToday),
      ),
    }),
    UNLIMITED,
  );
}

export { UNLIMITED as UNLIMITED_BUDGET };
