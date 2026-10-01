// Membaca daftar kata dari file Anki (.apkg).
//
// Dari .apkg hanya diambil DAFTAR KATA: tulisan kata, bacaannya, level JLPT,
// dan urutannya di deck. Arti, contoh kalimat, dan audio sengaja dibuang —
// isinya ditulis ulang oleh generator AI (prisma/generate-flashcard-vocab.mjs).
// Glos bahasa Inggris dari sumber hanya diteruskan sebagai petunjuk makna mana
// yang dimaksud, tidak pernah disalin ke kartu.
//
// Format .apkg modern: zip berisi `collection.anki21b` (SQLite terkompresi
// zstd). `collection.anki2` di dalamnya hanya stub "please update Anki", jadi
// dipakai hanya bila tidak ada versi yang lebih baru.

import fs from "node:fs/promises";
import { unzipSync } from "fflate";
import { decompress } from "fzstd";
import initSqlJs from "sql.js";
import { LEVELS } from "./flashcard-vocab.mjs";
import { toHiragana } from "./japanese-markup-check.mjs";

const COLLECTION_FILES = ["collection.anki21b", "collection.anki21", "collection.anki2"];
const FIELD_NAMES = {
  word: /^word$/i,
  furigana: /^word\s*furigana$/i,
  english: /^word\s*(eng|english|meaning)$/i,
};

// ---------------------------------------------------------------------------
// Normalisasi (fungsi murni, diuji di src/features/flashcard/lib/pipeline.test.ts)
// ---------------------------------------------------------------------------

const ENTITIES = { nbsp: " ", ensp: " ", emsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

/** @param {string} text */
export function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
    if (entity.startsWith("#x") || entity.startsWith("#X")) {
      return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
    }
    if (entity.startsWith("#")) return String.fromCodePoint(Number(entity.slice(1)));
    return ENTITIES[entity.toLowerCase()] ?? match;
  });
}

/**
 * HTML field Anki -> teks polos. `<br>` dan penutup blok menjadi baris baru,
 * karena di dalam kurung furigana baris baru memisahkan bacaan alternatif
 * (`人気[じんき<br>にんき]`). Isi `<rt>` dibuang supaya furigana HTML tidak ikut
 * menjadi bagian kata.
 *
 * @param {string} html
 */
export function cleanHtml(html) {
  return decodeEntities(
    html
      .replace(/<rt[^>]*>[\s\S]*?<\/rt>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(div|p|li)>/gi, "\n")
      .replace(/<[^>]*>/g, ""),
  );
}

// Penanda kelas kata di ujung tulisan kata: 迷惑(する), 次々(と), 綺麗(な).
const TRAILING_WORD_ANNOTATION = /[（(＜<](する|な|の|と|に)[）)＞>]$/;

/**
 * Tulisan kata dari field Anki. Isi kurung siku dibuang: `[1]` (nomor makna),
 * `[×なに]` (bacaan yang BUKAN dimaksud — disimpan sebagai petunjuk), dan
 * bacaan yang terselip seperti `肉親[にくしん]`.
 *
 * @param {string} raw
 */
export function parseAnkiWord(raw) {
  const text = cleanHtml(raw);
  const excludedReadings = [...text.matchAll(/\[×([^\]]+)\]/g)].map((match) => match[1].trim());

  let word = text.replace(/\[[^\]]*\]/g, "").replace(/[\s　]+/g, "").trim();
  const annotations = [];
  const trailing = word.match(TRAILING_WORD_ANNOTATION);
  if (trailing && trailing.index > 0) {
    annotations.push(trailing[0]);
    word = word.slice(0, trailing.index);
  }

  return { word, excludedReadings, annotations };
}

/** Tulisan kata saja (lihat parseAnkiWord). */
export function normalizeWord(raw) {
  return parseAnkiWord(raw).word;
}

const ANNOTATION = /[（(＜][^（()）＜＞]*[）)＞]/g;
// `々` sesudah kurung ikut ditangkap: 中[なか]々 berarti bacaannya diulang.
const FURIGANA_TOKEN = / ?([^ \n>[\]]+?)\[([^\]]+)\](々?)/g;
// Kana yang tertelan di depan kanji dasar furigana (が軽 -> が + かる). Angka dan
// huruf Latin tidak termasuk: furigana `10[じゅう]` memang bacaan angka itu.
const SWALLOWED_KANA = /^[぀-ヿ]+(?=[一-鿿々〆])/;
const KANA_ONLY = /^[぀-ゟ゠-ヿ]+$/;
const READING_PUNCTUATION = /[〜～~・、]/;

const KANJI_OR_MARK = /[一-鿿々〆]/;

/**
 * Sebagian note menulis furigana untuk seluruh dasarnya, termasuk kana di depan
 * kanji: お茶[おちゃ], パン屋[ぱんや], ヶ月[かげつ]. Kana itu sudah ada di
 * furigana, jadi tidak boleh ditambahkan lagi (おおちゃ).
 */
function furiganaCoversPrefix(furigana, prefix) {
  const reading = toHiragana(furigana);
  if (reading.startsWith(toHiragana(prefix))) return true;
  // ヶ/ヵ penghitung dibaca か, が, atau こ.
  return /^[ヶヵケ]/.test(prefix) && /^[かがこ]/.test(reading);
}

/**
 * Bacaan yang wajar hanya berisi kana, tanda baca bacaan, atau karakter non-kanji
 * yang memang ada di tulisan katanya (angka, huruf Latin). Kanji atau 々 yang
 * tersisa berarti furigana sumber tidak menutup seluruh kata.
 */
function isPlausibleReading(reading, word) {
  return [...reading].every(
    (char) =>
      KANA_ONLY.test(char) ||
      READING_PUNCTUATION.test(char) ||
      (!KANJI_OR_MARK.test(char) && word.includes(char)),
  );
}

/**
 * Bacaan dari field furigana format Anki (`考[かんが]える`, spasi sebagai
 * pemisah dasar furigana).
 *
 * Mengembalikan bacaan utama plus bacaan alternatif, anotasi seperti `(する)`,
 * dan tanda `uncertain` bila bacaannya tidak bisa dipercaya untuk dibandingkan
 * dengan furigana buatan AI (mis. kanji yang tidak tertutup furigana).
 *
 * @param {string} raw
 * @param {string} word hasil normalizeWord
 */
export function parseAnkiReading(raw, word) {
  let text = cleanHtml(raw).replace(/\[\d+\]/g, "");

  const annotations = [];
  text = text.replace(ANNOTATION, (match) => {
    annotations.push(match.trim());
    return "";
  });

  // Tulisan yang ditutup furigana sumber, untuk dicocokkan dengan kata.
  let baseText = text.replace(FURIGANA_TOKEN, "$1$3").replace(/[\s　]+/g, "");

  const alternatives = [];
  // Regex yang sama dengan filter furigana Anki: dasar furigana adalah deretan
  // karakter non-spasi tepat sebelum `[`. Karena itu `口[くち]が軽[かる]い`
  // menelan が ke dasar furigana kedua; kana di depan kanji pertama dikembalikan
  // supaya bacaannya tetap くちがかるい.
  text = text.replace(FURIGANA_TOKEN, (_, base, reading, repeat) => {
    const options = reading
      .split(/[\n,、，/／・]/)
      .map((option) => option.trim())
      .filter(Boolean);
    alternatives.push(...options.slice(1));
    const primary = options[0];
    if (!primary) return base + repeat;
    const prefix = base.match(SWALLOWED_KANA)?.[0] ?? "";
    const kept = prefix && furiganaCoversPrefix(primary, prefix) ? "" : prefix;
    return kept + primary + (repeat ? primary : "");
  });

  let reading = text.replace(/[\s　]+/g, "");
  if (!reading) {
    reading = word;
    baseText = word;
  }

  // Variasi bila kana awalnya di luar dasar furigana: あっという 間[あっというま].
  const leadingKana = word.match(SWALLOWED_KANA)?.[0];
  if (leadingKana && toHiragana(reading).startsWith(toHiragana(leadingKana).repeat(2))) {
    reading = reading.slice(leadingKana.length);
  }

  // Sumber kerap menempelkan penanda kelas kata di luar kurung: 駄目[だめ]な,
  // 入学[にゅうがく]する. Kana tambahan itu dibuang dari bacaan. Kebalikannya,
  // 不満[ふまん] untuk kata 不満な kehilangan な di bacaannya.
  if (baseText !== word && baseText.startsWith(word)) {
    const extra = baseText.slice(word.length);
    if (KANA_ONLY.test(extra) && reading.endsWith(extra)) {
      reading = reading.slice(0, -extra.length);
      baseText = word;
    }
  } else if (baseText !== word && word.startsWith(baseText)) {
    const missing = word.slice(baseText.length);
    if (KANA_ONLY.test(missing)) {
      reading += missing;
      baseText = word;
    }
  }

  // Bacaan majemuk seperti `くにん・きゅうにん` untuk kata tunggal 九人.
  const separators = /[・/／]/;
  if (separators.test(reading) && !separators.test(word)) {
    const parts = reading.split(/[・/／]/).filter(Boolean);
    reading = parts[0] ?? reading;
    alternatives.push(...parts.slice(1));
  }

  const uncertain =
    alternatives.length > 0 ||
    baseText !== word ||
    !isPlausibleReading(reading, word) ||
    /[0-9０-９]/.test(word);

  return { reading, alternatives: [...new Set(alternatives)], annotations, uncertain };
}

/** Glos bahasa Inggris sumber (bagian sebelum `<br><br>`), hanya untuk petunjuk. */
export function englishHint(raw) {
  const english = raw.split(/<br\s*\/?>\s*<br\s*\/?>/i)[0] ?? "";
  const text = cleanHtml(english).replace(/\s+/g, " ").trim();
  return text.length > 160 ? `${text.slice(0, 157)}...` : text;
}

/** Level dari nama deck/note type; segmen paling akhir yang menang. */
export function detectLevel(...names) {
  for (const name of names) {
    const matches = [...(name ?? "").matchAll(/N([1-5])(?![0-9])/g)];
    const last = matches.at(-1);
    if (last) return `N${last[1]}`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Membaca .apkg
// ---------------------------------------------------------------------------

function all(db, sql, params = []) {
  const statement = db.prepare(sql);
  try {
    statement.bind(params);
    const rows = [];
    while (statement.step()) rows.push(statement.getAsObject());
    return rows;
  } finally {
    statement.free();
  }
}

function hasTable(db, name) {
  return all(db, "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?", [name]).length > 0;
}

// Skema Anki 2.1.28+ menyimpan note type dan deck di tabel sendiri; versi lama
// menyimpannya sebagai JSON di `col`. Keduanya didukung supaya export Anki
// versi berapa pun bisa dipakai.
function readNotetypes(db) {
  const fieldsByNotetype = new Map();
  const names = new Map();

  if (hasTable(db, "notetypes") && hasTable(db, "fields")) {
    for (const row of all(db, "SELECT id, name FROM notetypes")) names.set(String(row.id), row.name);
    for (const row of all(db, "SELECT ntid, ord, name FROM fields")) {
      const key = String(row.ntid);
      if (!fieldsByNotetype.has(key)) fieldsByNotetype.set(key, []);
      fieldsByNotetype.get(key)[row.ord] = row.name;
    }
    return { fieldsByNotetype, names };
  }

  const [col] = all(db, "SELECT models FROM col");
  for (const [id, model] of Object.entries(JSON.parse(col.models))) {
    names.set(id, model.name);
    fieldsByNotetype.set(
      id,
      [...model.flds].sort((left, right) => left.ord - right.ord).map((field) => field.name),
    );
  }
  return { fieldsByNotetype, names };
}

function readDecks(db) {
  if (hasTable(db, "decks")) {
    return new Map(all(db, "SELECT id, name FROM decks").map((row) => [String(row.id), row.name]));
  }
  const [col] = all(db, "SELECT decks FROM col");
  return new Map(Object.entries(JSON.parse(col.decks)).map(([id, deck]) => [id, deck.name]));
}

function fieldIndexes(fieldNames, notetypeName) {
  const indexOf = (pattern) => fieldNames.findIndex((name) => pattern.test(name ?? ""));
  const indexes = {
    word: indexOf(FIELD_NAMES.word),
    furigana: indexOf(FIELD_NAMES.furigana),
    english: indexOf(FIELD_NAMES.english),
  };
  if (indexes.word === -1 || indexes.furigana === -1) {
    throw new Error(
      `note type "${notetypeName}" tidak punya field word/wordFurigana ` +
        `(field yang ada: ${fieldNames.join(", ")})`,
    );
  }
  return indexes;
}

/**
 * Semua note kosakata di .apkg, sudah dinormalisasi. Note tanpa level atau
 * tanpa kata dilaporkan di `skipped`, bukan dibuang diam-diam.
 *
 * @param {string} file
 */
export async function readApkgVocabulary(file) {
  const buffer = await fs.readFile(file);
  const entries = unzipSync(new Uint8Array(buffer), {
    filter: (entry) => COLLECTION_FILES.includes(entry.name),
  });
  const collectionName = COLLECTION_FILES.find((name) => entries[name]);
  if (!collectionName) {
    throw new Error(`${file} bukan .apkg yang dikenali (tidak ada ${COLLECTION_FILES.join("/")})`);
  }

  const bytes = collectionName.endsWith("21b")
    ? decompress(entries[collectionName])
    : entries[collectionName];

  const SQL = await initSqlJs();
  const db = new SQL.Database(bytes);

  try {
    const { fieldsByNotetype, names } = readNotetypes(db);
    const decks = readDecks(db);

    // Posisi kartu baru (`due` pada kartu bertipe 0) adalah urutan belajar di
    // deck sumber — itulah yang dipakai sebagai urutan kata per level.
    const cardByNote = new Map();
    for (const card of all(db, "SELECT nid, did, due, type FROM cards")) {
      const key = String(card.nid);
      const current = cardByNote.get(key);
      if (!current || card.due < current.due) {
        cardByNote.set(key, { deckId: String(card.did), due: Number(card.due) });
      }
    }

    const indexesByNotetype = new Map();
    const vocabulary = [];
    const skipped = [];

    for (const note of all(db, "SELECT id, guid, mid, flds FROM notes")) {
      const notetypeId = String(note.mid);
      const notetypeName = names.get(notetypeId) ?? notetypeId;
      if (!indexesByNotetype.has(notetypeId)) {
        indexesByNotetype.set(
          notetypeId,
          fieldIndexes(fieldsByNotetype.get(notetypeId) ?? [], notetypeName),
        );
      }
      const indexes = indexesByNotetype.get(notetypeId);
      const fields = String(note.flds).split("\x1f");
      const card = cardByNote.get(String(note.id));
      const level = detectLevel(card ? decks.get(card.deckId) : null, notetypeName);

      const { word, excludedReadings, annotations } = parseAnkiWord(fields[indexes.word] ?? "");
      if (!word || !level || !LEVELS.includes(level)) {
        skipped.push({ guid: String(note.guid), word, reason: !word ? "kata kosong" : "level tidak dikenali" });
        continue;
      }

      const parsed = parseAnkiReading(fields[indexes.furigana] ?? "", word);
      vocabulary.push({
        guid: String(note.guid),
        level,
        position: card?.due ?? Number.MAX_SAFE_INTEGER,
        word,
        ...parsed,
        annotations: [...annotations, ...parsed.annotations],
        excludedReadings,
        english: indexes.english === -1 ? "" : englishHint(fields[indexes.english] ?? ""),
      });
    }

    return { collectionName, vocabulary, skipped };
  } finally {
    db.close();
  }
}

// ---------------------------------------------------------------------------
// Penggabungan
// ---------------------------------------------------------------------------

const MAX_HINTS = 6;

/**
 * Satu entri per pasangan (kata, bacaan). Kata yang muncul di beberapa level
 * masuk ke level termudah; bacaan alternatif ikut ke entri yang bacaan utamanya
 * cocok, sehingga 人気[じんき・にんき・ひとけ] menyatu dengan 人気[にんき].
 */
export function mergeVocabulary(vocabulary) {
  const cleanReadings = new Map();
  for (const item of vocabulary) {
    if (item.uncertain) continue;
    if (!cleanReadings.has(item.word)) cleanReadings.set(item.word, new Set());
    cleanReadings.get(item.word).add(item.reading);
  }

  const groups = new Map();
  for (const item of vocabulary) {
    let reading = item.reading;
    const known = cleanReadings.get(item.word);
    if (item.uncertain && known) {
      // Bacaan sumber yang cacat (`べつ々`, `×くぐる`, hanya sebagian kata)
      // menumpang ke bacaan bersih kata yang sama. Bila kata itu punya lebih
      // dari satu bacaan bersih (homograf sungguhan), hanya kecocokan langsung
      // yang dipakai.
      const candidates = [item.reading, ...item.alternatives, item.reading.replace(/[^぀-ヿ]/g, "")];
      reading =
        candidates.find((option) => known.has(option)) ??
        (known.size === 1 ? [...known][0] : item.reading);
    }
    const key = `${item.word}|${reading}`;
    if (!groups.has(key)) groups.set(key, { key, word: item.word, reading, items: [] });
    groups.get(key).items.push(item);
  }

  const levelRank = (level) => LEVELS.indexOf(level);
  const entries = [...groups.values()].map((group) => {
    const levels = [...new Set(group.items.map((item) => item.level))].sort(
      (left, right) => levelRank(left) - levelRank(right),
    );
    const level = levels[0];
    const position = Math.min(
      ...group.items.filter((item) => item.level === level).map((item) => item.position),
    );

    const hints = [];
    const pushHint = (value) => {
      if (value && !hints.some((hint) => hint.toLowerCase() === value.toLowerCase())) hints.push(value);
    };
    for (const item of group.items) pushHint(item.english);
    const annotations = [...new Set(group.items.flatMap((item) => item.annotations))];
    if (annotations.length > 0) pushHint(`anotasi sumber: ${annotations.join(" ")}`);
    // Hanya alternatif eksplisit dari sumber. Bacaan cacat yang sudah
    // dilebur ke bacaan bersih tidak diteruskan — itu hanya akan menyesatkan AI.
    const otherReadings = [
      ...new Set(
        group.items
          .flatMap((item) => item.alternatives)
          .filter((option) => option !== group.reading && isPlausibleReading(option, group.word)),
      ),
    ];
    if (otherReadings.length > 0) pushHint(`bacaan lain di sumber: ${otherReadings.join(", ")}`);
    const excluded = [...new Set(group.items.flatMap((item) => item.excludedReadings ?? []))];
    if (excluded.length > 0) pushHint(`sumber menegaskan BUKAN dibaca: ${excluded.join(", ")}`);

    return {
      key: group.key,
      level,
      position,
      word: group.word,
      reading: group.reading,
      // Cukup satu note sumber yang bacaannya bersih untuk mempercayai bacaan.
      readingUncertain: group.items.every(
        (item) => item.uncertain || item.reading !== group.reading,
      ),
      hints: hints.slice(0, MAX_HINTS),
      sourceLevels: levels,
      sourceGuids: [...new Set(group.items.map((item) => item.guid))],
      /** @type {string[]} diisi setelah semua entri terbentuk */
      homographs: [],
    };
  });

  // Homograf: tulisan sama, bacaan berbeda. AI wajib menyebut bacaan lainnya di
  // catatan, karena sisi depan kartu hanya menampilkan tulisan tanpa furigana.
  const readingsByWord = new Map();
  for (const entry of entries) {
    if (!readingsByWord.has(entry.word)) readingsByWord.set(entry.word, []);
    readingsByWord.get(entry.word).push(entry.reading);
  }
  for (const entry of entries) {
    entry.homographs = readingsByWord.get(entry.word).filter((reading) => reading !== entry.reading);
  }

  return entries;
}
