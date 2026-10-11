import { z } from "zod";

export const PROMPT_VERSION = "choukai-transcript-v1";

const entrySchema = z
  .object({
    mondaiType: z.string().min(1),
    questionOrder: z.number().int().positive(),
    transcript: z.string().trim().min(1),
    sourcePages: z.array(z.number().int().positive()).min(1),
    doubt: z.string().trim().min(1).nullable(),
  })
  .strict();

const unassignedSchema = z
  .object({
    sourcePages: z.array(z.number().int().positive()).min(1),
    text: z.string().trim().min(1),
    reason: z.string().trim().min(1),
  })
  .strict();

const replySchema = z
  .object({
    entries: z.array(entrySchema),
    unassigned: z.array(unassignedSchema),
  })
  .strict();

export const SYSTEM_PROMPT = `Anda melakukan OCR transkrip soal listening JLPT dari gambar halaman sumber.

Tugas Anda hanya menyalin teks Jepang yang terlihat dan memetakannya ke soal yang benar. Jangan menerjemahkan, merangkum, menambahkan furigana, memperbaiki tata bahasa, atau mengarang bagian yang terpotong.

Aturan transkripsi:
- Pertahankan teks Jepang, tanda baca, angka pilihan, dan urutan ucapan.
- Pertahankan label pembicara seperti 男、女、男の人、女の人 bila tercetak.
- Gabungkan seluruh dialog, pertanyaan, dan pilihan audio yang termasuk satu soal ke satu field transcript.
- Untuk 即時応答, sertakan ucapan pemicu dan seluruh pilihan respons yang terdengar/tercetak.
- Untuk 発話表現, sertakan seluruh pilihan ucapan; jangan mendeskripsikan gambar karena gambar soal bukan bagian dokumen transkrip.
- Jangan memasukkan instruksi umum, contoh, nomor halaman, header, footer, atau kunci jawaban ke transcript soal.
- Bila nomor soal atau mondai tidak dapat dipastikan, masukkan teks ke unassigned. Jangan menebak.
- Bila sebagian teks tidak terbaca, salin bagian yang terbaca dan jelaskan keraguan secara singkat di doubt.

Keluarkan JSON valid saja, tanpa markdown atau kalimat pembuka:
{"entries":[{"mondaiType":"CHOUKAI_TASK_BASED","questionOrder":1,"transcript":"...","sourcePages":[1],"doubt":null}],"unassigned":[{"sourcePages":[1],"text":"...","reason":"..."}]}`;

export function buildUserPrompt({ pkg, expected, pageNumbers }) {
  const lines = [
    `Paket: ${pkg.name}`,
    `Level: ${pkg.jlptLevel}`,
    `Halaman yang dilampirkan: ${pageNumbers.join(", ")}`,
    "",
    "Struktur soal CHOUKAI yang sah:",
  ];

  for (const item of expected) {
    lines.push(`- ${item.mondaiType}: nomor 1-${item.questionCount}`);
  }

  lines.push(
    "",
    "Gunakan hanya mondaiType dan nomor soal di atas. sourcePages harus memakai nomor halaman yang dilampirkan. Halaman dapat bertumpang tindih dengan batch lain; tetap transkripsikan isi lengkap yang terlihat agar hasil dapat digabung secara deterministik.",
  );

  return lines.join("\n");
}

function stripCodeFence(value) {
  const trimmed = value.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
}

function extractJsonObject(value) {
  const stripped = stripCodeFence(value);
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start === -1 || end < start) throw new Error("keluaran tidak memuat objek JSON");
  return stripped.slice(start, end + 1);
}

export function parseExtractionReply(raw, { expectedByMondai, allowedPages }) {
  let json;
  try {
    json = JSON.parse(extractJsonObject(raw));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { problems: [`JSON tidak valid: ${message}`] };
  }

  const parsed = replySchema.safeParse(json);
  if (!parsed.success) {
    return {
      problems: parsed.error.issues.map(
        (issue) => `${issue.path.length > 0 ? issue.path.join(".") : "$"}: ${issue.message}`,
      ),
    };
  }

  const problems = [];
  const seen = new Set();

  for (const [index, entry] of parsed.data.entries.entries()) {
    const questionCount = expectedByMondai.get(entry.mondaiType);
    if (!questionCount) {
      problems.push(`entries.${index}.mondaiType tidak dikenal: ${entry.mondaiType}`);
    } else if (entry.questionOrder > questionCount) {
      problems.push(
        `entries.${index}.questionOrder ${entry.questionOrder} di luar 1-${questionCount} untuk ${entry.mondaiType}`,
      );
    }

    const key = `${entry.mondaiType}#${entry.questionOrder}`;
    if (seen.has(key)) problems.push(`entry duplikat dalam satu respons: ${key}`);
    seen.add(key);

    for (const page of entry.sourcePages) {
      if (!allowedPages.has(page)) problems.push(`${key}: sourcePages memuat halaman di luar batch: ${page}`);
    }
  }

  for (const [index, entry] of parsed.data.unassigned.entries()) {
    for (const page of entry.sourcePages) {
      if (!allowedPages.has(page)) {
        problems.push(`unassigned.${index}: sourcePages memuat halaman di luar batch: ${page}`);
      }
    }
  }

  return problems.length > 0 ? { problems } : { value: parsed.data };
}

export function buildRetryPrompt(problems) {
  return (
    `Keluaran tadi belum valid: ${problems.join("; ")}. ` +
    "Tulis ulang seluruh JSON dari awal. Jangan menambahkan markdown atau penjelasan lain."
  );
}
