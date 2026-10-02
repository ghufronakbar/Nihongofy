// Vision extraction prompt. This step records only evidence visible in the
// slides; explanations and teaching examples are generated separately.

import { z } from "zod";
import { DECK_PATTERN, KEY_PATTERN, KINDS } from "./bunpou-data.mjs";

export const PROMPT_VERSION = "bunpou-extract-v2";

const keySchema = z.string().max(80).regex(KEY_PATTERN);
const formationRowSchema = z.object({
  label: z.string(),
  input: z.string(),
  rule: z.string(),
  output: z.string(),
  note: z.string().nullable(),
});

const extractedSourceSchema = z.object({
  slides: z.array(z.string().min(1)).min(1),
  title: z.string(),
  meaning: z.string(),
  connection: z.string(),
  formation: z.array(formationRowSchema),
  notes: z.string(),
  examples: z.array(z.string()),
});

const extractedPointSchema = z.object({
  key: keySchema,
  kind: z.enum(KINDS),
  sectionKey: z.string().regex(KEY_PATTERN),
  family: keySchema.nullable(),
  title: z.string().min(1).max(160),
  source: extractedSourceSchema,
  doubt: z.string().max(400).nullable(),
});

const extractedSlideSchema = z.object({
  path: z.string().min(1),
  skipped: z.string().nullable(),
  pointKeys: z.array(keySchema),
});

const extractionReplySchema = z.object({
  slides: z.array(extractedSlideSchema),
  points: z.array(extractedPointSchema),
});

function stripCodeFence(value) {
  const trimmed = value.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
}

export function parseExtractionReply(raw) {
  let json;
  try {
    json = JSON.parse(stripCodeFence(raw));
  } catch (error) {
    return { error: `keluaran bukan JSON valid: ${error.message}` };
  }
  const parsed = extractionReplySchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: `${issue?.path.join(".") || "root"}: ${issue?.message}` };
  }
  return { value: parsed.data };
}

export function buildSystemPrompt(taxonomy) {
  const sections = taxonomy.sections
    .sort((left, right) => left.order - right.order)
    .map((section) => `- ${section.key}: ${section.label} (${section.description})`)
    .join("\n");

  return `Anda mengekstraksi sumber slide grammar bahasa Jepang untuk katalog JLPT.

LANGKAH INI HANYA MENYALIN BUKTI DARI SLIDE:
- Jangan menambah penjelasan, aturan, contoh, terjemahan, atau pengetahuan yang tidak terlihat pada gambar.
- Pertahankan teks Jepang dan arti Indonesia/Inggris sebagaimana tertulis. source memakai teks polos, tanpa markup furigana {kanji|kana} dan tanpa markdown.
- Bila tulisan tidak terbaca atau sumber tampak keliru, salin bagian yang masih dapat dibaca lalu isi doubt secara singkat.

PEMECAHAN ENTRI:
- Satu entri mewakili satu makna/fungsi yang dapat memiliki halaman referensi sendiri.
- Satu slide boleh menghasilkan beberapa entri; satu entri boleh memakai beberapa slide.
- Partikel dengan fungsi berbeda menjadi entri berbeda dan berbagi family, mis. ni-location, ni-time, ni-destination dengan family "ni".
- Bentuk sama dengan makna berbeda memakai family yang sama. Bentuk berbeda yang sekadar mirip TIDAK memakai family.
- Slide daftar kosakata/adverbia murni dilewati. Sistem grammar dasar boleh menjadi foundation atau conjugation.
- Jika materi melanjutkan entri existing, gunakan key existing dan keluarkan lagi point itu dengan source hanya dari slide batch ini; script akan menggabungkannya.

KIND:
- pattern: pola kalimat/ungkapan dengan sambungan tertentu.
- particle: satu fungsi partikel.
- conjugation: sistem perubahan bentuk dengan baris formation.
- foundation: konsep dasar grammar yang bukan satu pola produktif.

SECTION YANG SAH:
${sections}

IDENTITAS:
- key/family memakai huruf kecil ASCII, angka, dan tanda hubung; maksimal 80 karakter.
- key memakai romaji bentuk + makna Indonesia singkat bila perlu membedakan sense. Jangan memakai istilah Inggris seperti "conjugation"; gunakan "konjugasi" atau "perubahan".
- title adalah bentuk baku Jepang teks polos, gunakan 〜 bila merupakan pola dengan slot.
- formation hanya memuat transformasi yang benar-benar terlihat: label kelas, input, rule, output, note opsional.
- source.slides hanya boleh berisi path slide dari batch ini.

KELUARAN WAJIB JSON MURNI:
{
  "slides": [
    { "path": "...", "skipped": null, "pointKeys": ["key-yang-muncul"] }
  ],
  "points": [
    {
      "key": "...",
      "kind": "pattern|particle|conjugation|foundation",
      "sectionKey": "...",
      "family": null,
      "title": "...",
      "source": {
        "slides": ["..."],
        "title": "judul persis/terdekat pada slide",
        "meaning": "arti yang tertulis, atau string kosong",
        "connection": "sambungan yang tertulis, atau string kosong",
        "formation": [
          { "label": "...", "input": "...", "rule": "...", "output": "...", "note": null }
        ],
        "notes": "catatan/restriksi yang tertulis, atau string kosong",
        "examples": ["contoh persis dari slide"]
      },
      "doubt": null
    }
  ]
}

Setiap slide input harus muncul tepat sekali di slides. Slide yang dilewati memakai pointKeys [] dan skipped berisi alasan. Jangan menulis teks apa pun di luar JSON.`;
}

export function buildUserPrompt({ level, deck, slides, existingPoints }) {
  if (!DECK_PATTERN.test(deck)) throw new Error(`deck tidak valid: ${deck}`);
  const lines = [
    `Level sumber: ${level}`,
    `Deck: ${deck}`,
    "",
    "Gambar dilampirkan berurutan dan masing-masing diberi path berikut:",
    ...slides.map((slide, index) => `${index + 1}. ${slide.path}`),
  ];

  if (existingPoints.length > 0) {
    lines.push(
      "",
      "Entri yang sudah muncul sebelumnya dalam deck ini (gunakan key ini bila slide melanjutkannya):",
      JSON.stringify(existingPoints, null, 2),
    );
  } else {
    lines.push("", "Belum ada entri sebelumnya dalam deck ini.");
  }

  lines.push(
    "",
    "Ekstrak semua informasi grammar yang terlihat. Jangan menyimpulkan isi gambar lain atau materi di luar batch.",
  );
  return lines.join("\n");
}

export function buildRetryPrompt(problems) {
  return (
    `Keluaran tadi ditolak: ${problems.join("; ")}. ` +
    "Tulis ulang SELURUH JSON dari awal. Pastikan setiap path slide input muncul tepat sekali dan tidak ada teks di luar JSON."
  );
}
