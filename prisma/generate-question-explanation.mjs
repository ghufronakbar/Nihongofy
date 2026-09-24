// Generator pembahasan soal: membaca fixture di src/test-package-data/, meminta
// pembahasan ke model bahasa satu soal per permintaan, lalu menulis hasilnya
// kembali ke file JSON yang sama. Script ini TIDAK menyentuh database sama
// sekali — impor ke database dilakukan terpisah oleh
// prisma/seed-question-explanation.mjs.
//
// Soal CHOUKAI dilewati secara bawaan: fixture hanya menyimpan URL audio tanpa
// transkrip, jadi model tidak punya bahan apa pun dan hanya akan mengarang.
// Pakai --include-choukai bila transkrip sudah tersedia di storyText.
import fs from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";
import { z } from "zod";
import {
  assertSafeFileName,
  formatZodIssue,
  JLPT_LEVELS,
  MONDAI_TYPES,
  SEED_DATA_DIR,
  seedTestPackageSchema,
} from "./test-package-fixture.mjs";
import {
  buildUserPrompt,
  collectQuestionImages,
  PROMPT_VERSION,
  SYSTEM_PROMPT,
} from "./explanation-prompt.mjs";

const REQUEST_TIMEOUT_MS = 300_000;
const SDK_MAX_RETRIES = 2;
const MAX_ATTEMPTS = 2;
// Gateway menolak User-Agent bawaan SDK OpenAI dengan 403. Lihat catatan di
// src/features/conversation/lib/provider/openai.ts.
const USER_AGENT = "tanoshii-japanese/1.0";

const envSchema = z.object({
  EXPLANATION_BASE_URL: z.url(),
  EXPLANATION_API_KEY: z.string().trim().min(1),
  EXPLANATION_MODEL: z.string().trim().min(1),
  // Opsional. Soal bergambar hanya diproses bila model ini diisi; tanpa itu
  // soal tersebut dilewati, bukan dijelaskan tanpa melihat gambarnya.
  EXPLANATION_VISION_MODEL: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().trim().min(1).optional(),
  ),
});

function log(message) {
  console.log(`[gen:explanation] ${message}`);
}

function parseArguments(argv) {
  const options = {
    selectedFile: null,
    level: null,
    mondai: null,
    limit: Infinity,
    concurrency: 1,
    overwrite: false,
    onlyDoubts: false,
    onlyImages: false,
    includeChoukai: false,
    dryRun: false,
    reasoningEffort: null,
  };

  const readValue = (argument, prefix, index) =>
    argument.startsWith(`${prefix}=`) ? argument.slice(prefix.length + 1) : argv[index + 1];

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const consumesNext = !argument.includes("=");

    if (argument === "--overwrite") {
      options.overwrite = true;
      continue;
    }
    if (argument === "--only-doubts") {
      options.onlyDoubts = true;
      continue;
    }
    if (argument === "--only-images") {
      options.onlyImages = true;
      continue;
    }
    if (argument === "--include-choukai") {
      options.includeChoukai = true;
      continue;
    }
    if (argument === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (argument.startsWith("--file")) {
      const value = readValue(argument, "--file", index);
      if (!value || value.startsWith("--")) throw new Error("--file membutuhkan nama file *.json");
      options.selectedFile = assertSafeFileName(value);
      if (consumesNext) index += 1;
      continue;
    }

    if (argument.startsWith("--level")) {
      const value = readValue(argument, "--level", index);
      const level = value?.toUpperCase();
      if (!level || !JLPT_LEVELS.includes(level)) {
        throw new Error(`--level harus salah satu dari ${JLPT_LEVELS.join(", ")}`);
      }
      options.level = level;
      if (consumesNext) index += 1;
      continue;
    }

    if (argument.startsWith("--mondai")) {
      const value = readValue(argument, "--mondai", index);
      const mondai = value?.toUpperCase();
      if (!mondai || !MONDAI_TYPES.includes(mondai)) {
        throw new Error(`--mondai tidak dikenal: ${value}`);
      }
      options.mondai = mondai;
      if (consumesNext) index += 1;
      continue;
    }

    if (argument.startsWith("--reasoning-effort")) {
      const value = readValue(argument, "--reasoning-effort", index)?.toLowerCase();
      if (!value || !["minimal", "low", "medium", "high"].includes(value)) {
        throw new Error("--reasoning-effort harus minimal|low|medium|high");
      }
      options.reasoningEffort = value;
      if (consumesNext) index += 1;
      continue;
    }

    if (argument.startsWith("--limit")) {
      const value = Number(readValue(argument, "--limit", index));
      if (!Number.isInteger(value) || value < 1) throw new Error("--limit harus bilangan bulat > 0");
      options.limit = value;
      if (consumesNext) index += 1;
      continue;
    }

    if (argument.startsWith("--concurrency")) {
      const value = Number(readValue(argument, "--concurrency", index));
      if (!Number.isInteger(value) || value < 1 || value > 16) {
        throw new Error("--concurrency harus bilangan bulat 1-16");
      }
      options.concurrency = value;
      if (consumesNext) index += 1;
      continue;
    }

    throw new Error(`argumen tidak dikenal: ${argument}`);
  }

  return options;
}

// ---------------------------------------------------------------------------
// Parsing & validasi jawaban model
// ---------------------------------------------------------------------------

const LABEL_PATTERN =
  /^(RINGKASAN|PEMBAHASAN|TERJEMAHAN|POIN|PILIHAN [1-4]|KUNCI_MERAGUKAN|CATATAN_KUNCI)\s*:\s*(.*)$/;

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

  const result = {};
  for (const [label, lines] of fields) {
    result[label] = lines.join("\n").trim();
  }
  return result;
}

function isPlaceholder(value) {
  return !value || value === "-" || value === "—";
}

// Markup teks Jepang punya arti khusus di renderer (docs/text-parser.md), jadi
// keluaran yang melanggarnya dianggap gagal dan diminta ulang, bukan disimpan
// lalu merusak tampilan soal.
function markupProblems(text) {
  const problems = [];
  if (/<\/?[a-z][a-z0-9-]*(\s[^>]*)?>/i.test(text)) problems.push("mengandung tag HTML");
  if (/\*\*/.test(text)) problems.push("memakai markdown **tebal**");
  if (/^#{1,6}\s/m.test(text)) problems.push("memakai judul markdown #");

  const underlineCount = (text.match(/__/g) ?? []).length;
  if (underlineCount % 2 !== 0) problems.push("penanda __ tidak berpasangan");

  const openBraces = (text.match(/\{/g) ?? []).length;
  const closeBraces = (text.match(/\}/g) ?? []).length;
  const validFurigana = (text.match(/\{[^{}|]+\|[^{}|]+\}/g) ?? []).length;
  if (openBraces !== closeBraces || openBraces !== validFurigana) {
    // Pesan yang menunjuk potongan bermasalah, bukan sekadar menyatakan formatnya
    // salah: tanpa itu percobaan ulang kerap mengulangi kesalahan yang sama.
    const broken = (text.match(/\{[^{}]*\}/g) ?? []).filter(
      (group) => !/^\{[^{}|]+\|[^{}|]+\}$/.test(group),
    );
    const detail =
      broken.length > 0
        ? `perbaiki menjadi {漢字|かんじ}: ${broken.slice(0, 3).join(", ")}`
        : `kurung kurawal tidak berpasangan (${openBraces} buka, ${closeBraces} tutup)`;
    problems.push(`format furigana salah — ${detail}`);
  }

  // Kanji di luar blok furigana tidak terbaca pelajar level bawah. Aturan ini
  // yang paling sering dilanggar model saat menyebut istilah seperti 訓読み.
  const redundant = [...text.matchAll(/\{([^{}|]+)\|[^{}|]+\}/g)]
    .filter((m) => !/[\u4E00-\u9FFF]/.test(m[1]))
    .map((m) => m[0]);
  if (redundant.length > 0) {
    problems.push(
      `furigana hanya untuk kanji, hapus dari: ${[...new Set(redundant)].slice(0, 4).join(", ")}`,
    );
  }

  const bareKanji = [
    ...new Set(text.replace(/\{[^{}|]+\|[^{}|]+\}/g, "").match(/[\u4E00-\u9FFF]/g) ?? []),
  ];
  if (bareKanji.length > 0) {
    problems.push(`kanji tanpa furigana: ${bareKanji.slice(0, 8).join("")}`);
  }

  return problems;
}

function buildExplanation(reply, question) {
  const problems = [];
  const fields = parseLabelledReply(reply);

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
  const answerKeyDoubtNote = isPlaceholder(fields.CATATAN_KUNCI) ? null : fields.CATATAN_KUNCI;

  if (markedCorrect.length !== 1) {
    problems.push(`harus tepat satu pilihan BENAR, ditemukan ${markedCorrect.length}`);
  } else if (markedCorrect[0] !== question.questionAnswer && !answerKeyDoubt) {
    // Model boleh tidak setuju dengan kunci, tetapi harus menyatakannya lewat
    // KUNCI_MERAGUKAN supaya bisa ditinjau manusia — bukan diam-diam menandai
    // pilihan lain sebagai benar.
    problems.push(
      `menandai pilihan ${markedCorrect[0]} benar padahal kunci ${question.questionAnswer}, ` +
        "tanpa KUNCI_MERAGUKAN: ya",
    );
  }

  if (answerKeyDoubt && !answerKeyDoubtNote) {
    problems.push("KUNCI_MERAGUKAN: ya tetapi CATATAN_KUNCI kosong");
  }

  const markupTarget = [summary, detail, fields.TERJEMAHAN ?? "", ...choices.map((c) => c.reason)]
    .join("\n");
  problems.push(...markupProblems(markupTarget));

  if (problems.length > 0) return { problems };

  const keyPoints = isPlaceholder(fields.POIN)
    ? []
    : fields.POIN.split(";")
        .map((point) => point.trim())
        .filter(Boolean);

  return {
    explanation: {
      summary,
      detail,
      translation: isPlaceholder(fields.TERJEMAHAN) ? null : fields.TERJEMAHAN,
      keyPoints,
      choices,
      answerKeyDoubt,
      answerKeyDoubtNote,
    },
    answerKeyDoubt,
  };
}

// ---------------------------------------------------------------------------
// Pemanggilan model
// ---------------------------------------------------------------------------

function createClient(env) {
  return new OpenAI({
    apiKey: env.EXPLANATION_API_KEY,
    baseURL: env.EXPLANATION_BASE_URL,
    timeout: REQUEST_TIMEOUT_MS,
    maxRetries: SDK_MAX_RETRIES,
    defaultHeaders: { "User-Agent": USER_AGENT },
  });
}

async function generateExplanation({
  client,
  model,
  reasoningEffort,
  pkg,
  item,
  question,
  context,
  images = [],
  hasVision = false,
}) {
  const userPrompt = buildUserPrompt({ pkg, item, question, context, images, hasVision });

  // Gambar dikirim sebagai bagian pesan multimodal; tanpa vision, prompt tetap
  // teks biasa dan sudah memuat peringatan bahwa gambarnya tidak terlihat.
  const userContent =
    hasVision && images.length > 0
      ? [
          { type: "text", text: userPrompt },
          ...images.map((image) => ({ type: "image_url", image_url: { url: image.url } })),
        ]
      : userPrompt;

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userContent },
  ];

  let lastProblems = [];
  let usage = { input: 0, output: 0 };

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    // Parameter hanya dikirim bila diminta: model non-reasoning menolak
    // permintaan yang memuat field yang tidak dikenalnya.
    const completion = await client.chat.completions.create({
      model,
      messages,
      ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
    });
    const reply = completion.choices?.[0]?.message?.content ?? "";
    usage = {
      input: usage.input + (completion.usage?.prompt_tokens ?? 0),
      output: usage.output + (completion.usage?.completion_tokens ?? 0),
    };

    const parsed = buildExplanation(reply, question);
    if (parsed.explanation) {
      return { ...parsed, usage, attempts: attempt };
    }

    lastProblems = parsed.problems;
    if (attempt < MAX_ATTEMPTS) {
      messages.push(
        { role: "assistant", content: reply },
        {
          role: "user",
          content:
            `Keluaran tadi belum memenuhi format: ${lastProblems.join("; ")}. ` +
            "Tulis ulang seluruh jawaban dari awal dengan label yang lengkap dan aturan markup yang benar.",
        },
      );
    }
  }

  return { problems: lastProblems, usage, attempts: MAX_ATTEMPTS };
}

// ---------------------------------------------------------------------------
// Orkestrasi file
// ---------------------------------------------------------------------------

async function listFixtureFiles(selectedFile) {
  const entries = await fs.readdir(SEED_DATA_DIR);
  const jsonFiles = entries.filter((name) => name.endsWith(".json")).sort();

  if (!selectedFile) return jsonFiles;
  if (!jsonFiles.includes(selectedFile)) {
    throw new Error(`file tidak ditemukan di ${SEED_DATA_DIR}: ${selectedFile}`);
  }
  return [selectedFile];
}

function selectQuestions(pkg, options) {
  const contexts = new Map((pkg.questionContexts ?? []).map((context) => [context.id, context]));
  const tasks = [];
  const withoutContent = [];

  for (const item of pkg.testPackageItems) {
    if (!options.includeChoukai && item.section === "CHOUKAI") continue;
    if (options.mondai && item.mondaiType !== options.mondai) continue;

    for (const question of item.questions) {
      // Menyasar ulang soal yang kuncinya ditandai meragukan: berguna setelah
      // data soalnya diperbaiki, karena --limit menghitung dari soal pertama
      // sehingga tidak bisa menunjuk satu nomor di tengah mondai.
      if (options.onlyImages) {
        // penyaringan gambar sudah dilakukan di atas; abaikan status pembahasan
      } else if (options.onlyDoubts) {
        const explanation = question.explanation;
        if (!explanation || typeof explanation === "string" || !explanation.answerKeyDoubt) continue;
      } else if (question.explanation && !options.overwrite) {
        continue;
      }
      const context = question.questionContextRef
        ? contexts.get(question.questionContextRef)
        : null;

      // Menyasar ulang soal bergambar saja: berguna setelah model vision
      // tersedia, karena pembahasan lama ditulis tanpa melihat gambarnya.
      if (options.onlyImages && collectQuestionImages({ question, context }).length === 0) continue;

      // Tanpa stem maupun bacaan, model tidak punya bahan apa pun: yang keluar
      // hanyalah terkaan dari empat pilihan. Gambar tidak dihitung sebagai
      // bahan karena model ini hanya membaca teks. Soal seperti ini dilewati
      // dan dilaporkan sebagai cacat data, bukan dibuatkan pembahasan karangan.
      if (!(question.questionText ?? "").trim() && !(context?.storyText ?? "").trim()) {
        withoutContent.push(`${item.mondaiType}#${question.order}`);
        continue;
      }

      tasks.push({ item, question, context });
    }
  }

  return { tasks, withoutContent };
}

async function writeFixture(file, pkg) {
  // Fixture divalidasi sebelum ditulis supaya kegagalan model tidak pernah
  // meninggalkan file yang tidak bisa diimpor.
  const validation = seedTestPackageSchema.safeParse(pkg);
  if (!validation.success) {
    const issues = validation.error.issues.slice(0, 5).map(formatZodIssue).join("; ");
    throw new Error(`fixture tidak valid setelah generate, file tidak ditulis: ${issues}`);
  }

  // Tulis ke file sementara lalu rename: rename dalam satu direktori bersifat
  // atomik, sehingga proses yang dihentikan di tengah penulisan tidak pernah
  // meninggalkan fixture yang terpotong.
  const target = path.join(SEED_DATA_DIR, file);
  const temporary = `${target}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(pkg, null, 2)}\n`, "utf-8");
  await fs.rename(temporary, target);
}

// Pool sederhana: beberapa permintaan berjalan bersamaan, tetapi penulisan file
// hanya terjadi setelah satu mondai selesai agar file tidak pernah setengah jadi.
async function runPool(tasks, concurrency, worker) {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(concurrency, tasks.length) }, async () => {
    while (cursor < tasks.length) {
      const index = cursor++;
      await worker(tasks[index]);
    }
  });
  await Promise.all(runners);
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const files = await listFixtureFiles(options.selectedFile);

  // Saat dry-run environment tetap dibaca bila tersedia, supaya prompt yang
  // dicetak sama persis dengan yang akan dikirim — termasuk soal bergambar yang
  // perlakuannya bergantung pada ada tidaknya model vision.
  const env = options.dryRun
    ? (envSchema.safeParse(process.env).data ?? null)
    : (() => {
        const parsed = envSchema.safeParse(process.env);
        if (!parsed.success) {
          const missing = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
          throw new Error(`environment belum lengkap: ${missing} (lihat .env.example)`);
        }
        return parsed.data;
      })();

  const client = env ? createClient(env) : null;
  const summary = {
    generated: 0,
    failed: 0,
    skipped: 0,
    withoutContent: 0,
    needVision: 0,
    answerKeyDoubts: [],
    inputTokens: 0,
    outputTokens: 0,
  };
  let budget = options.limit;

  for (const file of files) {
    if (budget <= 0) break;

    const raw = await fs.readFile(path.join(SEED_DATA_DIR, file), "utf-8");
    if (!raw.trim()) continue;

    const pkg = JSON.parse(raw);
    if (options.level && pkg.jlptLevel !== options.level) continue;

    const { tasks, withoutContent } = selectQuestions(pkg, options);

    if (withoutContent.length > 0) {
      summary.withoutContent += withoutContent.length;
      log(
        `SKIP ${file} - ${withoutContent.length} soal tanpa stem dan tanpa bacaan: ` +
          `${withoutContent.join(", ")}`,
      );
    }

    if (tasks.length === 0) continue;

    const scope = options.onlyImages
      ? "soal bergambar"
      : options.onlyDoubts
        ? "soal bertanda kunci meragukan"
        : options.overwrite
          ? "soal akan ditulis ulang"
          : "soal tanpa pembahasan";
    log(`FILE ${file} (${pkg.name}) - ${tasks.length} ${scope}`);

    // Dikelompokkan per mondai supaya file ditulis di batas yang rapi dan
    // proses bisa dihentikan kapan saja tanpa kehilangan hasil.
    const byMondai = new Map();
    for (const task of tasks) {
      if (!byMondai.has(task.item.mondaiType)) byMondai.set(task.item.mondaiType, []);
      byMondai.get(task.item.mondaiType).push(task);
    }

    for (const [mondaiType, mondaiTasks] of byMondai) {
      if (budget <= 0) break;

      const batch = mondaiTasks.slice(0, budget);
      budget -= batch.length;
      let written = 0;

      await runPool(batch, options.concurrency, async ({ item, question, context }) => {
        const label = `${file.replace(".json", "")} ${mondaiType}#${question.order}`;
        const images = collectQuestionImages({ question, context });
        const visionModel = env?.EXPLANATION_VISION_MODEL;
        const hasVision = images.length > 0 && Boolean(visionModel);

        if (options.dryRun) {
          log(
            `DRY-RUN ${label}\n--- prompt ---\n` +
              `${buildUserPrompt({ pkg, item, question, context, images, hasVision })}\n---`,
          );
          summary.skipped += 1;
          return;
        }

        // Tanpa model vision, soal bergambar dilewati: pembahasannya hanya akan
        // menyimpulkan dari kunci jawaban, persis kesalahan yang ingin dihindari.
        if (images.length > 0 && !visionModel) {
          summary.needVision += 1;
          log(
            `SKIP ${label} - punya ${images.length} gambar (${images.map((i) => i.label).join(", ")}); ` +
              "isi EXPLANATION_VISION_MODEL untuk memprosesnya",
          );
          return;
        }

        const model = hasVision ? visionModel : env.EXPLANATION_MODEL;
        const startedAt = Date.now();
        try {
          const result = await generateExplanation({
            client,
            model,
            reasoningEffort: options.reasoningEffort,
            pkg,
            item,
            question,
            context,
            images,
            hasVision,
          });

          summary.inputTokens += result.usage.input;
          summary.outputTokens += result.usage.output;

          if (!result.explanation) {
            summary.failed += 1;
            log(`FAIL ${label} - ${result.problems.join("; ")}`);
            return;
          }

          question.explanation = {
            ...result.explanation,
            meta: {
              source: "AI",
              aiModel: model,
              promptVersion: PROMPT_VERSION,
              generatedAt: new Date().toISOString(),
            },
          };
          written += 1;
          summary.generated += 1;

          if (result.answerKeyDoubt) {
            summary.answerKeyDoubts.push(label);
            log(`DOUBT ${label} - ${question.explanation.answerKeyDoubtNote}`);
          }

          const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
          log(
            `OK ${label} - ${seconds}s, ${result.attempts} percobaan, ` +
              `${result.usage.input}/${result.usage.output} token` +
              (hasVision ? ` [vision: ${images.length} gambar]` : ""),
          );
        } catch (error) {
          summary.failed += 1;
          const message = error instanceof Error ? error.message : String(error);
          log(`FAIL ${label} - ${message}`);
        }
      });

      if (written > 0) {
        await writeFixture(file, pkg);
        log(`WRITE ${file} - ${written} pembahasan pada ${mondaiType}`);
      }
    }
  }

  log(
    `DONE - ${summary.generated} pembahasan dibuat, ${summary.failed} gagal, ` +
      `${summary.withoutContent} dilewati karena datanya tidak lengkap, ` +
      `${summary.needVision} menunggu model vision, ` +
      `${summary.answerKeyDoubts.length} kunci diragukan, ` +
      `${summary.inputTokens}/${summary.outputTokens} token`,
  );
  if (summary.answerKeyDoubts.length > 0) {
    log(`KUNCI DIRAGUKAN: ${summary.answerKeyDoubts.join(", ")}`);
  }
  if (summary.failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("[gen:explanation] gagal", error);
  process.exitCode = 1;
});
