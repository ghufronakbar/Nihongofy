import { createHash } from "node:crypto";
import { z } from "zod";
import { collectQuestionImages, SYSTEM_PROMPT as BASE_SYSTEM_PROMPT } from "./explanation-prompt.mjs";
import { markupProblems } from "./japanese-markup-check.mjs";

export const PROMPT_VERSION = "choukai-explanation-v1";

const MONDAI_GUIDANCE = {
  CHOUKAI_TASK_BASED:
    "Uraikan urutan tindakan/informasi, perubahan keputusan, lalu alasan setiap alternatif ditolak.",
  CHOUKAI_MAIN_POINT:
    "Tunjukkan detail penentu jawaban dan bedakan dari detail pengalih yang sengaja disebut dalam percakapan.",
  CHOUKAI_OUTLINE:
    "Jelaskan gagasan umum pembicaraan dan mengapa detail tertentu bukan inti keseluruhan audio.",
  CHOUKAI_EXPRESSION:
    "Gunakan situasi pada gambar sebagai konteks wajib, lalu jelaskan ungkapan yang paling alami untuk orang yang ditunjuk.",
  CHOUKAI_QUICK_RESPONSE:
    "Pisahkan ucapan pemicu dari pilihan respons di transkrip, lalu jelaskan kecocokan fungsi, waktu, dan maksud tiap respons.",
  CHOUKAI_INTEGRATED:
    "Gabungkan informasi dari seluruh bagian transkrip dan jelaskan hubungan antarinformasi yang menentukan jawaban.",
};

const LABEL_PATTERN =
  /^(RINGKASAN|PEMBAHASAN|TERJEMAHAN|POIN|PILIHAN [1-4]|KUNCI_MERAGUKAN|CATATAN_KUNCI)\s*:\s*(.*)$/;

export const SYSTEM_PROMPT = `${BASE_SYSTEM_PROMPT}

ATURAN KHUSUS SOAL LISTENING/CHOUKAI:
- Ini adalah soal listening/CHOUKAI JLPT. Transkrip reviewed adalah representasi utama audio.
- Jangan mengubah, mengoreksi, atau menambahkan isi transkrip. Jelaskan berdasarkan teks yang diberikan apa adanya.
- Kunci resmi diberikan, tetapi bila bertentangan dengan transkrip atau gambar, tulis KUNCI_MERAGUKAN: ya dan jangan memaksakan pembenaran.
- Bedakan pilihan tertulis pada fixture dari pilihan lisan bernomor yang sudah berada di dalam transkrip. Untuk 発話表現 dan 即時応答, pilihan lisan di transkrip adalah sumber utama walaupun answerText fixture kosong.
- Sebagian soal resmi hanya memiliki tiga pilihan, sementara fixture menyediakan empat slot. Bila transkrip hanya memuat pilihan 1-3, tulis PILIHAN 4 sebagai SALAH dan jelaskan bahwa slot keempat tidak digunakan pada soal ini.
- Audio biasanya tidak dilampirkan karena transkrip sudah diaudit. Bila audio dilampirkan dalam mode eskalasi, gunakan hanya sebagai bukti sekunder untuk memeriksa keraguan; jangan membuat transkrip pengganti.
- Gambar yang dilampirkan adalah konteks nyata soal. Baca seluruh gambar yang diberikan dan jangan mengarang detail yang tidak terlihat.`;

const replyFieldsSchema = z.object({
  summary: z.string().trim().min(1),
  detail: z.string().trim().min(1),
  translation: z.string().nullable(),
  keyPoints: z.array(z.string().trim().min(1)),
  choices: z
    .array(
      z
        .object({
          codeAnswer: z.number().int().min(1).max(4),
          reason: z.string().trim().min(1),
        })
        .strict(),
    )
    .length(4),
  answerKeyDoubt: z.boolean(),
  answerKeyDoubtNote: z.string().trim().min(1).nullable(),
});

function stripCodeFence(text) {
  const trimmed = text.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed.replace(/^```[a-z]*\n?/i, "").replace(/```$/, "").trim();
}

function parseLabelledReply(raw) {
  const fields = new Map();
  let currentLabel = null;

  for (const line of stripCodeFence(raw).split("\n")) {
    const match = line.match(LABEL_PATTERN);
    if (match) {
      currentLabel = match[1];
      fields.set(currentLabel, [match[2]]);
      continue;
    }
    if (currentLabel) fields.get(currentLabel).push(line);
  }

  return Object.fromEntries(
    [...fields.entries()].map(([label, lines]) => [label, lines.join("\n").trim()]),
  );
}

function isPlaceholder(value) {
  return !value || value === "-" || value === "—";
}

export function parseExplanationReply(raw, question) {
  const problems = [];
  const fields = parseLabelledReply(raw);
  const summary = fields.RINGKASAN ?? "";
  const detail = fields.PEMBAHASAN ?? "";

  if (!summary) problems.push("label RINGKASAN kosong/tidak ada");
  if (!detail) problems.push("label PEMBAHASAN kosong/tidak ada");

  const choices = [];
  const markedCorrect = [];
  for (const codeAnswer of [1, 2, 3, 4]) {
    const value = fields[`PILIHAN ${codeAnswer}`];
    if (!value) {
      problems.push(`label PILIHAN ${codeAnswer} tidak ada`);
      continue;
    }

    const verdict = value.match(/^(BENAR|SALAH)\b[\s:.—-]*/i);
    if (!verdict) {
      problems.push(`PILIHAN ${codeAnswer} tidak diawali BENAR/SALAH`);
      continue;
    }

    const reason = value.slice(verdict[0].length).trim();
    if (!reason) {
      problems.push(`PILIHAN ${codeAnswer} tidak punya alasan`);
      continue;
    }

    if (verdict[1].toUpperCase() === "BENAR") markedCorrect.push(codeAnswer);
    choices.push({ codeAnswer, reason });
  }

  const answerKeyDoubt = (fields.KUNCI_MERAGUKAN ?? "").toLowerCase().startsWith("ya");
  const answerKeyDoubtNote = isPlaceholder(fields.CATATAN_KUNCI)
    ? null
    : fields.CATATAN_KUNCI;

  if (markedCorrect.length !== 1) {
    problems.push(`harus tepat satu pilihan BENAR, ditemukan ${markedCorrect.length}`);
  } else if (markedCorrect[0] !== question.questionAnswer && !answerKeyDoubt) {
    problems.push(
      `menandai pilihan ${markedCorrect[0]} benar padahal kunci ${question.questionAnswer}, ` +
        "tanpa KUNCI_MERAGUKAN: ya",
    );
  }
  if (answerKeyDoubt && !answerKeyDoubtNote) {
    problems.push("KUNCI_MERAGUKAN: ya tetapi CATATAN_KUNCI kosong");
  }

  const markupTarget = [summary, detail, fields.TERJEMAHAN ?? "", ...choices.map((choice) => choice.reason)]
    .join("\n");
  problems.push(...markupProblems(markupTarget));
  if (problems.length > 0) return { problems };

  const candidate = {
    summary,
    detail,
    translation: isPlaceholder(fields.TERJEMAHAN) ? null : fields.TERJEMAHAN,
    keyPoints: isPlaceholder(fields.POIN)
      ? []
      : fields.POIN.split(";")
          .map((point) => point.trim())
          .filter(Boolean),
    choices,
    answerKeyDoubt,
    answerKeyDoubtNote,
  };
  const parsed = replyFieldsSchema.safeParse(candidate);
  if (!parsed.success) {
    return {
      problems: parsed.error.issues.map(
        (issue) => `${issue.path.length > 0 ? issue.path.join(".") : "$"}: ${issue.message}`,
      ),
    };
  }

  return { explanation: parsed.data, answerKeyDoubt };
}

export function buildQuestionImages({ question, context }) {
  return collectQuestionImages({ question, context });
}

export function buildInputSnapshot({ pkg, item, question, context, includeAudio }) {
  const images = buildQuestionImages({ question, context });
  return {
    packageName: pkg.name,
    jlptLevel: pkg.jlptLevel,
    mondaiType: item.mondaiType,
    instruction: item.instruction ?? null,
    questionOrder: question.order,
    questionText: question.questionText,
    questionAnswer: question.questionAnswer,
    questionChoices: [...question.questionChoices]
      .sort((a, b) => a.codeAnswer - b.codeAnswer)
      .map((choice) => ({
        codeAnswer: choice.codeAnswer,
        answerText: choice.answerText,
        answerImage: choice.answerImage ?? null,
      })),
    transcript: question.audioTranscript?.text ?? null,
    transcriptReviewedAt: question.audioTranscript?.meta.reviewedAt ?? null,
    contextText: context?.storyText ?? null,
    imageUrls: images.map((image) => ({ label: image.label, url: image.url })),
    includeAudio,
    audioUrl: includeAudio ? (question.questionAudio ?? context?.storyAudio ?? null) : null,
  };
}

export function hashInputSnapshot(snapshot) {
  return createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
}

export function validateQuestionContext({ item, question, context, includeAudio }) {
  const problems = [];
  if (!question.audioTranscript?.text?.trim()) problems.push("audioTranscript.text belum tersedia");
  if (!question.audioTranscript?.meta.reviewedAt) {
    problems.push("audioTranscript.meta.reviewedAt belum tersedia");
  }

  const images = buildQuestionImages({ question, context });
  if (item.mondaiType === "CHOUKAI_EXPRESSION" && images.length === 0) {
    problems.push("CHOUKAI_EXPRESSION wajib memiliki gambar soal/context");
  }
  if (includeAudio && !(question.questionAudio ?? context?.storyAudio)) {
    problems.push("mode --include-audio dipilih tetapi URL audio tidak tersedia");
  }
  return problems;
}

export function buildUserPrompt({ pkg, item, question, context, images, includeAudio }) {
  const snapshot = buildInputSnapshot({ pkg, item, question, context, includeAudio });
  const lines = [
    `Level: JLPT ${pkg.jlptLevel}`,
    `Paket: ${pkg.name}`,
    `Mondai: ${item.mondaiType}`,
    `Panduan mondai: ${MONDAI_GUIDANCE[item.mondaiType] ?? "Jelaskan bukti penentu jawaban."}`,
  ];

  if (item.instruction) lines.push(`Instruksi mondai: ${item.instruction}`);
  if (context?.storyText) lines.push("", "Konteks teks fixture:", context.storyText);

  lines.push(
    "",
    `Soal nomor ${question.order}:`,
    question.questionText || "(pertanyaan tertulis kosong; gunakan pertanyaan/situasi di transkrip)",
    "",
    "Transkrip audio yang sudah direview (sumber utama, jangan diubah):",
    question.audioTranscript.text,
    "",
    "Metadata pilihan fixture:",
  );

  for (const choice of snapshot.questionChoices) {
    const imageNote = choice.answerImage ? " [memiliki gambar pilihan]" : "";
    lines.push(`${choice.codeAnswer}. ${choice.answerText || "(teks kosong)"}${imageNote}`);
  }

  lines.push("", `Kunci jawaban resmi: ${question.questionAnswer}`);
  if (images.length > 0) {
    lines.push(
      "",
      `Gambar dilampirkan dan wajib dipakai: ${images.map((image) => image.label).join(", ")}.`,
    );
  }
  lines.push(
    "",
    includeAudio
      ? "Audio per soal juga dilampirkan sebagai bukti sekunder karena soal ini sedang dieskalasikan."
      : "Audio tidak dilampirkan. Transkrip reviewed di atas sudah menjadi representasi utama audio.",
  );

  return lines.join("\n");
}

export function buildRetryPrompt(problems) {
  return (
    `Keluaran tadi belum valid: ${problems.join("; ")}. ` +
    "Tulis ulang seluruh jawaban dari awal dengan seluruh label, tepat satu pilihan BENAR, dan markup Jepang yang benar."
  );
}
