// Ekstraksi daftar kata flashcard dari file Anki (.apkg) ke fixture
// src/flashcard-data/vocab/<level>.json.
//
//   npm run flashcard:extract                       # data/anki/exported_anki.apkg
//   npm run flashcard:extract -- --file deck.apkg
//   npm run flashcard:extract -- --dry-run          # laporan saja, tanpa menulis
//
// Aman dijalankan ulang: isi kartu yang sudah digenerate AI (`content` + `ai`)
// dipertahankan untuk kata yang sama. Kata dicocokkan lewat key-nya, lalu lewat
// guid note Anki sumbernya bila key berubah (mis. normalisasi bacaan membaik),
// dan dalam kasus itu key LAMA yang dipakai: key adalah identitas yang
// dirujuk progres belajar user, jadi tidak boleh berganti.
//
// Script ini tidak menyentuh database.

import path from "node:path";
import { mergeVocabulary, readApkgVocabulary } from "./flashcard-anki.mjs";
import { LEVELS, readVocabFile, VOCAB_DIR, writeVocabFile } from "./flashcard-vocab.mjs";

const DEFAULT_FILE = "data/anki/exported_anki.apkg";

function log(message) {
  console.log(`[flashcard:extract] ${message}`);
}

function parseArguments(argv) {
  const options = { file: DEFAULT_FILE, dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--dry-run") {
      options.dryRun = true;
    } else if (argument === "--file" || argument.startsWith("--file=")) {
      const value = argument.includes("=") ? argument.slice("--file=".length) : argv[++index];
      if (!value) throw new Error("--file membutuhkan path file .apkg");
      options.file = value;
    } else {
      throw new Error(`argumen tidak dikenal: ${argument}`);
    }
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));

  log(`membaca ${options.file}`);
  const { collectionName, vocabulary, skipped } = await readApkgVocabulary(options.file);
  log(`${collectionName}: ${vocabulary.length} note kosakata, ${skipped.length} dilewati`);
  for (const item of skipped.slice(0, 10)) {
    log(`  SKIP ${item.guid} "${item.word}" - ${item.reason}`);
  }

  const entries = mergeVocabulary(vocabulary);

  // --- Pertahankan hasil generate yang sudah ada ------------------------------
  const existing = new Map();
  const keyByGuid = new Map();
  for (const level of LEVELS) {
    for (const note of (await readVocabFile(level)).notes) {
      existing.set(note.key, note);
      for (const guid of note.sourceGuids) keyByGuid.set(guid, note.key);
    }
  }

  const claimed = new Set(entries.map((entry) => entry.key));
  const used = new Set();
  let carried = 0;
  let rekeyed = 0;

  for (const entry of entries) {
    let prior = existing.get(entry.key);
    if (!prior) {
      const oldKey = entry.sourceGuids.map((guid) => keyByGuid.get(guid)).find((key) => key);
      // Key lama hanya dipakai ulang bila tidak sedang dipakai entri lain.
      if (oldKey && !claimed.has(oldKey) && !used.has(oldKey)) {
        prior = existing.get(oldKey);
        log(`  KEY ${entry.key} -> tetap ${oldKey}`);
        entry.key = oldKey;
        rekeyed += 1;
      }
    }
    if (prior && !used.has(prior.key)) {
      used.add(prior.key);
      entry.content = prior.content;
      entry.ai = prior.ai;
      if (prior.content) carried += 1;
    } else {
      entry.content = null;
      entry.ai = null;
    }
  }

  const dropped = [...existing.values()].filter((note) => !used.has(note.key));
  const droppedGenerated = dropped.filter((note) => note.content);

  // --- Tulis per level --------------------------------------------------------
  let multiLevel = 0;
  let uncertain = 0;
  let homographs = 0;

  for (const level of LEVELS) {
    const notes = entries
      .filter((entry) => entry.level === level)
      .sort((left, right) => left.position - right.position || left.key.localeCompare(right.key))
      .map((entry, index) => {
        if (entry.sourceLevels.length > 1) multiLevel += 1;
        if (entry.readingUncertain) uncertain += 1;
        if (entry.homographs.length > 0) homographs += 1;
        return {
          key: entry.key,
          order: index + 1,
          word: entry.word,
          reading: entry.reading,
          readingUncertain: entry.readingUncertain,
          hints: entry.hints,
          homographs: entry.homographs,
          sourceLevels: entry.sourceLevels,
          sourceGuids: entry.sourceGuids,
          content: entry.content,
          ai: entry.ai,
        };
      });

    const generated = notes.filter((note) => note.content).length;
    log(`${level}: ${notes.length} kata (${generated} sudah digenerate)`);
    if (!options.dryRun) await writeVocabFile({ level, notes });
  }

  log(
    `${vocabulary.length} note -> ${entries.length} kata unik; ` +
      `${multiLevel} kata muncul di >1 level (masuk ke level termudah), ` +
      `${homographs} homograf, ${uncertain} bacaan sumber tidak pasti`,
  );
  log(`hasil generate dipertahankan: ${carried}, key dipertahankan lewat guid: ${rekeyed}`);
  if (droppedGenerated.length > 0) {
    log(
      `PERINGATAN: ${droppedGenerated.length} kata yang sudah digenerate tidak ada lagi di sumber ` +
        `dan dibuang dari fixture: ${droppedGenerated.slice(0, 8).map((note) => note.key).join(", ")}`,
    );
  }
  log(options.dryRun ? "dry-run: tidak ada file yang ditulis" : `fixture ditulis ke ${path.relative(process.cwd(), VOCAB_DIR)}`);
}

main().catch((error) => {
  console.error("[flashcard:extract] gagal", error);
  process.exitCode = 1;
});
