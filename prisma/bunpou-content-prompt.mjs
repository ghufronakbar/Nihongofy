// Prompt for writing publishable Bunpou content from extracted slide evidence.

import { z } from "zod";
import { bunpouContentSchema, aiTagGroups } from "./bunpou-data.mjs";

export const PROMPT_VERSION = "bunpou-content-v4";

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
- HTML dan markdown dilarang.
- Pada setiap examples[].jp, bungkus hanya bagian grammar target dalam bentuk yang muncul di kalimat dengan __...__ tepat satu kali.
- title tanpa markup harus persis sama dengan title point.

ISI CONTENT:
- senseLabel wajib berupa frasa Indonesia huruf kecil bila family terisi; null bila family null.
- meaningId wajib berbahasa Indonesia dan meaningEn wajib berbahasa Inggris; keduanya ringkas dan maksimal 160 karakter.
- connections memakai slug taxonomy. pattern adalah bagian setelah bentuk sambungan, tanpa simbol 〜. form other wajib note.
- formation berisi aturan transformasi linguistik, bukan layout tabel slide. conjugation wajib memiliki formation.
- explanation 1-4 paragraf Indonesia, masing-masing satu baris dan maksimal 700 karakter.
- Prosa Indonesia/Inggris (explanation, note, pitfalls, terjemahan) harus memakai tanda baca Latin . ! ?, bukan tanda Jepang 。！？ di ujung kalimat.
- examples 3-5 kalimat baru, alami, memiliki terjemahan Indonesia dan Inggris, serta cukup jelas untuk kartu rumpang.
- pitfalls 0-4 butir; boleh memakai ○/✕ untuk bentuk benar/salah.
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
    "Tulis content untuk point berikut. related berisi anggota family/judul serupa agar sense tidak tumpang tindih.",
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
