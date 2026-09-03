/**
 * Parser file teks format Anki (.csv / .txt).
 *
 * Mengikuti spesifikasi "Text Files" di manual Anki, termasuk header `#key:value`
 * yang ditambahkan Anki 2.1.54 — sehingga file hasil ekspor Anki ("Notes in
 * Plain Text") bisa langsung dipakai tanpa disunting.
 */

export type AnkiTextHeaders = {
  separator: string;
  /** `#html:true` — isi field diperlakukan sebagai HTML. */
  html: boolean;
  columns: string[] | null;
  notetype: string | null;
  deck: string | null;
  tags: string[];
  /** Semua index kolom disimpan 0-based; di file mereka ditulis 1-based. */
  notetypeColumn: number | null;
  deckColumn: number | null;
  tagsColumn: number | null;
  guidColumn: number | null;
};

export type ParsedAnkiText = {
  headers: AnkiTextHeaders;
  rows: string[][];
  /** Jumlah kolom, ditentukan baris non-komentar pertama seperti di Anki. */
  columnCount: number;
  warnings: string[];
};

const NAMED_SEPARATORS: Record<string, string> = {
  comma: ",",
  semicolon: ";",
  tab: "\t",
  space: " ",
  pipe: "|",
  colon: ":",
};

const CANDIDATE_SEPARATORS = ["\t", ",", ";", "|"];

function defaultHeaders(): AnkiTextHeaders {
  return {
    separator: "\t",
    html: false,
    columns: null,
    notetype: null,
    deck: null,
    tags: [],
    notetypeColumn: null,
    deckColumn: null,
    tagsColumn: null,
    guidColumn: null,
  };
}

function parseColumnIndex(value: string): number | null {
  const parsed = Number(value.trim());
  // File memakai penomoran 1-based; nilai <= 0 diabaikan, bukan dianggap kolom 0.
  return Number.isInteger(parsed) && parsed >= 1 ? parsed - 1 : null;
}

function resolveSeparator(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  if (normalized in NAMED_SEPARATORS) return NAMED_SEPARATORS[normalized]!;
  // Anki juga menerima karakter literal, mis. `#separator:|`
  const literal = value.trim();
  return literal.length === 1 ? literal : null;
}

/**
 * Membaca blok header di awal file.
 *
 * Hanya baris `#key:value` di bagian PALING ATAS yang dianggap header. Baris
 * diawali `#` setelah data dimulai adalah data biasa — sebuah kartu boleh saja
 * dimulai dengan tanda pagar.
 */
function readHeaders(lines: string[]): {
  headers: AnkiTextHeaders;
  bodyStart: number;
  warnings: string[];
} {
  const headers = defaultHeaders();
  const warnings: string[] = [];
  let separatorSet = false;
  let index = 0;

  for (; index < lines.length; index += 1) {
    const line = lines[index]!;
    if (!line.startsWith("#")) break;

    const colon = line.indexOf(":");
    if (colon === -1) break;

    const key = line.slice(1, colon).trim().toLowerCase();
    const value = line.slice(colon + 1);

    switch (key) {
      case "separator": {
        const separator = resolveSeparator(value);
        if (separator) {
          headers.separator = separator;
          separatorSet = true;
        } else {
          warnings.push(`Separator "${value.trim()}" tidak dikenal; dideteksi otomatis.`);
        }
        break;
      }
      case "html":
        headers.html = value.trim().toLowerCase() === "true";
        break;
      case "notetype":
        headers.notetype = value.trim() || null;
        break;
      case "deck":
        headers.deck = value.trim() || null;
        break;
      case "tags":
        headers.tags = value.trim().split(/\s+/).filter(Boolean);
        break;
      case "columns":
        // Nilainya dipisah separator, yang mungkin baru diketahui setelah ini —
        // karena itu pemrosesannya ditunda ke pemanggil.
        headers.columns = [value];
        break;
      case "notetype column":
        headers.notetypeColumn = parseColumnIndex(value);
        break;
      case "deck column":
        headers.deckColumn = parseColumnIndex(value);
        break;
      case "tags column":
        headers.tagsColumn = parseColumnIndex(value);
        break;
      case "guid column":
        headers.guidColumn = parseColumnIndex(value);
        break;
      default:
        warnings.push(`Header "#${key}" tidak dikenal dan diabaikan.`);
    }
  }

  return { headers: { ...headers, separator: separatorSet ? headers.separator : "" }, bodyStart: index, warnings };
}

/**
 * Menebak separator dari beberapa baris pertama.
 *
 * Dipilih kandidat yang jumlah kemunculannya paling konsisten antar baris dan
 * minimal satu — separator yang benar menghasilkan jumlah kolom yang sama di
 * setiap baris, sedangkan karakter kebetulan tidak.
 */
export function detectSeparator(sample: string[]): string {
  let best = "\t";
  let bestScore = -1;

  for (const candidate of CANDIDATE_SEPARATORS) {
    const counts = sample.map((line) => splitLine(line, candidate).length);
    if (counts.length === 0 || counts[0]! < 2) continue;

    const consistent = counts.every((count) => count === counts[0]);
    const score = (consistent ? 1_000 : 0) + counts[0]!;
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  return best;
}

/**
 * Memecah satu baris logis menjadi field.
 *
 * Field boleh dibungkus tanda kutip ganda untuk memuat separator; kutip di dalam
 * di-escape dengan menggandakannya (`""`).
 */
function splitLine(line: string, separator: string): string[] {
  const fields: string[] = [];
  let current = "";
  let quoted = false;
  let index = 0;

  while (index < line.length) {
    const char = line[index]!;

    if (quoted) {
      if (char === '"') {
        if (line[index + 1] === '"') {
          current += '"';
          index += 2;
          continue;
        }
        quoted = false;
        index += 1;
        continue;
      }
      current += char;
      index += 1;
      continue;
    }

    if (char === '"' && current.trim() === "") {
      // Kutip hanya membuka field bila berada di awalnya.
      current = "";
      quoted = true;
      index += 1;
      continue;
    }

    if (line.startsWith(separator, index)) {
      fields.push(current);
      current = "";
      index += separator.length;
      continue;
    }

    current += char;
    index += 1;
  }

  fields.push(current);
  return fields;
}

/**
 * Menggabungkan baris fisik menjadi baris logis.
 *
 * Field yang dibungkus kutip boleh memuat newline, jadi satu record bisa
 * membentang beberapa baris file.
 */
function joinLogicalLines(lines: string[]): string[] {
  const logical: string[] = [];
  let buffer: string | null = null;

  for (const line of lines) {
    const candidate: string = buffer === null ? line : `${buffer}\n${line}`;
    // Jumlah kutip ganjil berarti masih ada field yang belum ditutup.
    const quotes = (candidate.match(/"/g) ?? []).length;
    if (quotes % 2 === 1) {
      buffer = candidate;
      continue;
    }
    logical.push(candidate);
    buffer = null;
  }

  if (buffer !== null) logical.push(buffer);
  return logical;
}

export function parseAnkiText(content: string): ParsedAnkiText {
  const normalized = content.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const rawLines = normalized.split("\n");

  const { headers, bodyStart, warnings } = readHeaders(rawLines);
  const bodyLines = rawLines.slice(bodyStart).filter((line) => line.trim() !== "");

  const separator =
    headers.separator || detectSeparator(bodyLines.slice(0, 20));

  const logicalLines = joinLogicalLines(bodyLines);
  const rows = logicalLines.map((line) => splitLine(line, separator));

  // `#columns:` baru bisa dipecah setelah separator diketahui.
  const columns =
    headers.columns === null
      ? null
      : splitLine(headers.columns[0]!, separator).map((name) => name.trim());

  const columnCount = columns?.length ?? rows[0]?.length ?? 0;

  const normalizedRows = rows.map((row) => {
    if (row.length === columnCount) return row;
    if (row.length < columnCount) {
      // Field yang kurang dianggap kosong, seperti di Anki.
      return [...row, ...Array<string>(columnCount - row.length).fill("")];
    }
    return row.slice(0, columnCount);
  });

  const ragged = rows.filter((row) => row.length !== columnCount).length;
  if (ragged > 0) {
    warnings.push(
      `${ragged} baris punya jumlah kolom berbeda; kelebihannya dibuang dan kekurangannya dikosongkan.`,
    );
  }

  return {
    headers: { ...headers, separator, columns },
    rows: normalizedRows,
    columnCount,
    warnings,
  };
}
