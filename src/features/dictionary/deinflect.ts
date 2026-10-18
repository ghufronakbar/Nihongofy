import { DICTIONARY_LIMITS } from "@/constants/dictionary";

type Verb = "v1" | "v5u" | "v5k" | "v5g" | "v5s" | "v5t" | "v5n" | "v5b" | "v5m" | "v5r" | "vs" | "vk" | "adj-i";
type Form = Verb | "surface";
type Rule = { suffix: string; replacement: string; input: Form[]; output: Form; reason: string };
export type DictionaryCandidate = { term: string; form: Form; reasons: string[]; kana: boolean };

// Reverse conjugation transducer. Rules describe both the surface's class and
// the candidate lemma's class; lookup must additionally validate JMdict POS.
// Original project rules, without an external deinflection dataset/dependency.
const rules: Rule[] = [];
function add(suffix: string, replacement: string, output: Form, reason: string, input: Form[] = ["surface"]) {
  rules.push({ suffix, replacement, output, reason, input });
}
const polite = [["ます", "sopan"], ["ました", "sopan, lampau"], ["ません", "sopan, negatif"],
  ["ませんでした", "sopan, negatif, lampau"], ["ましょう", "sopan, ajakan"]] as const;
const godan: { stem: string; a: string; i: string; e: string; o: string; te: string; ta: string; pos: Verb }[] = [
  { stem: "う", a: "わ", i: "い", e: "え", o: "お", te: "って", ta: "った", pos: "v5u" },
  { stem: "く", a: "か", i: "き", e: "け", o: "こ", te: "いて", ta: "いた", pos: "v5k" },
  { stem: "ぐ", a: "が", i: "ぎ", e: "げ", o: "ご", te: "いで", ta: "いだ", pos: "v5g" },
  { stem: "す", a: "さ", i: "し", e: "せ", o: "そ", te: "して", ta: "した", pos: "v5s" },
  { stem: "つ", a: "た", i: "ち", e: "て", o: "と", te: "って", ta: "った", pos: "v5t" },
  { stem: "ぬ", a: "な", i: "に", e: "ね", o: "の", te: "んで", ta: "んだ", pos: "v5n" },
  { stem: "ぶ", a: "ば", i: "び", e: "べ", o: "ぼ", te: "んで", ta: "んだ", pos: "v5b" },
  { stem: "む", a: "ま", i: "み", e: "め", o: "も", te: "んで", ta: "んだ", pos: "v5m" },
  { stem: "る", a: "ら", i: "り", e: "れ", o: "ろ", te: "って", ta: "った", pos: "v5r" },
];

for (const [suffix, reason] of polite) {
  add(suffix, "る", "v1", reason);
  for (const v of godan) add(v.i + suffix, v.stem, v.pos, reason);
  add("し" + suffix, "する", "vs", reason);
  add("来" + suffix, "来る", "vk", reason);
  add("き" + suffix, "くる", "vk", reason);
}
for (const [suffix, reason] of [["ない", "negatif"], ["なかった", "negatif, lampau"], ["なくて", "negatif, bentuk te"]] as const) {
  add(suffix, "る", "v1", reason, ["surface", "adj-i"]);
  for (const v of godan) add(v.a + suffix, v.stem, v.pos, reason, ["surface", "adj-i"]);
  add("し" + suffix, "する", "vs", reason, ["surface", "adj-i"]);
  add("来" + suffix, "来る", "vk", reason, ["surface", "adj-i"]);
  add("こ" + suffix, "くる", "vk", reason, ["surface", "adj-i"]);
}
for (const [suffix, reason] of [["た", "lampau"], ["て", "bentuk te"]] as const) {
  add(suffix, "る", "v1", reason);
  for (const v of godan) add(suffix === "た" ? v.ta : v.te, v.stem, v.pos, reason);
  add("し" + suffix, "する", "vs", reason);
  add("来" + suffix, "来る", "vk", reason);
  add("き" + suffix, "くる", "vk", reason);
  add("行っ" + suffix, "行く", "v5k", reason);
  add("いっ" + suffix, "いく", "v5k", reason);
  add("往っ" + suffix, "往く", "v5k", reason);
  add("ゆっ" + suffix, "ゆく", "v5k", reason);
}
// Progressive forms become a te surface, then pass through the te rules.
add("ている", "て", "surface", "progresif", ["surface", "v1"]);
add("でいる", "で", "surface", "progresif", ["surface", "v1"]);
for (const [suffix, reason] of [["られる", "pasif / potensial"], ["させる", "kausatif"]] as const) {
  add(suffix, "る", "v1", reason, ["surface", "v1"]);
  add("来" + suffix, "来る", "vk", reason, ["surface", "v1"]);
  add("こ" + suffix, "くる", "vk", reason, ["surface", "v1"]);
}
for (const v of godan) {
  add(v.a + "れる", v.stem, v.pos, "pasif", ["surface", "v1"]);
  add(v.e + "る", v.stem, v.pos, "potensial", ["surface", "v1"]);
  add(v.a + "せる", v.stem, v.pos, "kausatif", ["surface", "v1"]);
  add(v.e + "ば", v.stem, v.pos, "kondisional");
  add(v.o + "う", v.stem, v.pos, "ajakan");
}
add("される", "する", "vs", "pasif", ["surface", "v1"]);
add("させる", "する", "vs", "kausatif", ["surface", "v1"]);
add("できる", "する", "vs", "potensial", ["surface", "v1"]);
add("する", "", "vs", "verba する", ["surface", "vs"]);
add("れば", "る", "v1", "kondisional");
for (const [suffix, reason] of [["かった", "lampau"], ["くない", "negatif"], ["くなかった", "negatif, lampau"],
  ["くて", "bentuk te"], ["ければ", "kondisional"]] as const) {
  add(suffix, "い", "adj-i", reason, ["surface", "adj-i"]);
  // いい uses the よい stem. Dictionary lookup decides which lemmas exist.
  add("よ" + suffix, "いい", "adj-i", reason, ["surface", "adj-i"]);
}

export function candidateMatchesPos(candidate: DictionaryCandidate, pos: string[]) {
  if (candidate.form === "surface") return candidate.reasons.length === 0;
  return pos.some((tag) => tag === candidate.form ||
    (candidate.form === "v1" && tag === "v1-s") ||
    (candidate.form === "adj-i" && tag === "adj-ix") ||
    (candidate.form === "vs" && ["vs-i", "vs-s"].includes(tag)) ||
    (candidate.form === "v5k" && tag === "v5k-s") ||
    (candidate.form === "v5r" && tag === "v5r-i"));
}

export function kanaAlternative(term: string) {
  return term.replace(/[ァ-ヶ]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60));
}

export function dictionaryCandidates(query: string): DictionaryCandidate[] {
  const queue: DictionaryCandidate[] = [{ term: query, form: "surface", reasons: [], kana: false }];
  const alternate = kanaAlternative(query);
  if (alternate !== query) queue.push({ term: alternate, form: "surface", reasons: [], kana: true });
  const katakana = query.replace(/[ぁ-ゖ]/g, (char) => String.fromCharCode(char.charCodeAt(0) + 0x60));
  if (katakana !== query && katakana !== alternate) queue.push({ term: katakana, form: "surface", reasons: [], kana: true });
  const seen = new Set(queue.map((c) => `${c.term}:${c.form}`));
  for (let index = 0; index < queue.length && queue.length < DICTIONARY_LIMITS.candidates; index++) {
    const current = queue[index];
    if (current.reasons.length >= DICTIONARY_LIMITS.deinflectionDepth) continue;
    for (const rule of rules) {
      if (!rule.input.includes(current.form) || !current.term.endsWith(rule.suffix)) continue;
      const term = current.term.slice(0, -rule.suffix.length) + rule.replacement;
      const key = `${term}:${rule.output}`;
      if (!term || term === current.term || [...term].length > DICTIONARY_LIMITS.queryCodePoints || seen.has(key)) continue;
      seen.add(key);
      queue.push({ term, form: rule.output, reasons: [...current.reasons, rule.reason], kana: current.kana });
      if (queue.length === DICTIONARY_LIMITS.candidates) break;
    }
  }
  return queue;
}
