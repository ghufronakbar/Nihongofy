// Prompt generator isi kartu kosakata. Dipisah dari script-nya supaya isi
// prompt bisa dibaca dan diubah tanpa menyentuh logika antrian, retry, dan
// penulisan file — dan supaya `promptVersion` di database merujuk ke satu
// berkas yang jelas. Naikkan PROMPT_VERSION setiap kali isi prompt berubah.
//
// Keluaran diminta sebagai JSON lewat teks prompt, BUKAN lewat
// `response_format: json_schema`: gateway project ini pernah mengabaikan
// json_schema diam-diam (lihat catatan di explanation-prompt.mjs). JSON di
// dalam teks tetap bisa di-parse apa pun yang terjadi.
//
// Daftar tag dibangun dari src/flashcard-data/taxonomy.json, sumber yang sama
// dengan validatornya, sehingga prompt tidak mungkin menawarkan tag yang akan
// ditolak.

import { z } from "zod";
import { aiTagGroups } from "./flashcard-vocab.mjs";

export const PROMPT_VERSION = "flashcard-vocab-v3";

function tagSection(taxonomy) {
  return aiTagGroups(taxonomy)
    .map(({ dimension, tags }) => {
      const lines = tags.map((tag) => `- ${tag.slug} — ${tag.label}: ${tag.description}`);
      return `[${dimension.id}] ${dimension.label}. ${dimension.rule}\n${lines.join("\n")}`;
    })
    .join("\n\n");
}

export function buildSystemPrompt(taxonomy) {
  return `Anda penyusun kartu flashcard kosakata JLPT untuk pelajar Indonesia. Untuk setiap kata yang diberikan, tulis isi kartu yang akurat, natural, dan sesuai level JLPT kata itu.

MASUKAN
Setiap kata berisi:
- key: pengenal kata. Salin persis ke keluaran.
- word: tulisan kata. JANGAN diubah sedikit pun, termasuk tanda seperti 〜, ・, /, atau kurung.
- reading: bacaan dari daftar sumber.
- readingUncertain: bila true, bacaan sumber mungkin tidak lengkap atau keliru; tentukan bacaan yang benar sendiri.
- hints: petunjuk dari daftar sumber (glos bahasa Inggris, anotasi, bacaan yang dikecualikan). Pakai hanya untuk memahami makna mana yang dimaksud. Glos sumber sering kurang tepat; JANGAN disalin mentah-mentah.
- homographs: bacaan lain untuk tulisan yang sama, yang di daftar menjadi kata terpisah.

ATURAN TEKS JEPANG (wajib, tidak boleh dilanggar)
- Semua kanji ditulis dengan furigana berformat {漢字|かんじ}. Okurigana ditulis di luar kurung: {食|た}べる, {美|うつく}しい, {勉強|べんきょう}する.
- Kana di depan kanji, termasuk awalan お/ご, juga di luar kurung: お{腹|なか}, ご{飯|はん}. Setiap blok berdiri sendiri; DILARANG kurung di dalam kurung seperti {お{腹|なか}|おなか}.
- Angka yang dibaca bersama kanji penghitungnya digabung dalam satu blok: {3時|さんじ}, {10日|とおか}. Angka tanpa kanji tidak diberi furigana: 1, 20, 1つ.
- JANGAN memasang furigana pada teks tanpa kanji: tulis ある, テレビ, JR — bukan {ある|ある}. Bacaan yang disebut di notes ditulis kana biasa: "dibaca よん atau し" — bukan {よん|よん}.
- Tidak boleh ada satu pun kanji di luar format {漢字|かな}, termasuk di notes dan termasuk kanji yang sangat umum: {私|わたし}, {何|なに}, {人|ひと}, {一緒|いっしょ}.
- { } hanya untuk furigana, jangan dipakai untuk mengutip kata: {明日} salah, tulis {明日|あした}.
- DILARANG memakai HTML, markdown, emoji, atau karakter { } | selain untuk furigana.
- Hanya aksara Jepang; jangan memakai aksara Tionghoa sederhana seperti 买 (tulis {買|か}う).

FIELD KELUARAN
- word: tulisan kata persis seperti masukan, ditambah furigana pada kanjinya. Bacaan furigananya harus sama dengan reading, kecuali readingUncertain atau bacaan sumber jelas keliru (jelaskan di doubt).
- meaningsId: 1-6 arti bahasa Indonesia yang natural, arti paling umum lebih dulu. Satu arti per item, ringkas (1-4 kata), tanpa penjelasan dan tanpa titik koma. Pertahankan kelas kata: kata kerja dalam bentuk dasar ("makan", "memanggil" — JANGAN "untuk makan"), kata benda tetap kata benda, kata sifat tetap kata sifat. Jangan menerjemahkan harfiah dari bahasa Inggris.
- meaningsEn: 1-6 arti bahasa Inggris yang ringkas. Kata kerja boleh diawali "to".
- examples: 1 contoh kalimat. Tulis 2 contoh hanya bila kata itu punya dua makna yang benar-benar berbeda. Setiap contoh:
  - jp: kalimat alami dan pendek (sekitar 10-25 karakter untuk N5-N4, sampai 40 untuk N3-N1). Tata bahasa dan kosakata lain di kalimat tidak lebih sulit dari level kata. Semua kanji berfurigana. Kata target — boleh dalam bentuk terkonjugasi — ditandai tepat SATU kali dengan __...__, mis. {毎朝|まいあさ}パンを__{食|た}べます__。
    __ dan { } adalah dua penanda berbeda: __ membungkus kata target beserta blok furigananya yang utuh, tidak pernah menggantikan { }. Ungkapan beberapa kata ditandai seluruhnya. Benar: __お{腹|なか}__が{痛|いた}いです / __お{腹|なか}が{空|す}きました__. Salah: お{腹|なか}が__痛|いた__いです (kurung hilang dan yang ditandai bukan kata target).
  - id: terjemahan bahasa Indonesia yang natural.
  - en: terjemahan bahasa Inggris yang natural.
- notes: catatan bahasa Indonesia, maksimal 2 kalimat, atau "" bila tidak ada yang penting. Isi hanya bila berguna bagi pelajar: beda dengan kata mirip, pasangan transitif/intransitif, partikel yang biasa menyertai, kata yang lebih sering ditulis kana, padanan keigo, atau makna penting lain. Bila homographs tidak kosong, sebutkan bahwa tulisan yang sama juga dibaca dengan bacaan itu beserta arti singkatnya — kecuali bacaan itu jelas salah ketik sumber (sebutkan di doubt).
- tags: pilih HANYA slug dari DAFTAR TAG di bawah, patuhi jumlah per dimensi. Jangan menulis tag level (n5-n1); itu diisi otomatis.
- doubt: null, kecuali ada yang janggal pada masukan (bacaan sumber keliru, tulisan salah ketik, atau bukan kata yang lazim). Bila janggal, jelaskan singkat dalam bahasa Indonesia.

DAFTAR TAG
${tagSection(taxonomy)}

FORMAT KELUARAN
Hanya JSON, tanpa teks lain dan tanpa blok kode, satu objek per kata masukan dengan key yang sama:
{"notes":[{"key":"...","word":"...","meaningsId":["..."],"meaningsEn":["..."],"examples":[{"jp":"...","id":"...","en":"..."}],"notes":"","tags":["..."],"doubt":null}]}

PERIKSA SEBELUM MENJAWAB
Kartu yang melanggar salah satu poin ini ditolak dan harus ditulis ulang. Periksa setiap kartu:
1. Baca jp dan notes karakter demi karakter: setiap kanji, termasuk kanji kata lain di kalimat dan kata yang disebut di notes, ada di dalam {漢字|かな}.
2. { } selalu berisi kanji dan bacaannya — tidak pernah kana, angka, atau kata tanpa bacaan.
3. __ muncul tepat satu kali per contoh dan membungkus kata target lengkap dengan kurungnya: __{朝|あさ}__, bukan __朝|あさ__.
4. Jumlah tag per dimensi sesuai aturan.`;
}

/** Hanya field yang berguna bagi model; field kosong tidak dikirim. */
function toPromptInput(note) {
  return {
    key: note.key,
    word: note.word,
    reading: note.reading,
    ...(note.readingUncertain ? { readingUncertain: true } : {}),
    ...(note.hints.length > 0 ? { hints: note.hints } : {}),
    ...(note.homographs.length > 0 ? { homographs: note.homographs } : {}),
  };
}

export function buildUserPrompt(level, notes) {
  const lines = notes.map((note) => JSON.stringify(toPromptInput(note)));
  return (
    `Level JLPT: ${level}. Buat kartu untuk ${notes.length} kata berikut:\n[\n${lines.join(",\n")}\n]\n` +
    "Ingat: setiap kanji di word, jp, dan notes wajib berformat {漢字|かな}, termasuk {私|わたし} dan {何|なに}."
  );
}

export function buildRetryPrompt(failures) {
  const lines = failures.map(({ key, problems }) => `- key "${key}": ${problems.join("; ")}`);
  return (
    "Kartu berikut belum memenuhi aturan. Tulis ulang HANYA kartu-kartu ini dari awal, " +
    `lengkap semua field-nya, dalam format JSON yang sama:\n${lines.join("\n")}`
  );
}

// ---------------------------------------------------------------------------
// Parsing jawaban model
// ---------------------------------------------------------------------------

const replyItemSchema = z.object({
  key: z.string(),
  word: z.string(),
  meaningsId: z.array(z.string()),
  meaningsEn: z.array(z.string()),
  examples: z.array(z.object({ jp: z.string(), id: z.string(), en: z.string() })),
  notes: z.string().nullish(),
  tags: z.array(z.string()),
  doubt: z.string().nullish(),
});

/**
 * JSON dari jawaban model. Blok kode dan teks pengantar ditoleransi; hasilnya
 * dipetakan per key supaya satu kartu yang rusak tidak menggagalkan batch.
 *
 * @param {string} raw
 * @returns {{ error: string } | { items: Map<string, unknown> }}
 */
export function parseReply(raw) {
  const text = raw.trim().replace(/^```[a-z]*\n?/i, "").replace(/```$/, "").trim();
  const start = text.search(/[[{]/);
  const end = Math.max(text.lastIndexOf("}"), text.lastIndexOf("]"));
  if (start === -1 || end <= start) return { error: "keluaran bukan JSON" };

  let value;
  try {
    value = JSON.parse(text.slice(start, end + 1));
  } catch (error) {
    return { error: `JSON tidak valid: ${error instanceof Error ? error.message : String(error)}` };
  }

  const list = Array.isArray(value) ? value : value?.notes;
  if (!Array.isArray(list)) return { error: 'JSON harus berbentuk {"notes":[...]}' };

  const items = new Map();
  for (const entry of list) {
    if (entry && typeof entry.key === "string") items.set(entry.key, entry);
  }
  return { items };
}

const EMPTY_DOUBT = new Set(["", "-", "—", "null", "tidak", "tidak ada"]);

/**
 * Satu item jawaban -> isi kartu yang sudah dirapikan, atau daftar masalah
 * bentuk. Aturan isi (furigana, tag, dst.) diperiksa terpisah oleh
 * vocabContentProblems.
 */
export function replyItemToContent(entry) {
  const parsed = replyItemSchema.safeParse(entry);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      problems: [`bentuk keluaran salah di ${issue?.path.join(".") || "objek"}: ${issue?.message}`],
    };
  }

  const item = parsed.data;
  const doubt = item.doubt?.trim() ?? "";
  return {
    content: {
      word: item.word.trim(),
      meaningsId: item.meaningsId.map((value) => value.trim()),
      meaningsEn: item.meaningsEn.map((value) => value.trim()),
      examples: item.examples.map((example) => ({
        jp: example.jp.trim(),
        id: example.id.trim(),
        en: example.en.trim(),
      })),
      notes: (item.notes ?? "").trim(),
      tags: item.tags.map((tag) => tag.trim().toLowerCase()),
    },
    doubt: EMPTY_DOUBT.has(doubt.toLowerCase()) ? null : doubt,
  };
}
