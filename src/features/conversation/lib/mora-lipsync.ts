import { parseJapaneseMarkup, type MarkupSegment } from "@/lib/japanese-markup";

// Lip-sync perkiraan untuk bahasa Jepang.
//
// Alasannya bisa dilakukan tanpa provider berbayar: bacaan kana sudah tersimpan
// pada markup furigana project (`{漢字|かんじ}`), dan bahasa Jepang bersifat
// mora-timed — tiap mora durasinya relatif seragam. Jadi urutan bentuk mulut
// dapat diturunkan dari teksnya, lalu dijalankan pada laju tetap.
//
// BATASAN YANG HARUS JUJUR DISAMPAIKAN: ini perkiraan dari teks, bukan dari
// audio. Web Speech Synthesis tidak memberi tahu vokal yang sedang diucapkan,
// sehingga makin panjang kalimatnya makin mungkin melenceng. Sinkronisasi
// presisi memerlukan audio nyata untuk dibaca amplitudonya (§8.2 rancangan).

export type MouthShape = "closed" | "a" | "i" | "u" | "e" | "o";

// Laju bicara TTS lebih lambat daripada percakapan manusia (6-8 mora/detik),
// dan berbeda-beda antar perangkat serta suara. Nilai awal sengaja dipasang
// konservatif: mulut yang masih bergerak saat suara habis jauh lebih tidak
// mengganggu daripada mulut yang berhenti sementara suaranya masih berjalan.
export const DEFAULT_MORAE_PER_SECOND = 5.2;

const MIN_MORAE_PER_SECOND = 3;
const MAX_MORAE_PER_SECOND = 10;
// Bobot pengamatan baru terhadap estimasi berjalan. Cukup responsif untuk
// menyesuaikan dalam beberapa ucapan, tetapi tidak melonjak karena satu ucapan
// pendek yang tidak wakil.
const SMOOTHING = 0.4;

let moraePerSecond = DEFAULT_MORAE_PER_SECOND;

/** Estimasi laju bicara saat ini, sudah dikalibrasi dari ucapan sebelumnya. */
export function getMoraePerSecond() {
  return moraePerSecond;
}

export function resetMoraCalibration() {
  moraePerSecond = DEFAULT_MORAE_PER_SECOND;
}

/**
 * Mengalibrasi laju dari satu ucapan yang selesai normal.
 *
 * Web Speech Synthesis tidak memberi tahu durasi sebelum diucapkan, tetapi
 * memberi tahu kapan mulai dan selesai. Dari situ laju sebenarnya perangkat ini
 * dapat diukur, lalu dipakai untuk ucapan berikutnya — jadi lip-sync menyesuaikan
 * sendiri alih-alih bergantung pada satu angka tetap yang ditebak.
 */
export function recordUtteranceTiming(moraCount: number, elapsedMs: number, rate: number) {
  const safeRate = rate > 0 ? rate : 1;

  // Ucapan yang terlalu pendek atau kosong bukan sampel yang bisa dipercaya.
  if (moraCount < 4 || elapsedMs < 400) return;

  const observed = moraCount / (elapsedMs / 1000) / safeRate;
  if (!Number.isFinite(observed) || observed <= 0) return;

  const blended = moraePerSecond * (1 - SMOOTHING) + observed * SMOOTHING;
  moraePerSecond = Math.min(MAX_MORAE_PER_SECOND, Math.max(MIN_MORAE_PER_SECOND, blended));
}

const VOWEL_BY_KANA: Record<string, MouthShape> = {};

function register(vowel: MouthShape, kana: string) {
  for (const character of kana) VOWEL_BY_KANA[character] = vowel;
}

register("a", "あかがさざただなはばぱまやらわぁゃアカガサザタダナハバパマヤラワァャ");
register("i", "いきぎしじちぢにひびぴみりゐぃイキギシジチヂニヒビピミリヰィ");
register("u", "うくぐすずつづぬふぶぷむゆるぅゅウクグスズツヅヌフブプムユルゥュ");
register("e", "えけげせぜてでねへべぺめれゑぇエケゲセゼテデネヘベペメレヱェ");
register("o", "おこごそぞとどのほぼぽもよろをぉょオコゴソゾトドノホボポモヨロヲォョ");

// Kana kecil yang menyatu dengan mora sebelumnya, bukan mora tersendiri.
const SMALL_KANA = new Set("ゃゅょぁぃぅぇぉャュョァィゥェォ");
// Sokuon dan hatsuon: satu mora, mulut praktis tertutup.
const CLOSED_KANA = new Set("っんッン");
const PROLONG_KANA = new Set("ーｰ");

/** Mengambil bacaan kana dari markup: furigana memakai readingnya, sisanya apa adanya. */
function segmentsToReading(segments: MarkupSegment[]): string {
  return segments
    .map((segment) => {
      switch (segment.type) {
        case "text":
          return segment.value;
        case "furigana":
          return segment.reading;
        case "underline":
          return segmentsToReading(segment.children);
        case "slot":
          return "";
      }
    })
    .join("");
}

/**
 * Mengubah teks bermarkup menjadi urutan bentuk mulut, satu entri per mora.
 * Karakter yang bukan kana (tanda baca, latin, kanji tanpa furigana) diabaikan
 * dan tidak menghasilkan mora.
 */
export function textToMouthShapes(markup: string): MouthShape[] {
  const reading = segmentsToReading(parseJapaneseMarkup(markup));
  const shapes: MouthShape[] = [];

  for (const character of reading) {
    if (SMALL_KANA.has(character)) {
      // Menyatu dengan mora sebelumnya: きゃ tetap satu mora, vokalnya ikut
      // kana kecil ini.
      const vowel = VOWEL_BY_KANA[character];
      if (vowel && shapes.length > 0) shapes[shapes.length - 1] = vowel;
      continue;
    }

    if (CLOSED_KANA.has(character)) {
      shapes.push("closed");
      continue;
    }

    if (PROLONG_KANA.has(character)) {
      shapes.push(shapes[shapes.length - 1] ?? "closed");
      continue;
    }

    const vowel = VOWEL_BY_KANA[character];
    if (vowel) shapes.push(vowel);
  }

  return shapes;
}

/** Durasi satu mora dalam milidetik pada laju bicara tertentu. */
export function moraDurationMs(rate: number, perSecond: number = moraePerSecond) {
  const safeRate = rate > 0 ? rate : 1;
  return 1000 / (perSecond * safeRate);
}
