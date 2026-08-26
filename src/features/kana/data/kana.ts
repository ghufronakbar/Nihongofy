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
  variations: KanaVariation[];
};

const GROUPS = [
  { group: "Vokal", romaji: ["a", "i", "u", "e", "o"] },
  { group: "K", romaji: ["ka", "ki", "ku", "ke", "ko"] },
  { group: "S", romaji: ["sa", "shi", "su", "se", "so"] },
  { group: "T", romaji: ["ta", "chi", "tsu", "te", "to"] },
  { group: "N", romaji: ["na", "ni", "nu", "ne", "no"] },
  { group: "H", romaji: ["ha", "hi", "fu", "he", "ho"] },
  { group: "M", romaji: ["ma", "mi", "mu", "me", "mo"] },
  { group: "Y", romaji: ["ya", "yu", "yo"] },
  { group: "R", romaji: ["ra", "ri", "ru", "re", "ro"] },
  { group: "W", romaji: ["wa", "wo"] },
  { group: "N akhir", romaji: ["n"] },
] as const;

const CHARACTERS: Record<KanaScript, string[][]> = {
  hiragana: [
    ["あ", "い", "う", "え", "お"],
    ["か", "き", "く", "け", "こ"],
    ["さ", "し", "す", "せ", "そ"],
    ["た", "ち", "つ", "て", "と"],
    ["な", "に", "ぬ", "ね", "の"],
    ["は", "ひ", "ふ", "へ", "ほ"],
    ["ま", "み", "む", "め", "も"],
    ["や", "ゆ", "よ"],
    ["ら", "り", "る", "れ", "ろ"],
    ["わ", "を"],
    ["ん"],
  ],
  katakana: [
    ["ア", "イ", "ウ", "エ", "オ"],
    ["カ", "キ", "ク", "ケ", "コ"],
    ["サ", "シ", "ス", "セ", "ソ"],
    ["タ", "チ", "ツ", "テ", "ト"],
    ["ナ", "ニ", "ヌ", "ネ", "ノ"],
    ["ハ", "ヒ", "フ", "ヘ", "ホ"],
    ["マ", "ミ", "ム", "メ", "モ"],
    ["ヤ", "ユ", "ヨ"],
    ["ラ", "リ", "ル", "レ", "ロ"],
    ["ワ", "ヲ"],
    ["ン"],
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
  return GROUPS.flatMap((row, rowIndex) =>
    row.romaji.map((romaji, columnIndex) => {
      const variationChars = VARIATION_CHARACTERS[script][romaji] ?? [];
      const variationRomaji = VOICED_VARIATIONS[romaji] ?? [];

      return {
        key: `${script}-${romaji}`,
        char: CHARACTERS[script][rowIndex][columnIndex],
        romaji,
        script,
        group: row.group,
        variations: variationChars.map((char, index) => ({
          char,
          romaji: variationRomaji[index],
        })),
      };
    }),
  );
}

export const HIRAGANA = buildKana("hiragana");
export const KATAKANA = buildKana("katakana");
export const KANA_GROUPS = GROUPS.map((group) => group.group);

export function getKanaByScript(script: KanaScript) {
  return script === "hiragana" ? HIRAGANA : KATAKANA;
}

export function isKnownKanaKey(key: string) {
  return HIRAGANA.some((kana) => kana.key === key) || KATAKANA.some((kana) => kana.key === key);
}
