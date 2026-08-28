export type KanaScript = "hiragana" | "katakana";

export type KanaVariation = {
  char: string;
  romaji: string;
};

export type KanaCard = {
  key: string;
  char: string;
  romaji: string;
  script: KanaScript;
  group: string;
  columnIndex: number; // 0 for 'a', 1 for 'i', 2 for 'u', 3 for 'e', 4 for 'o'
  rowIndex: number;
  variations: KanaVariation[];
};

export type KanaRowDefinition = {
  group: string;
  slots: (string | null)[];
};

export const KANA_VOWELS = ["a", "i", "u", "e", "o"] as const;

export const KANA_ROW_DEFINITIONS: KanaRowDefinition[] = [
  { group: "Vokal", slots: ["a", "i", "u", "e", "o"] },
  { group: "K", slots: ["ka", "ki", "ku", "ke", "ko"] },
  { group: "S", slots: ["sa", "shi", "su", "se", "so"] },
  { group: "T", slots: ["ta", "chi", "tsu", "te", "to"] },
  { group: "N", slots: ["na", "ni", "nu", "ne", "no"] },
  { group: "H", slots: ["ha", "hi", "fu", "he", "ho"] },
  { group: "M", slots: ["ma", "mi", "mu", "me", "mo"] },
  { group: "Y", slots: ["ya", null, "yu", null, "yo"] },
  { group: "R", slots: ["ra", "ri", "ru", "re", "ro"] },
  { group: "W", slots: ["wa", null, null, null, "wo"] },
  { group: "N akhir", slots: ["n", null, null, null, null] },
];

const CHARACTERS: Record<KanaScript, (string | null)[][]> = {
  hiragana: [
    ["あ", "い", "う", "え", "お"],
    ["か", "き", "く", "け", "こ"],
    ["さ", "し", "す", "せ", "そ"],
    ["た", "ち", "つ", "て", "と"],
    ["な", "に", "ぬ", "ね", "の"],
    ["は", "ひ", "ふ", "へ", "ほ"],
    ["ま", "み", "む", "め", "も"],
    ["や", null, "ゆ", null, "よ"],
    ["ら", "り", "る", "れ", "ろ"],
    ["わ", null, null, null, "を"],
    ["ん", null, null, null, null],
  ],
  katakana: [
    ["ア", "イ", "ウ", "エ", "オ"],
    ["カ", "キ", "ク", "ケ", "コ"],
    ["サ", "シ", "ス", "セ", "ソ"],
    ["タ", "チ", "ツ", "テ", "ト"],
    ["ナ", "ニ", "ヌ", "ネ", "ノ"],
    ["ハ", "ヒ", "フ", "ヘ", "ホ"],
    ["マ", "ミ", "ム", "メ", "モ"],
    ["ヤ", null, "ユ", null, "ヨ"],
    ["ラ", "リ", "ル", "レ", "ロ"],
    ["ワ", null, null, null, "ヲ"],
    ["ン", null, null, null, null],
  ],
};

const VOICED_VARIATIONS: Record<string, string[]> = {
  ka: ["ga"], ki: ["gi"], ku: ["gu"], ke: ["ge"], ko: ["go"],
  sa: ["za"], shi: ["ji"], su: ["zu"], se: ["ze"], so: ["zo"],
  ta: ["da"], chi: ["di"], tsu: ["du"], te: ["de"], to: ["do"],
  ha: ["ba", "pa"], hi: ["bi", "pi"], fu: ["bu", "pu"],
  he: ["be", "pe"], ho: ["bo", "po"],
};

const VARIATION_CHARACTERS: Record<KanaScript, Record<string, string[]>> = {
  hiragana: {
    ka: ["が"], ki: ["ぎ"], ku: ["ぐ"], ke: ["げ"], ko: ["ご"],
    sa: ["ざ"], shi: ["じ"], su: ["ず"], se: ["ぜ"], so: ["ぞ"],
    ta: ["だ"], chi: ["ぢ"], tsu: ["づ"], te: ["で"], to: ["ど"],
    ha: ["ば", "ぱ"], hi: ["び", "ぴ"], fu: ["ぶ", "ぷ"],
    he: ["べ", "ぺ"], ho: ["ぼ", "ぽ"],
  },
  katakana: {
    ka: ["ガ"], ki: ["ギ"], ku: ["グ"], ke: ["ゲ"], ko: ["ゴ"],
    sa: ["ザ"], shi: ["ジ"], su: ["ズ"], se: ["ゼ"], so: ["ゾ"],
    ta: ["ダ"], chi: ["ヂ"], tsu: ["ヅ"], te: ["デ"], to: ["ド"],
    ha: ["バ", "パ"], hi: ["ビ", "ピ"], fu: ["ブ", "プ"],
    he: ["ベ", "ペ"], ho: ["ボ", "ポ"],
  },
};

function buildKana(script: KanaScript): KanaCard[] {
  const cards: KanaCard[] = [];
  KANA_ROW_DEFINITIONS.forEach((row, rowIndex) => {
    row.slots.forEach((romaji, columnIndex) => {
      if (!romaji) return;
      const char = CHARACTERS[script][rowIndex][columnIndex];
      if (!char) return;
      const variationChars = VARIATION_CHARACTERS[script][romaji] ?? [];
      const variationRomaji = VOICED_VARIATIONS[romaji] ?? [];

      cards.push({
        key: `${script}-${romaji}`,
        char,
        romaji,
        script,
        group: row.group,
        columnIndex,
        rowIndex,
        variations: variationChars.map((vChar, index) => ({
          char: vChar,
          romaji: variationRomaji[index],
        })),
      });
    });
  });
  return cards;
}

export const HIRAGANA = buildKana("hiragana");
export const KATAKANA = buildKana("katakana");
export const KANA_GROUPS = KANA_ROW_DEFINITIONS.map((group) => group.group);

export function getKanaByScript(script: KanaScript) {
  return script === "hiragana" ? HIRAGANA : KATAKANA;
}

export function isKnownKanaKey(key: string) {
  return HIRAGANA.some((kana) => kana.key === key) || KATAKANA.some((kana) => kana.key === key);
}
