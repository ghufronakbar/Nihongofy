// Prompt for writing publishable Bunpou content from extracted slide evidence.

import { z } from "zod";
import { bunpouContentSchema, aiTagGroups } from "./bunpou-data.mjs";

export const PROMPT_VERSION = "bunpou-content-v10";

const replySchema = z.object({
  items: z.array(
    z.object({
      key: z.string().min(1),
      content: bunpouContentSchema,
      doubt: z.string().max(400).nullable(),
    }),
  ),
});

function stripCodeFence(value) {
  const trimmed = value.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
}

export function parseContentReply(raw) {
  let json;
  try {
    json = JSON.parse(stripCodeFence(raw));
  } catch (error) {
    return { error: `keluaran bukan JSON valid: ${error.message}` };
  }
  const parsed = replySchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: `${issue?.path.join(".") || "root"}: ${issue?.message}` };
  }
  const items = new Map();
  for (const item of parsed.data.items) {
    if (items.has(item.key)) return { error: `key ganda dalam keluaran: ${item.key}` };
    items.set(item.key, item);
  }
  return { items };
}

export function buildSystemPrompt(taxonomy) {
  const tagText = aiTagGroups(taxonomy)
    .map(({ dimension, tags }) => {
      const options = tags
        .map((tag) => `  - ${tag.slug}: ${tag.label} — ${tag.description}`)
        .join("\n");
      return `${dimension.id} (${dimension.min}-${dimension.max}): ${dimension.rule}\n${options}`;
    })
    .join("\n\n");
  const connectionText = taxonomy.connectionForms
    .map((form) => `- ${form.slug}: ${form.label} (${form.labelJa}); contoh ${form.example}`)
    .join("\n");

  return `Anda pengajar JLPT yang menulis katalog grammar untuk pelajar Indonesia. Source slide adalah bukti identitas dan makna, bukan teks yang boleh disalin menjadi penjelasan final.

ATURAN UMUM:
- Tulis penjelasan dan terjemahan baru yang akurat berdasarkan identitas point, source, dan pengetahuan bahasa Jepang Anda.
- Satu point hanya menjelaskan satu makna/sense. Jangan mencampurkan fungsi lain dari family yang sama.
- Jika source meragukan, level tampak tidak wajar, atau Anda tidak yakin dapat menulis konten akurat, isi doubt. Jangan mengarang untuk menutup ketidakpastian.
- Jangan menyalin contoh source, bahkan dengan perubahan tanda baca kecil.

MARKUP JEPANG WAJIB:
- Setiap kanji dalam content harus memiliki furigana {漢字|かんじ}. Kana, angka, Latin, dan bahasa Indonesia tidak diberi furigana.
- Furigana hanya membungkus bagian kanji; okurigana harus berada di luar. Tulis {食|た}べる, bukan {食べる|たべる} atau {食べる|た}.
- HTML dan markdown dilarang.
- Pada setiap examples[].jp, bungkus hanya bagian grammar target dalam bentuk yang muncul di kalimat dengan __...__ tepat satu kali.
- Jangan masukkan kata dasar atau bentuk sambungan ke dalam __...__. Ikuti pemisahan connections.form + connections.pattern. Contoh: {帰|かえ}ろう__とした__, {読|よ}んで__ごらん__, {教師|きょうし}__として__, {雨|あめ}が{降|ふ}って__も__.
- Untuk form v-te, て／で adalah bagian bentuk sambungan dan wajib berada di luar __...__. Contoh: {読|よ}んで__いる__, {変|か}わって__も__, bukan {読|よ}ん__でいる__ atau {変|か}わっ__ても__.
- Untuk form v-ta, た／だ adalah bagian bentuk sambungan dan wajib berada di luar __...__. Contoh: {開|あ}けた__ら__, {教|おし}えた__っけ__, {飲|の}んだ__らどうですか__, bukan {開|あ}け__たら__, {教|おし}え__たっけ__, atau {飲|の}ん__だらどうですか__.
- Seluruh connections.pattern harus masuk ke dalam __...__, termasuk awalan に、の、で, tetapi connections.form tetap di luar. Contoh: {店長|てんちょう}__にかわって__, {働|はたら}く__のに{比|くら}べて__, {来|こ}ない__かなあ__, {使|つか}わない__でほしい__.
- Jangan menyisipkan spasi ASCII di antara kata atau frasa Jepang. Tulis __ぜひ__{来|き}てください, bukan __ぜひ__ {来|き}てください.
- Kalimat Jepang memakai tanda baca Jepang 。！？, bukan titik atau tanda tanya Latin.
- title tanpa markup harus persis sama dengan title point.

ISI CONTENT:
- senseLabel wajib berupa frasa Indonesia huruf kecil bila family terisi; null bila family null.
- meaningId wajib berbahasa Indonesia dan meaningEn wajib berbahasa Inggris; keduanya ringkas dan maksimal 160 karakter.
- connections memakai slug taxonomy. Untuk form selain other, pattern hanya berisi satu bentuk target setelah bentuk sambungan; pisahkan alternatif ke objek lain dan jangan memakai simbol 〜, tanda +, placeholder, atau prosa.
- Untuk form other, pattern harus berupa ungkapan tetap yang benar-benar di-underline. Template Jepang ringkas seperti お〜になる hanya boleh dipakai pada point kategori luas; jangan menulis placeholder/prosa seperti “klausa bersyarat” di dalam pattern.
- Pada pola berpasangan seperti いくら〜ても atau どんなに〜ても, simpan dan underline unsur tetap pertama sebagai pattern other, lalu jelaskan pasangan wajibnya di note. Jangan hanya menggarisbawahi も.
- Untuk pola daftar berulang seperti 〜とか〜とか, gunakan form other dengan template ringkas とか〜とか dan underline satu rentang utuh yang mencakup kedua unsur beserta kedua とか agar konstruksinya jelas di UI.
- form other wajib note.
- formation berisi aturan transformasi linguistik, bukan layout tabel slide. conjugation wajib memiliki formation.
- Semua field objek wajib ditulis. Khusus formation[].note, tulis null bila tidak ada catatan. Jangan mengisi connections[].note dengan string kosong; hilangkan field tersebut bila tidak diperlukan.
- explanation 1-6 paragraf Indonesia, masing-masing satu baris dan maksimal 700 karakter.
- Untuk N2 dan N1, tulis 3-6 paragraf yang benar-benar membedakan arti inti, cara pembentukan, nuansa pragmatis, serta batas penggunaan. Jangan mengulang kalimat yang sama dengan susunan berbeda.
- usage merinci pemakaian dalam empat kelompok: nuance, register, restrictions, dan typicalContexts. Untuk N2/N1 setiap kelompok wajib berisi minimal satu butir yang konkret; jangan mengisi prosa generik seperti “tergantung konteks”.
- Prosa Indonesia/Inggris (explanation, note, pitfalls, terjemahan) harus memakai tanda baca Latin . ! ?, bukan tanda Jepang 。！？ di ujung kalimat.
- examples 3-7 kalimat baru, alami, memiliki terjemahan Indonesia dan Inggris, serta cukup jelas untuk kartu rumpang.
- Untuk N2/N1, tulis 5-7 contoh dengan konteks dan kosakata bervariasi. Sertakan ragam formal/tulisan bila memang lazim, tetapi jangan memaksakan ragam yang tidak cocok.
- Pola kontras seperti 反面 wajib menghubungkan dua sisi yang benar-benar berlawanan atau saling mengimbangi, bukan dua peran atau fakta yang hanya bersifat tambahan.
- examples[].id wajib murni berbahasa Indonesia dan examples[].en wajib murni berbahasa Inggris; jangan mencampurkan kata dari bahasa lainnya.
- pitfalls 0-5 butir; boleh memakai ○/✕ untuk bentuk benar/salah.
- Untuk N2/N1, pitfalls wajib minimal 2 butir dan harus membahas kesalahan sambungan, batasan makna, atau pola yang mudah tertukar.
- variants hanya bentuk yang benar-benar setara, bukan grammar lain yang sekadar mirip.

TAG YANG SAH:
${tagText}

BENTUK SAMBUNGAN YANG SAH:
${connectionText}

KELUARAN WAJIB JSON MURNI:
{
  "items": [
    {
      "key": "key input",
      "content": {
        "title": "judul dengan markup furigana",
        "senseLabel": null,
        "meaningId": "...",
        "meaningEn": "...",
        "connections": [{ "form": "v-dict", "pattern": "...", "note": "opsional" }],
        "formation": [{ "label": "...", "input": "...", "rule": "...", "output": "...", "note": null }],
        "variants": [],
        "explanation": ["..."],
        "usage": {
          "nuance": ["..."],
          "register": ["..."],
          "restrictions": ["..."],
          "typicalContexts": ["..."]
        },
        "examples": [{ "jp": "...__...__...", "id": "...", "en": "..." }],
        "pitfalls": [],
        "tags": ["..."]
      },
      "doubt": null
    }
  ]
}

Keluarkan tepat satu item untuk setiap key input dan jangan tulis teks di luar JSON.`;
}

export function buildUserPrompt(level, points) {
  return [
    `Level: ${level}`,
    "Tulis content untuk point berikut. related berisi anggota family atau judul serupa. Bentuk yang sama pada level berbeda boleh menjelaskan sense yang sama; jangan menciptakan perbedaan yang tidak didukung source. Untuk anggota family yang memang berbeda makna, jaga agar penjelasan setiap sense tidak tumpang tindih.",
    JSON.stringify(
      points.map(({ point, related }) => ({
        key: point.key,
        kind: point.kind,
        sectionKey: point.sectionKey,
        family: point.family,
        title: point.title,
        source: point.source,
        extractDoubt: point.extract.doubt,
        related,
      })),
      null,
      2,
    ),
  ].join("\n\n");
}

export function buildRetryPrompt(failures) {
  return [
    "Sebagian item ditolak validator. Tulis ulang SELURUH JSON, tetapi items cukup memuat key yang gagal berikut:",
    ...failures.map(({ key, problems }) => `- ${key}: ${problems.join("; ")}`),
    "Jangan menulis teks di luar JSON.",
  ].join("\n");
}
