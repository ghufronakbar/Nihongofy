import type { FlashcardPresetConfig } from "../../schemas";
import type { QueueEntry, QueueGroup } from "./types";

/**
 * Sibling burying.
 *
 * Dua aturan Anki yang mudah salah:
 *   1. Kartu intraday learning TIDAK PERNAH di-bury — tidak ada opsinya, dan
 *      kartu yang sedang berjalan harus tetap muncul.
 *   2. Sibling yang lebih belakang tidak bisa mem-bury tipe kartu yang lebih
 *      depan. Karena queue sudah tersusun urut intraday -> interday -> review ->
 *      new, ini otomatis terpenuhi selama pemrosesan dilakukan berurutan: yang
 *      pertama menang, yang belakangan yang di-bury.
 */

const BURY_FLAG: Record<QueueGroup, keyof FlashcardPresetConfig | null> = {
  intradayLearning: null,
  interdayLearning: "buryInterdayLearningSiblings",
  review: "buryReviewSiblings",
  new: "buryNewSiblings",
};

export type BuryResult = {
  queue: QueueEntry[];
  /** Kartu yang harus ditandai BURIED_SIBLING sampai batas hari berikutnya. */
  buried: QueueEntry[];
};

export function applySiblingBurying(
  queue: QueueEntry[],
  config: FlashcardPresetConfig,
): BuryResult {
  const seenNotes = new Set<string>();
  const kept: QueueEntry[] = [];
  const buried: QueueEntry[] = [];

  for (const entry of queue) {
    const flag = BURY_FLAG[entry.group];
    const buryEnabled = flag !== null && config[flag] === true;

    if (buryEnabled && seenNotes.has(entry.noteId)) {
      buried.push(entry);
      continue;
    }

    seenNotes.add(entry.noteId);
    kept.push(entry);
  }

  return { queue: kept, buried };
}
