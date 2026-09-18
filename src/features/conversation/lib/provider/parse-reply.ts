// Pengurai balasan berlabel.
//
// Gateway OpenAI-compatible tidak selalu meneruskan `response_format`, dan
// ketika diabaikan balasannya kembali sebagai teks biasa tanpa error apa pun.
// Format berlabel bekerja pada provider mana pun.
//
// Pengurainya sengaja sangat toleran. Model sesekali menambahkan pagar kode,
// penanda markdown, atau kalimat pembuka sebelum label — dan menolak balasan
// karena hal itu berarti percakapan gagal padahal jawabannya sebenarnya ada.

export type ParsedReply = {
  contentJa: string;
  contentTranslation: string | null;
  contentRomaji: string | null;
};

const LABELS = ["JA", "ID", "RO"] as const;

/** Ciri teks Jepang: hiragana, katakana, atau kanji. */
const JAPANESE_PATTERN = /[ぁ-ゖァ-ヺ一-龯]/;

/**
 * Memperbaiki bentuk furigana yang sesekali salah tulis.
 *
 * Model kadang menghasilkan `何{なに}` — bacaan di dalam kurung setelah kanji,
 * tanpa tanda pipa. Bentuk itu akan tampil mentah di layar dan tidak
 * menghasilkan bacaan untuk lip-sync. Pola yang sudah benar tidak tersentuh
 * karena kanjinya berada di dalam kurung, bukan sebelum kurung.
 */
export function normalizeFurigana(text: string): string {
  return text.replace(/([一-龯々]+)\{([ぁ-ゖー]+)\}/g, "{$1|$2}");
}

/** Membuang pagar kode ```json yang kadang membungkus keluaran model. */
export function stripCodeFence(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json|text)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

/** Membersihkan penanda markdown dan tanda kutip di awal baris label. */
function cleanLine(line: string): string {
  return line.replace(/^[\s>*_#-]+/, "").replace(/[\s*_]+$/, "");
}

/** Membuang sisa penanda markdown yang menempel tepat setelah titik dua. */
function cleanValue(value: string): string {
  return value.replace(/^[\s*_]+/, "").trim();
}

function extract(lines: string[], label: string): string | null {
  const labelPattern = new RegExp(`^${label}\\s*[:：]\\s*(.*)$`, "i");
  const anyLabelPattern = new RegExp(`^(?:${LABELS.join("|")})\\s*[:：]`, "i");

  const startIndex = lines.findIndex((line) => labelPattern.test(cleanLine(line)));
  if (startIndex === -1) return null;

  const first = cleanLine(lines[startIndex] ?? "").match(labelPattern)?.[1] ?? "";
  const rest: string[] = [];

  // Isi boleh berlanjut ke baris berikutnya sampai bertemu label lain.
  for (let i = startIndex + 1; i < lines.length; i += 1) {
    const cleaned = cleanLine(lines[i] ?? "");
    if (anyLabelPattern.test(cleaned)) break;
    rest.push(cleaned);
  }

  const value = [cleanValue(first), ...rest].join("\n").trim();
  return value ? value : null;
}

export function parseLabelledReply(raw: string): ParsedReply | null {
  const text = stripCodeFence(raw);
  if (!text) return null;

  const lines = text.split(/\r?\n/);
  const contentJa = extract(lines, "JA");

  if (contentJa) {
    return {
      contentJa: normalizeFurigana(contentJa),
      contentTranslation: extract(lines, "ID"),
      contentRomaji: extract(lines, "RO"),
    };
  }

  // Label JA hilang. Daripada menggagalkan percakapan, ambil baris berbahasa
  // Jepang pertama yang bukan baris berlabel lain.
  const anyLabelPattern = new RegExp(`^(?:${LABELS.join("|")})\\s*[:：]`, "i");
  const japaneseLine = lines
    .map(cleanLine)
    .find((line) => line && !anyLabelPattern.test(line) && JAPANESE_PATTERN.test(line));

  if (japaneseLine) {
    return {
      contentJa: normalizeFurigana(japaneseLine),
      contentTranslation: extract(lines, "ID"),
      contentRomaji: extract(lines, "RO"),
    };
  }

  // Tanpa label dan tanpa baris Jepang: pakai seluruh teks apa adanya, selama
  // ia memang mengandung aksara Jepang.
  return JAPANESE_PATTERN.test(text)
    ? { contentJa: normalizeFurigana(text), contentTranslation: null, contentRomaji: null }
    : null;
}

/**
 * Mengambil bagian Jepang dari balasan yang masih setengah jadi.
 *
 * Dipakai saat streaming: label `JA:` datang lebih dulu, jadi isinya dapat
 * ditampilkan sambil mengalir. Begitu label berikutnya muncul, bagian Jepang
 * dianggap selesai dan sisanya tidak lagi ikut ditampilkan.
 */
export function extractPartialJapanese(partial: string): string {
  const text = partial.replace(/^```(?:json|text)?\s*/i, "");
  const match = text.match(/(?:^|\n)\s*[>*_#-]*\s*JA\s*[:：]\s*([\s\S]*)$/i);

  if (!match) {
    // Label belum muncul. Bila sudah ada aksara Jepang, tampilkan apa adanya —
    // sebagian model menulis jawabannya lebih dulu baru melabelinya.
    return JAPANESE_PATTERN.test(text) ? normalizeFurigana(text.trim()) : "";
  }

  const afterLabel = match[1] ?? "";
  // Berhenti di label berikutnya bila sudah terlihat.
  const stop = afterLabel.search(/\n\s*[>*_#-]*\s*(?:ID|RO)\s*[:：]/i);
  const value = stop === -1 ? afterLabel : afterLabel.slice(0, stop);

  return normalizeFurigana(value.replace(/^[\s*_]+/, "").trimEnd());
}
