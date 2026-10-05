// Report on question-links fixtures without calling a model: coverage, forms
// missing from the catalog, links worth a manual check, and frequent
// tested × distractor pairs (input for comparisons.json).

import { readAllPointFiles } from "./bunpou-data.mjs";
import {
  buildCatalogIndex,
  derivedKeys,
  explanationOf,
  linkFileProblems,
  linkedQuestionsOf,
  normalizeForm,
  questionId,
  questionSurfaceText,
  readAllLinkFiles,
} from "./bunpou-links.mjs";
import { readingFromMarkup } from "./japanese-markup-check.mjs";
import { loadAndValidateSeedFiles } from "./test-package-fixture.mjs";

const TOP = 30;
// Konjugasi dan materi dasar jarang tertulis literal di soal (使役形, い形容詞の変化).
const SURFACE_CHECK_KINDS = new Set(["pattern", "particle"]);

// Bentuk kamus jarang tertulis utuh di soal (〜られる → 作られました), jadi
// bentuk tanpa kana terakhir juga diterima.
function appearsIn(text, form) {
  return text.includes(form) || (form.length >= 3 && text.includes(form.slice(0, -1)));
}

function bump(map, key, extra) {
  const entry = map.get(key) ?? { count: 0, examples: [] };
  entry.count += 1;
  if (extra && entry.examples.length < 3) entry.examples.push(extra);
  map.set(key, entry);
}

function top(map) {
  return [...map].sort((left, right) => right[1].count - left[1].count).slice(0, TOP);
}

async function main() {
  const index = buildCatalogIndex(await readAllPointFiles());
  const linkFiles = await readAllLinkFiles();
  const { seedFiles } = await loadAndValidateSeedFiles(null);
  const packages = new Map(seedFiles.map(({ file, pkg }) => [file.slice(0, -".json".length), pkg]));

  const perLevel = new Map();
  const missingForms = new Map();
  const rejected = new Map();
  const pairs = new Map();
  const checks = [];
  let invalid = 0;

  for (const [name, file] of linkFiles) {
    const pkg = packages.get(name);
    if (!pkg) {
      console.log(`! ${name}: fixture paket tidak ditemukan`);
      invalid += 1;
      continue;
    }
    for (const problem of linkFileProblems(file, pkg, index)) {
      console.log(`! ${name}: ${problem}`);
      invalid += 1;
    }

    const level = pkg.jlptLevel;
    const stats = perLevel.get(level) ?? { total: 0, recorded: 0, linked: 0, low: 0 };
    stats.total += linkedQuestionsOf(pkg).length;
    const questions = new Map(linkedQuestionsOf(pkg).map((entry) => [entry.id, entry.question]));

    for (const record of file.questions) {
      const id = questionId(record.mondaiType, record.order);
      const label = `${name} ${id}`;
      const question = questions.get(id);
      stats.recorded += 1;
      if (record.confidence !== null) stats.linked += 1;
      if (record.confidence === "low") {
        stats.low += 1;
        checks.push(`${label}: confidence low — ${record.note ?? "(tanpa note)"}`);
      }

      for (const pattern of record.patterns) {
        const form = normalizeForm(pattern.form);
        if (pattern.candidates.length === 0) bump(missingForms, form, `${pattern.form} "${pattern.meaning}" (${label})`);
        else if (!pattern.key) bump(rejected, form, `${pattern.form} "${pattern.meaning}" (${label})`);
      }

      const { tested, distractor } = derivedKeys(record);
      for (const left of tested) for (const right of distractor) bump(pairs, `${left} × ${right}`, label);
      if (!question) continue;

      const surface = questionSurfaceText(pkg, question);
      const haystacks = [normalizeForm(surface), normalizeForm(readingFromMarkup(surface))];
      for (const key of tested) {
        const point = index.points.get(key);
        if (!point || !SURFACE_CHECK_KINDS.has(point.kind)) continue;
        const appears = [...point.forms].some((form) => haystacks.some((text) => appearsIn(text, form)));
        if (!appears) checks.push(`${label}: tested ${key} (${point.title}) tidak tampak di soal/pilihan/bacaan`);
      }

      const linkedForms = new Set(
        [...tested, ...distractor].flatMap((key) => [...(index.points.get(key)?.forms ?? [])]),
      );
      for (const keyPoint of explanationOf(question)?.keyPoints ?? []) {
        const form = normalizeForm(keyPoint);
        if (!form || linkedForms.has(form)) continue;
        const matches = [...index.points.values()].filter((point) => point.forms.has(form));
        if (matches.length > 0) {
          checks.push(
            `${label}: keyPoint "${keyPoint}" cocok dengan ${matches.map((point) => point.key).join(", ")} tetapi tidak tertaut`,
          );
        }
      }
    }
    perLevel.set(level, stats);
  }

  console.log("\n== Ringkasan per level ==");
  for (const [level, stats] of [...perLevel].sort()) {
    console.log(
      `${level}: ${stats.recorded}/${stats.total} soal tercatat, ${stats.linked} bertautan, ${stats.low} low`,
    );
  }

  console.log(`\n== Bentuk belum di katalog (top ${TOP}) ==`);
  for (const [form, entry] of top(missingForms)) console.log(`${entry.count}× ${form}: ${entry.examples.join("; ")}`);

  console.log(`\n== Kandidat ada, semua ditolak model (top ${TOP}) ==`);
  for (const [form, entry] of top(rejected)) console.log(`${entry.count}× ${form}: ${entry.examples.join("; ")}`);

  console.log(`\n== Perlu dicek (${checks.length}) ==`);
  for (const line of checks) console.log(line);

  console.log(`\n== Pasangan tested × distractor (top ${TOP}) ==`);
  for (const [pair, entry] of top(pairs)) console.log(`${entry.count}× ${pair}`);

  if (invalid > 0) {
    console.log(`\n${invalid} pelanggaran kontrak`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("[bunpou:links-report] gagal", error);
  process.exitCode = 1;
});
