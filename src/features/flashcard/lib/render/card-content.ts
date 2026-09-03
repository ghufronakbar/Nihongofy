import type { FlashcardNoteTypeKind } from "@prisma/client";
import { extractClozeOrdinals, getNoteType } from "../../note-types";
import { sanitizeFieldHtml } from "./sanitize";

/**
 * Isi kartu diturunkan dari field note + definisi note type, bukan dari template
 * HTML milik user. Hasilnya berupa daftar field bernama; layout sepenuhnya
 * urusan komponen React.
 */

export type RenderedField = {
  key: string;
  label: string;
  /** Sudah disanitasi, aman untuk `dangerouslySetInnerHTML`. */
  html: string;
  japanese: boolean;
};

export type RenderedCard = {
  front: RenderedField[];
  back: RenderedField[];
  templateName: string;
};

const CLOZE_PATTERN = /\{\{c(\d{1,3})::(.*?)(?:::(.*?))?\}\}/g;

/**
 * Cloze: nomor yang sedang ditanya diganti placeholder di sisi soal dan
 * ditonjolkan di sisi jawaban. Nomor lain selalu tampil apa adanya.
 */
export function renderCloze(text: string, ordinal: number, reveal: boolean): string {
  return text.replace(CLOZE_PATTERN, (_match, rawIndex, answer, hint) => {
    if (Number(rawIndex) !== ordinal) return answer;
    if (reveal) return `<b>${answer}</b>`;
    return hint ? `[${hint}]` : "[...]";
  });
}

export function renderCard(
  noteType: FlashcardNoteTypeKind,
  fields: readonly string[],
  ord: number,
): RenderedCard {
  const definition = getNoteType(noteType);

  const build = (key: string): RenderedField | null => {
    const index = definition.fields.findIndex((field) => field.key === key);
    const raw = fields[index] ?? "";
    if (!raw.trim()) return null;

    const field = definition.fields[index]!;
    return {
      key,
      label: field.label,
      html: sanitizeFieldHtml(raw),
      japanese: field.japanese ?? false,
    };
  };

  if (definition.isCloze) {
    const textIndex = definition.fields.findIndex((field) => field.key === "text");
    const text = fields[textIndex] ?? "";
    const ordinal = extractClozeOrdinals(text)[ord] ?? 1;
    const noteField = build("note");

    const clozeField = (reveal: boolean): RenderedField => ({
      key: "text",
      label: "Teks",
      html: sanitizeFieldHtml(renderCloze(text, ordinal, reveal)),
      japanese: true,
    });

    return {
      templateName: `Cloze ${ordinal}`,
      front: [clozeField(false)],
      back: noteField ? [clozeField(true), noteField] : [clozeField(true)],
    };
  }

  const template = definition.cardTemplates[ord] ?? definition.cardTemplates[0]!;

  return {
    templateName: template.name,
    front: template.front.map(build).filter((field): field is RenderedField => field !== null),
    back: template.back.map(build).filter((field): field is RenderedField => field !== null),
  };
}

/** Teks yang dibacakan TTS untuk sisi soal. */
export function speakableText(card: RenderedCard): string | null {
  const japanese = card.front.find((field) => field.japanese);
  if (!japanese) return null;
  return japanese.html.replace(/<[^>]*>/g, "").trim() || null;
}
