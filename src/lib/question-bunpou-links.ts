import type { JlptLevel } from "@prisma/client";
import { FEATURES } from "@/constants";

// Tautan soal → pola bunpou ("Pola yang diuji"), satu-satunya definisi `select`
// Prisma untuk relasi `Question.bunpouLinks`.
//
// Tautan menyebut pola yang diuji jawaban benar, jadi aturannya sama dengan select
// pembahasan (docs/database.md "Aturan Query"): hanya diambil di query yang memang
// boleh membuka pembahasan, dan dijaga answer-key-guard.test.ts.
// Pengecoh (DISTRACTOR) dan tautan ber-confidence rendah tidak pernah ditampilkan.
export const QUESTION_BUNPOU_LINKS_SELECT = {
  where: { role: "TESTED", confidence: "HIGH", point: { retiredAt: null } },
  orderBy: { order: "asc" },
  select: { point: { select: { key: true, title: true, level: true, meaningId: true } } },
} as const;

export type QuestionBunpouPointView = {
  key: string;
  title: string; // markup furigana
  level: JlptLevel;
  meaningId: string;
};

/**
 * Bentuk tampilan dari hasil `QUESTION_BUNPOU_LINKS_SELECT`. Kosong saat modul
 * bunpou dimatikan, karena tautannya menuju /bunpou yang saat itu 404.
 */
export function toBunpouPoints(
  links: readonly { point: QuestionBunpouPointView }[] | undefined,
): QuestionBunpouPointView[] {
  if (!FEATURES.bunpou || !links) return [];
  return links.map((link) => link.point);
}
