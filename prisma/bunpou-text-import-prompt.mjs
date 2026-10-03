// Prompt for turning an identity-only text index into normalized Bunpou points.

import { z } from "zod";
import { KINDS, KEY_PATTERN } from "./bunpou-data.mjs";

export const PROMPT_VERSION = "bunpou-text-import-v2";

const formationSchema = z.object({
  label: z.string(),
  input: z.string(),
  rule: z.string(),
  output: z.string(),
  note: z.string().nullable(),
});

const candidateSchema = z.object({
  key: z.string().min(1).max(80).regex(KEY_PATTERN),
  kind: z.enum(KINDS),
  sectionKey: z.string().min(1).max(80).regex(KEY_PATTERN),
  family: z.string().min(1).max(80).regex(KEY_PATTERN).nullable(),
  title: z.string().min(1).max(160),
  source: z.object({
    title: z.string(),
    meaning: z.string(),
    connection: z.string(),
    formation: z.array(formationSchema),
    notes: z.string(),
    examples: z.array(z.string()),
  }),
  doubt: z.string().max(400).nullable(),
});

const replySchema = z.object({
  items: z.array(
    z.object({
      itemKey: z.string().min(1),
      points: z.array(candidateSchema).min(1).max(8),
    }),
  ),
});

function stripCodeFence(value) {
  const trimmed = value.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
}

export function parseTextImportReply(raw) {
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
    if (items.has(item.itemKey)) return { error: `itemKey ganda: ${item.itemKey}` };
    items.set(item.itemKey, item.points);
  }
  return { items };
}

export function buildTextImportSystemPrompt(taxonomy) {
  const sections = taxonomy.sections
    .map((section) => `- ${section.key}: ${section.label} — ${section.description}`)
    .join("\n");

  return `Anda menyusun identitas katalog bunpou JLPT untuk pelajar Indonesia dari indeks teks sebuah video.

SUMBER DAN BATAS BUKTI:
- Indeks video hanya membuktikan bahwa label tersebut dicantumkan pada level, hari, dan timestamp tertentu.
- Guidance adalah hasil pemeriksaan manusia terhadap materi video dan harus diprioritaskan.
- Anda boleh memakai pengetahuan bahasa Jepang untuk menormalisasi judul, sense, sambungan, dan catatan, tetapi jangan mengaku bahwa detail tersebut dikutip verbatim dari video.
- Jika guidance bertentangan dengan pemakaian Jepang yang benar atau masih terlalu ambigu, tetap buat kandidat terbaik dan isi doubt secara spesifik.

ATURAN IDENTITAS:
- Satu point hanya menjelaskan satu sense. Pecah label menjadi beberapa point bila fungsi, sambungan, atau nuansanya memang berbeda.
- Jangan memecah variasi ejaan atau bentuk setara menjadi point terpisah bila masih satu sense.
- title hanya berisi bentuk grammar Jepang baku tanpa furigana, underline, HTML, atau baris baru. Jangan menambahkan label sense, arti, atau anotasi penjelas dalam tanda kurung; bedakan sense melalui key, family, dan source.meaning.
- key berupa slug ASCII kecil yang menggambarkan bentuk dan sense. Script akan menyelesaikan benturan key lintas level secara deterministik; jangan menciptakan perbedaan makna palsu hanya untuk membedakan key.
- family dipakai hanya bila bentuk yang sama mempunyai beberapa sense. Semua hasil pecahan dari bentuk yang sama memakai family yang sama.
- kind biasanya pattern. Gunakan particle untuk fungsi partikel, conjugation bila inti materinya sistem perubahan bentuk, dan foundation hanya untuk konsep dasar.
- sectionKey harus berasal dari daftar section sah.

ATURAN SOURCE TERNORMALISASI:
- source.title adalah bentuk grammar yang sudah dinormalisasi dan mengikuti aturan title yang sama: tanpa label sense, arti, atau anotasi penjelas.
- source.meaning adalah ringkasan Indonesia yang membedakan sense ini dari sense lain.
- source.connection adalah notasi sambungan teks polos yang lengkap.
- source.formation hanya diisi bila materi membutuhkan aturan perubahan bentuk yang terstruktur; semua field wajib teks polos dan note null bila tidak ada.
- source.notes menjelaskan nuansa, batasan, variasi, dan perbedaan penting yang diketahui dari guidance atau pengetahuan tata bahasa.
- source.examples berisi 0-3 contoh Jepang teks polos tanpa furigana. Contoh ini hanya bukti kerja internal dan tidak akan ditampilkan; jangan menyalin contoh terkenal secara panjang.

SECTION YANG SAH:
${sections}

KELUARAN JSON MURNI:
{
  "items": [
    {
      "itemKey": "key item input",
      "points": [
        {
          "key": "key-global-unik",
          "kind": "pattern",
          "sectionKey": "sentence-patterns",
          "family": null,
          "title": "〜文法",
          "source": {
            "title": "〜文法",
            "meaning": "makna sense ini",
            "connection": "sambungan lengkap",
            "formation": [],
            "notes": "nuansa dan batasan",
            "examples": []
          },
          "doubt": null
        }
      ]
    }
  ]
}

Keluarkan tepat satu items[] untuk setiap itemKey input dan jangan tulis teks di luar JSON.`;
}

export function buildTextImportUserPrompt(source, items) {
  return [
    `Source: ${source.key}`,
    `Level: ${source.level}`,
    `Judul: ${source.title}`,
    `URL: ${source.url}`,
    "Normalisasi item berikut. day dan timestamp hanya menentukan provenance serta urutan.",
    JSON.stringify(
      items.map((item) => ({
        itemKey: item.key,
        raw: item.raw,
        guidance: item.guidance,
        day: item.day,
        timestampSeconds: item.timestampSeconds,
      })),
      null,
      2,
    ),
  ].join("\n\n");
}

export function buildTextImportRetryPrompt(failures) {
  return [
    "Sebagian item ditolak. Tulis ulang JSON dan cukup sertakan itemKey yang gagal:",
    ...failures.map(({ itemKey, problems }) => `- ${itemKey}: ${problems.join("; ")}`),
  ].join("\n");
}
