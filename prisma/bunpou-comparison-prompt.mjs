// Prompt for human-selected groups of similar Bunpou points.

import { z } from "zod";
import { comparisonContentSchema } from "./bunpou-data.mjs";

export const PROMPT_VERSION = "bunpou-comparison-v2";

const replySchema = z.object({
  items: z.array(
    z.object({
      key: z.string().min(1),
      content: comparisonContentSchema,
      doubt: z.string().max(400).nullable(),
    }),
  ),
});

function stripCodeFence(value) {
  const trimmed = value.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
}

export function parseComparisonReply(raw) {
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

export const SYSTEM_PROMPT = `Anda pengajar JLPT yang membandingkan beberapa pola grammar yang telah dipilih manusia.

ATURAN:
- Jangan mengganti anggota kelompok atau urutannya.
- Jelaskan perbedaan makna, nuansa, ragam, sambungan, dan batasan yang benar-benar membantu memilih pola.
- Jangan membuat aturan mutlak bila pemakaian asli bergantung konteks.
- Semua kanji wajib memakai markup furigana {漢字|かんじ}; jangan memberi furigana pada kana/Latin.
- Prosa Indonesia harus memakai tanda baca Latin . ! ?, bukan tanda Jepang 。！？ di ujung kalimat.
- HTML dan markdown dilarang.
- rows harus tepat satu per point dan berurutan sama dengan points input.
- contrasts memakai satu slot literal [_]. Setiap contrast memiliki minimal dua option, minimal satu ok, dan verdict harus benar-benar berbeda.
- verdict: ok = alami/benar, awkward = mungkin tetapi tidak alami pada konteks itu, wrong = tidak dapat dipakai.
- Jika perbandingan tidak dapat ditulis akurat dari data yang ada, isi doubt.

KELUARAN JSON MURNI:
{
  "items": [
    {
      "key": "key comparison",
      "content": {
        "summary": "...",
        "rows": [
          { "key": "point-key", "nuance": "...", "register": "...", "restriction": "..." }
        ],
        "contrasts": [
          {
            "jp": "...[_]...",
            "id": "...",
            "options": [
              { "key": "point-key", "text": "...", "verdict": "ok", "note": "..." }
            ]
          }
        ]
      },
      "doubt": null
    }
  ]
}

Keluarkan tepat satu item per comparison input dan tidak ada teks di luar JSON.`;

export function buildUserPrompt(items) {
  return [
    "Buat perbandingan berikut:",
    JSON.stringify(items, null, 2),
  ].join("\n\n");
}

export function buildRetryPrompt(failures) {
  return [
    "Keluaran ditolak validator. Tulis ulang JSON hanya untuk item berikut:",
    ...failures.map(({ key, problems }) => `- ${key}: ${problems.join("; ")}`),
  ].join("\n");
}
