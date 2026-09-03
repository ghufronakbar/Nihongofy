import type { FlashcardNoteTypeKind } from "@prisma/client";
import { countCardsForNote, getNoteType, getSortFieldIndex } from "../../note-types";
import { fieldToPlainText } from "../render/sanitize";
import type { ParsedAnkiText } from "./parse-text";

/**
 * Memetakan kolom file ke field note type aplikasi.
 *
 * Anki menyimpan struktur field di dalam file (lewat note type-nya sendiri).
 * Di sini note type ditentukan aplikasi, jadi pemetaan kolom harus eksplisit —
 * file dari sumber mana pun tidak akan pernah kebetulan cocok urutannya.
 */

export type ColumnRole =
  | { kind: "field"; fieldKey: string }
  | { kind: "tags" }
  | { kind: "deck" }
  | { kind: "guid" }
  | { kind: "ignore" };

export type ImportMapping = {
  noteType: FlashcardNoteTypeKind;
  /** Satu peran per kolom, panjangnya sama dengan `columnCount`. */
  columns: ColumnRole[];
  /** Deck tujuan bila tidak ada kolom deck. */
  deckName: string;
  /** Tag yang ditambahkan ke semua note. */
  extraTags: string[];
};

export type ImportRow = {
  guid: string | null;
  fields: string[];
  tags: string[];
  deckName: string;
  cardCount: number;
  /** Checksum field sort, padanan `csum` di Anki. */
  checksum: number;
};

export type MappingProblem = {
  rowIndex: number;
  message: string;
};

export type MappedRows = {
  rows: ImportRow[];
  problems: MappingProblem[];
};

/** Checksum field pertama; dipakai mempersempit pencarian duplikat. */
export function fieldChecksum(value: string): number {
  let hash = 0;
  const normalized = fieldToPlainText(value);
  for (let index = 0; index < normalized.length; index += 1) {
    hash = (Math.imul(31, hash) + normalized.charCodeAt(index)) | 0;
  }
  return hash;
}

/** Nama kolom yang secara konvensi berarti peran khusus, bukan field konten. */
const SPECIAL_COLUMN_NAMES: Record<string, "guid" | "tags" | "deck"> = {
  guid: "guid",
  id: "guid",
  tags: "tags",
  tag: "tags",
  deck: "deck",
};

/**
 * Tebakan awal pemetaan kolom.
 *
 * Header `#columns:` dicocokkan dengan nama/label field bila ada; kalau tidak,
 * kolom dipasangkan berurutan ke field note type. Pengguna tetap bisa
 * mengubahnya sebelum impor dijalankan.
 */
export function suggestMapping(
  parsed: ParsedAnkiText,
  noteType: FlashcardNoteTypeKind,
): ColumnRole[] {
  const definition = getNoteType(noteType);
  const roles: ColumnRole[] = Array.from({ length: parsed.columnCount }, () => ({
    kind: "ignore",
  }));

  const assign = (index: number, role: ColumnRole) => {
    if (index >= 0 && index < roles.length) roles[index] = role;
  };

  // Kolom khusus dari header selalu menang atas pencocokan nama.
  if (parsed.headers.guidColumn !== null) assign(parsed.headers.guidColumn, { kind: "guid" });
  if (parsed.headers.deckColumn !== null) assign(parsed.headers.deckColumn, { kind: "deck" });
  if (parsed.headers.tagsColumn !== null) assign(parsed.headers.tagsColumn, { kind: "tags" });

  const taken = new Set<string>();
  const columnNames = parsed.headers.columns;

  if (columnNames) {
    columnNames.forEach((name, index) => {
      if (roles[index]?.kind !== "ignore") return;
      const normalized = name.trim().toLowerCase();

      // Kolom yang jelas-jelas bernama guid/tags/deck dikenali sebagai peran
      // khusus. Tanpa ini, kolom "GUID" akan dijejalkan ke field acak yang
      // kebetulan masih kosong.
      const special = SPECIAL_COLUMN_NAMES[normalized];
      if (special) {
        assign(index, { kind: special });
        return;
      }

      const match = definition.fields.find(
        (field) =>
          !taken.has(field.key) &&
          (field.key.toLowerCase() === normalized ||
            field.label.toLowerCase() === normalized),
      );
      if (match) {
        taken.add(match.key);
        assign(index, { kind: "field", fieldKey: match.key });
      }
    });

    // File yang menyebutkan nama kolom dianggap sudah menjelaskan dirinya:
    // kolom yang tidak cocok dibiarkan diabaikan, bukan ditebak. Menebak di sini
    // justru menaruh data ke field yang salah tanpa user sadar.
    return roles;
  }

  // Tanpa nama kolom, satu-satunya petunjuk adalah urutan.
  let fieldCursor = 0;
  for (let index = 0; index < roles.length; index += 1) {
    if (roles[index]!.kind !== "ignore") continue;
    while (fieldCursor < definition.fields.length && taken.has(definition.fields[fieldCursor]!.key)) {
      fieldCursor += 1;
    }
    if (fieldCursor >= definition.fields.length) break;

    const field = definition.fields[fieldCursor]!;
    taken.add(field.key);
    assign(index, { kind: "field", fieldKey: field.key });
    fieldCursor += 1;
  }

  return roles;
}

export function validateMapping(mapping: ImportMapping): string[] {
  const definition = getNoteType(mapping.noteType);
  const errors: string[] = [];

  const mapped = mapping.columns.filter(
    (role): role is { kind: "field"; fieldKey: string } => role.kind === "field",
  );
  const keys = mapped.map((role) => role.fieldKey);

  const duplicates = keys.filter((key, index) => keys.indexOf(key) !== index);
  if (duplicates.length > 0) {
    errors.push(`Field dipetakan lebih dari sekali: ${[...new Set(duplicates)].join(", ")}.`);
  }

  for (const field of definition.fields) {
    if (field.required && !keys.includes(field.key)) {
      errors.push(`Field wajib "${field.label}" belum dipetakan ke kolom mana pun.`);
    }
  }

  if (mapping.columns.filter((role) => role.kind === "guid").length > 1) {
    errors.push("Hanya boleh ada satu kolom GUID.");
  }
  if (mapping.deckName.trim() === "" && !mapping.columns.some((role) => role.kind === "deck")) {
    errors.push("Tentukan deck tujuan atau pilih kolom deck.");
  }

  return errors;
}

/**
 * Mengubah baris mentah menjadi note siap simpan.
 *
 * Baris yang field wajibnya kosong dilewati dan dilaporkan, bukan menggagalkan
 * seluruh impor — file dari sumber lain hampir selalu punya beberapa baris rusak.
 */
export function mapRows(
  parsed: ParsedAnkiText,
  mapping: ImportMapping,
  limit?: number,
): MappedRows {
  const definition = getNoteType(mapping.noteType);
  const rows: ImportRow[] = [];
  const problems: MappingProblem[] = [];
  const sortIndex = getSortFieldIndex(mapping.noteType);

  const source = limit === undefined ? parsed.rows : parsed.rows.slice(0, limit);

  source.forEach((row, rowIndex) => {
    const fields = definition.fields.map(() => "");
    let guid: string | null = null;
    let deckName = mapping.deckName;
    const tags = [...mapping.extraTags, ...parsed.headers.tags];

    mapping.columns.forEach((role, columnIndex) => {
      const raw = row[columnIndex] ?? "";
      switch (role.kind) {
        case "field": {
          const fieldIndex = definition.fields.findIndex((field) => field.key === role.fieldKey);
          if (fieldIndex >= 0) fields[fieldIndex] = raw.trim();
          break;
        }
        case "guid":
          guid = raw.trim() || null;
          break;
        case "deck":
          if (raw.trim()) deckName = raw.trim();
          break;
        case "tags":
          tags.push(...raw.trim().split(/\s+/).filter(Boolean));
          break;
        default:
          break;
      }
    });

    const missing = definition.fields.filter(
      (field, index) => field.required && fields[index]!.trim() === "",
    );
    if (missing.length > 0) {
      problems.push({
        rowIndex,
        message: `Field wajib kosong: ${missing.map((field) => field.label).join(", ")}.`,
      });
      return;
    }

    const cardCount = countCardsForNote(mapping.noteType, fields);
    if (cardCount === 0) {
      problems.push({
        rowIndex,
        message: definition.isCloze
          ? "Tidak ada penanda {{c1::...}}, jadi tidak menghasilkan kartu."
          : "Tidak menghasilkan kartu.",
      });
      return;
    }

    rows.push({
      guid,
      fields,
      tags: [...new Set(tags)],
      deckName,
      cardCount,
      checksum: fieldChecksum(fields[sortIndex] ?? ""),
    });
  });

  return { rows, problems };
}

/** Baris per batch yang dikirim ke server. Cukup kecil supaya tiap request cepat. */
export const FLASHCARD_IMPORT_CHUNK_SIZE = 500;

export const IMPORT_MODES = ["update", "ignoreDuplicates", "importAsNew"] as const;
export type ImportMode = (typeof IMPORT_MODES)[number];

/**
 * GUID yang dipakai saat menyimpan satu baris.
 *
 * Mode `importAsNew` MENGABAIKAN guid dari file. Kalau tidak, mengimpor ulang
 * file yang punya kolom GUID akan mencoba membuat note dengan guid yang sudah
 * ada — dan "impor sebagai baru" justru berarti note ini memang baru, terlepas
 * dari apa isi kolom guid-nya.
 */
export function resolveImportGuid(
  mode: ImportMode,
  rowGuid: string | null,
  jobId: string,
  rowIndex: number,
): string {
  if (mode === "importAsNew" || !rowGuid) return `imp:${jobId}:${rowIndex}`;
  return rowGuid;
}
