import { z } from "zod";
import type { FlashcardNoteTypeKind } from "@prisma/client";
import {
  FLASHCARD_NOTE_TYPE_KINDS,
  FLASHCARD_NOTE_TYPES,
  extractClozeOrdinals,
} from "@/features/flashcard/note-types";

// Diturunkan dari daftar kanonik, bukan ditulis ulang. Assertion tuple-nya
// hanya untuk memenuhi tanda tangan z.enum; membungkusnya dengan `as z.ZodType`
// akan membuat tipe input menjadi unknown dan zodResolver berhenti cocok dengan
// react-hook-form.
const noteTypeKindSchema = z.enum(
  FLASHCARD_NOTE_TYPE_KINDS as [FlashcardNoteTypeKind, ...FlashcardNoteTypeKind[]],
);

// Slug adalah kunci deduplikasi seed dan ikut membentuk guid note yang disalin
// ke koleksi user (`sys:<slug>:<guid>`), jadi bentuknya sama persis dengan yang
// diterima `prisma/seed-flashcard-deck.mjs`.
const deckSlugSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9-]{3,120}$/, "Slug wajib huruf kecil, angka, atau strip; 3-120 karakter.");

const deckFields = {
  slug: deckSlugSchema,
  name: z.string().trim().min(1, "Nama deck wajib diisi.").max(500),
  description: z.string().trim().max(2000),
  jlptLevel: z.enum(["N5", "N4", "N3", "N2", "N1"]).nullable(),
  noteType: noteTypeKindSchema,
  // Wajib dan ditampilkan di UI publik: sumber seperti JMdict, Tatoeba, dan
  // KanjiVG mewajibkan atribusi. Untuk konten sendiri pun tetap harus ditulis.
  license: z.string().trim().min(1, "Lisensi wajib diisi dan akan ditampilkan ke user.").max(300),
  order: z.number().int().min(0).max(9999),
  isPublished: z.boolean(),
};

export const CreateSystemDeckSchema = z.object(deckFields);
export const UpdateSystemDeckSchema = z.object({
  id: z.number().int().positive(),
  ...deckFields,
});

export const SetSystemDeckPublishedSchema = z.object({
  id: z.number().int().positive(),
  isPublished: z.boolean(),
});

export const DeleteSystemDeckSchema = z.object({
  id: z.number().int().positive(),
  confirmSlug: z.string().trim().min(1),
});

export const ExportSystemDeckSchema = z.object({
  id: z.number().int().positive(),
});

// `guid` maksimal 48 karakter dan harus STABIL: mengubahnya membuat note lama
// hilang dari katalog dan note baru dibuat, sehingga user yang menambahkan ulang
// deck mendapat kartu duplikat dengan progres kosong. Karena itu guid hanya
// dapat diisi saat membuat note, tidak saat menyunting.
const guidSchema = z
  .string()
  .trim()
  .min(1, "guid wajib diisi.")
  .max(48, "guid maksimal 48 karakter.")
  .regex(/^[\w.:-]+$/, "guid hanya boleh huruf, angka, titik, titik dua, garis bawah, dan strip.");

const noteBody = {
  fields: z.array(z.string()).min(1).max(12),
  tags: z.array(z.string().trim().min(1).max(60)).max(20),
  order: z.number().int().min(0).max(99999),
};

export const CreateSystemNoteSchema = z.object({
  deckId: z.number().int().positive(),
  guid: guidSchema,
  ...noteBody,
});

export const UpdateSystemNoteSchema = z.object({
  id: z.number().int().positive(),
  ...noteBody,
});

export const DeleteSystemNoteSchema = z.object({
  id: z.number().int().positive(),
});

/**
 * Memvalidasi `fields` terhadap definisi kanonik note type di
 * `src/features/flashcard/note-types.ts` — sumber kebenaran yang sama yang
 * dipakai renderer kartu dan importer, bukan salinan aturan di sini.
 */
export function validateNoteFields(
  kind: FlashcardNoteTypeKind,
  fields: string[],
): string | null {
  const noteType = FLASHCARD_NOTE_TYPES[kind];

  if (fields.length !== noteType.fields.length) {
    return `Note type ${kind} membutuhkan tepat ${noteType.fields.length} field.`;
  }

  for (const [index, definition] of noteType.fields.entries()) {
    if (definition.required && fields[index].trim().length === 0) {
      return `Field "${definition.label}" wajib diisi.`;
    }
  }

  if (noteType.isCloze && extractClozeOrdinals(fields[0]).length === 0) {
    return "Note cloze wajib memuat minimal satu {{c1::jawaban}}.";
  }

  return null;
}

export type CreateSystemDeckInput = z.infer<typeof CreateSystemDeckSchema>;
export type UpdateSystemDeckInput = z.infer<typeof UpdateSystemDeckSchema>;
export type SetSystemDeckPublishedInput = z.infer<typeof SetSystemDeckPublishedSchema>;
export type DeleteSystemDeckInput = z.infer<typeof DeleteSystemDeckSchema>;
export type ExportSystemDeckInput = z.infer<typeof ExportSystemDeckSchema>;
export type CreateSystemNoteInput = z.infer<typeof CreateSystemNoteSchema>;
export type UpdateSystemNoteInput = z.infer<typeof UpdateSystemNoteSchema>;
export type DeleteSystemNoteInput = z.infer<typeof DeleteSystemNoteSchema>;
