// Aturan markup teks Jepang (docs/database.md "Markup Teks Jepang") untuk
// keluaran model bahasa. Dipakai bersama oleh generator pembahasan soal dan
// generator kosakata flashcard, supaya keduanya menolak kesalahan yang sama
// dengan pesan yang sama.
//
// Renderer-nya ada di src/lib/japanese-markup.ts. Aturan di sini sengaja lebih
// ketat daripada parser: parser memaafkan kurung yang tidak berpasangan (sisa
// teks dicetak apa adanya), sedangkan data yang disimpan tidak boleh begitu.

const FURIGANA = /\{([^{}|]+)\|([^{}|]+)\}/g;
const KANJI = /[一-鿿]/;
const KANJI_GLOBAL = /[一-鿿]/g;

/**
 * Daftar pelanggaran markup dalam `text`. Array kosong berarti aman disimpan.
 *
 * @param {string} text
 * @returns {string[]}
 */
export function markupProblems(text) {
  const problems = [];
  if (/<\/?[a-z][a-z0-9-]*(\s[^>]*)?>/i.test(text)) problems.push("mengandung tag HTML");
  if (/\*\*/.test(text)) problems.push("memakai markdown **tebal**");
  if (/^#{1,6}\s/m.test(text)) problems.push("memakai judul markdown #");

  const underlineCount = (text.match(/__/g) ?? []).length;
  if (underlineCount % 2 !== 0) problems.push("penanda __ tidak berpasangan");

  const openBraces = (text.match(/\{/g) ?? []).length;
  const closeBraces = (text.match(/\}/g) ?? []).length;
  const validFurigana = (text.match(/\{[^{}|]+\|[^{}|]+\}/g) ?? []).length;
  if (openBraces !== closeBraces || openBraces !== validFurigana) {
    // Pesan yang menunjuk potongan bermasalah, bukan sekadar menyatakan formatnya
    // salah: tanpa itu percobaan ulang kerap mengulangi kesalahan yang sama.
    const broken = (text.match(/\{[^{}]*\}/g) ?? []).filter(
      (group) => !/^\{[^{}|]+\|[^{}|]+\}$/.test(group),
    );
    const nested = nestedBraceGroups(text);
    const detail =
      broken.length > 0
        ? `perbaiki menjadi {漢字|かんじ}: ${broken.slice(0, 3).join(", ")}`
        : nested.length > 0
          ? `kurung kurawal bersarang: ${nested.slice(0, 3).join(", ")} — ` +
            "tulis satu blok per kanji tanpa kurung di dalam kurung, mis. お{腹|なか}"
          : `kurung kurawal tidak berpasangan (${openBraces} buka, ${closeBraces} tutup)`;
    problems.push(`format furigana salah — ${detail}`);
  }

  // Furigana yang kehilangan kurungnya, biasanya karena tertukar dengan penanda
  // garis bawah: __痛|いた__い alih-alih __{痛|いた}い__.
  let outsideGroups = text;
  while (/\{[^{}]*\}/.test(outsideGroups)) outsideGroups = outsideGroups.replace(/\{[^{}]*\}/g, "");
  const loosePipes = outsideGroups.match(/[^\s{}|_、。「」]*\|[^\s{}|_、。「」]*/g) ?? [];
  if (loosePipes.length > 0) {
    problems.push(
      `tanda | di luar kurung kurawal: ${[...new Set(loosePipes)].slice(0, 3).join(", ")} — ` +
        "furigana selalu {漢字|かな}, dan __ membungkus blok utuh, mis. __{痛|いた}い__",
    );
  }

  // Kanji di luar blok furigana tidak terbaca pelajar level bawah. Aturan ini
  // yang paling sering dilanggar model saat menyebut istilah seperti 訓読み.
  const redundant = [...text.matchAll(/\{([^{}|]+)\|[^{}|]+\}/g)]
    .filter((m) => !KANJI.test(m[1]))
    .map((m) => m[0]);
  if (redundant.length > 0) {
    problems.push(
      `furigana hanya untuk kanji, hapus dari: ${[...new Set(redundant)].slice(0, 4).join(", ")}`,
    );
  }

  const bareKanji = [
    ...new Set(text.replace(/\{[^{}|]+\|[^{}|]+\}/g, "").match(KANJI_GLOBAL) ?? []),
  ];
  if (bareKanji.length > 0) {
    problems.push(`kanji tanpa furigana: ${bareKanji.slice(0, 8).join("")}`);
  }

  return problems;
}

/**
 * Blok terluar yang memuat kurung kurawal lain, mis. `{お{腹|なか}|おなか}`.
 * Tanpa ini pesan errornya hanya "tidak berpasangan (4 buka, 4 tutup)", yang
 * tidak memberi tahu model bagian mana yang harus diperbaiki.
 *
 * @param {string} text
 * @returns {string[]}
 */
function nestedBraceGroups(text) {
  const groups = [];
  let depth = 0;
  let start = 0;
  let nested = false;
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "{") {
      if (depth === 0) {
        start = index;
        nested = false;
      } else {
        nested = true;
      }
      depth += 1;
    } else if (text[index] === "}" && depth > 0) {
      depth -= 1;
      if (depth === 0 && nested) groups.push(text.slice(start, index + 1));
    }
  }
  return groups;
}

/**
 * Teks tanpa furigana dan tanpa penanda garis bawah: `{食|た}べる` -> `食べる`.
 *
 * @param {string} text
 * @returns {string}
 */
export function stripJapaneseMarkup(text) {
  return text.replace(FURIGANA, "$1").replaceAll("__", "");
}

/**
 * Cara baca dari teks bermarkup: kanji diganti bacaan furigananya, sisanya
 * (kana, tanda baca) dipertahankan. `{食|た}べ{物|もの}` -> `たべもの`.
 *
 * @param {string} text
 * @returns {string}
 */
export function readingFromMarkup(text) {
  return text.replace(FURIGANA, "$2").replaceAll("__", "");
}

/**
 * Katakana -> hiragana, supaya perbandingan bacaan tidak gagal hanya karena
 * sumber menulis アニメ sementara furigana ditulis dalam hiragana.
 *
 * @param {string} text
 * @returns {string}
 */
export function toHiragana(text) {
  return text.replace(/[ァ-ヶ]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0x60),
  );
}

/**
 * @param {string} text
 * @returns {boolean}
 */
export function containsKanji(text) {
  return KANJI.test(text);
}
