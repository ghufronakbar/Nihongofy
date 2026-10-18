import { toHiragana } from "wanakana";

export const KEYBOARD_ROWS = [
  "あいうえおかきくけこ", "さしすせそたちつてと", "なにぬねのはひふへほ",
  "まみむめもやゆよらり", "るれろわをんぁぃぅぇ", "ぉゃゅょっゎゔー",
] as const;
const ALPHABET = new Set(Array.from(`${KEYBOARD_ROWS.join("")}がぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽ`));

export function normalizeKana(value: string) {
  return toHiragana(value.normalize("NFKC"), { passRomaji: true, convertLongVowelMark: false }).normalize("NFC");
}
export function isGameKana(value: string) {
  return value.length > 0 && Array.from(value).every((char) => ALPHABET.has(char));
}
export function composeRomaji(value: string) {
  const converted = toHiragana(value.normalize("NFKC").toLowerCase(), { IMEMode: true, convertLongVowelMark: false }).normalize("NFC");
  const pending = converted.match(/[a-z']+$/)?.[0] ?? "";
  return { kana: converted.slice(0, converted.length - pending.length), pending, raw: converted };
}
export function modifyKana(char: string, mode: "small" | "voice") {
  const groups = mode === "small"
    ? ["あぁ", "いぃ", "うぅ", "えぇ", "おぉ", "やゃ", "ゆゅ", "よょ", "つっ", "わゎ"]
    : ["かが", "きぎ", "くぐ", "けげ", "こご", "さざ", "しじ", "すず", "せぜ", "そぞ", "ただ", "ちぢ", "つづ", "てで", "とど", "はばぱ", "ひびぴ", "ふぶぷ", "へべぺ", "ほぼぽ", "うゔ"];
  const group = groups.find((item) => item.includes(char));
  return group ? group[(group.indexOf(char) + 1) % group.length]! : char;
}
