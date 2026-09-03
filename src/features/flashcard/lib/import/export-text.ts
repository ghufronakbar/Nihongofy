import type { FlashcardNoteTypeKind } from "@prisma/client";
import { getNoteType } from "../../note-types";

/**
 * Export ke format teks Anki.
 *
 * Sengaja menghasilkan file yang bisa langsung diimpor kembali lewat jalur impor
 * yang sama, termasuk kolom GUID — sehingga export lalu import ulang memperbarui
 * note yang ada, bukan menggandakannya.
 */

export type ExportNote = {
  guid: string;
  fields: string[];
  tags: string[];
  deckName: string;
};

const SEPARATOR = "\t";

/**
 * Field dibungkus kutip hanya bila perlu. Tab dan newline WAJIB dikutip; tanpa
 * itu satu field bisa terbaca sebagai beberapa kolom saat diimpor kembali.
 */
function escapeField(value: string): string {
  if (!/["\t\n\r]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

export function buildAnkiTextExport(
  noteType: FlashcardNoteTypeKind,
  notes: ExportNote[],
): string {
  const definition = getNoteType(noteType);
  const columnNames = [
    "GUID",
    ...definition.fields.map((field) => field.label),
    "Tags",
    "Deck",
  ];

  const lines = [
    "#separator:Tab",
    "#html:false",
    `#columns:${columnNames.join(SEPARATOR)}`,
    "#guid column:1",
    `#tags column:${columnNames.length - 1}`,
    `#deck column:${columnNames.length}`,
  ];

  for (const note of notes) {
    const cells = [
      note.guid,
      ...definition.fields.map((_, index) => note.fields[index] ?? ""),
      note.tags.join(" "),
      note.deckName,
    ];
    lines.push(cells.map(escapeField).join(SEPARATOR));
  }

  return `${lines.join("\n")}\n`;
}
