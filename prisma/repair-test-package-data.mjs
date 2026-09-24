// Perbaikan data soal yang cacat, dibantu model bahasa.
//
// Urutan kerjanya sengaja bertingkat, dari yang paling dapat dipercaya ke yang
// paling perlu diawasi:
//
//   1. Perbaikan deterministik (konversi penanda slot 文の組み立て). Tidak
//      memanggil model sama sekali.
//   2. Perbaikan dengan model, hanya untuk cacat yang tersisa. Data asli
//      dipertahankan; model hanya menambal bagian yang rusak.
//   3. Verifikasi independen: model lain mengerjakan soal hasil perbaikan tanpa
//      diberi kunci. Perbaikan hanya ditulis bila jawabannya cocok dengan kunci.
//
// Sasarannya gabungan dua sumber: error dari `fixture:lint` (deterministik) dan
// soal bertanda `answerKeyDoubt` dari generator pembahasan (hasil penilaian
// model). Soal yang ternyata sudah benar akan lolos verifikasi apa adanya dan
// dibiarkan — penanda ragu yang salah tuduh tersaring di sini.
import fs from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";
import { z } from "zod";
import {
  assertSafeFileName,
  formatZodIssue,
  JLPT_LEVELS,
  SEED_DATA_DIR,
  seedTestPackageSchema,
} from "./test-package-fixture.mjs";
import {
  checkQuestion,
  clozeNumber,
  crossQuestionDefects,
  findBareClozeNumber,
  hasClozeMarker,
  normalizeSlotMarkers,
  stripOcrArtifacts,
  stripRedundantFurigana,
} from "./fixture-checks.mjs";
import {
  buildRepairPrompt,
  buildSolverPrompt,
  REPAIR_PROMPT_VERSION,
  REPAIR_SYSTEM_PROMPT,
  SOLVER_SYSTEM_PROMPT,
} from "./repair-prompt.mjs";

const REQUEST_TIMEOUT_MS = 300_000;
const SDK_MAX_RETRIES = 2;
const MAX_ATTEMPTS = 2;
const USER_AGENT = "tanoshii-japanese/1.0";

const envSchema = z.object({
  EXPLANATION_BASE_URL: z.url(),
  EXPLANATION_API_KEY: z.string().trim().min(1),
  EXPLANATION_MODEL: z.string().trim().min(1),
});

function log(message) {
  console.log(`[fixture:repair] ${message}`);
}

function parseArguments(argv) {
  const options = {
    selectedFile: null,
    level: null,
    limit: Infinity,
    dryRun: false,
    deterministicOnly: false,
    reasoningEffort: null,
    keepExplanation: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const consumesNext = !argument.includes("=");
    const readValue = (prefix) =>
      argument.startsWith(`${prefix}=`) ? argument.slice(prefix.length + 1) : argv[index + 1];

    if (argument === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (argument === "--deterministic-only") {
      options.deterministicOnly = true;
      continue;
    }
    if (argument === "--keep-explanation") {
      options.keepExplanation = true;
      continue;
    }

    if (argument.startsWith("--file")) {
      const value = readValue("--file");
      if (!value || value.startsWith("--")) throw new Error("--file membutuhkan nama file *.json");
      options.selectedFile = assertSafeFileName(value);
      if (consumesNext) index += 1;
      continue;
    }

    if (argument.startsWith("--level")) {
      const value = readValue("--level")?.toUpperCase();
      if (!value || !JLPT_LEVELS.includes(value)) {
        throw new Error(`--level harus salah satu dari ${JLPT_LEVELS.join(", ")}`);
      }
      options.level = value;
      if (consumesNext) index += 1;
      continue;
    }

    if (argument.startsWith("--limit")) {
      const value = Number(readValue("--limit"));
      if (!Number.isInteger(value) || value < 1) throw new Error("--limit harus bilangan bulat > 0");
      options.limit = value;
      if (consumesNext) index += 1;
      continue;
    }

    if (argument.startsWith("--reasoning-effort")) {
      const value = readValue("--reasoning-effort")?.toLowerCase();
      if (!value || !["minimal", "low", "medium", "high"].includes(value)) {
        throw new Error("--reasoning-effort harus minimal|low|medium|high");
      }
      options.reasoningEffort = value;
      if (consumesNext) index += 1;
      continue;
    }

    throw new Error(`argumen tidak dikenal: ${argument}`);
  }

  return options;
}

const REPAIR_LABELS =
  /^(TINDAKAN|ALASAN|STEM|BACAAN|PILIHAN [1-4]|KUNCI|PERUBAHAN|JAWABAN)\s*:\s*(.*)$/;

function parseLabelledReply(raw) {
  const trimmed = raw.trim().replace(/^```[a-z]*\n?/i, "").replace(/```$/, "");
  const fields = new Map();
  let current = null;

  for (const line of trimmed.split("\n")) {
    const match = line.match(REPAIR_LABELS);
    if (match) {
      current = match[1];
      fields.set(current, [match[2]]);
      continue;
    }
    if (current) fields.get(current).push(line);
  }

  const result = {};
  for (const [label, lines] of fields) result[label] = lines.join("\n").trim();
  return result;
}

function isPlaceholder(value) {
  return !value || value === "-" || value === "—";
}

// Terapkan patch ke salinan soal, lalu jalankan pemeriksaan deterministik yang
// sama seperti fixture:lint. Patch yang masih menyisakan error ditolak.
function buildPatchedQuestion({ item, question, fields }) {
  const problems = [];
  const action = (fields.TINDAKAN ?? "").toLowerCase();

  if (action.startsWith("tidak-bisa")) {
    return { giveUp: true, reason: fields.ALASAN ?? "(tanpa alasan)" };
  }
  if (!action.startsWith("perbaiki") && !action.startsWith("tulis-ulang")) {
    problems.push(`TINDAKAN tidak dikenal: ${fields.TINDAKAN ?? "(kosong)"}`);
  }

  const stem = fields.STEM ?? "";
  if (!stem) problems.push("STEM kosong");

  const choices = [];
  for (const codeAnswer of [1, 2, 3, 4]) {
    const text = fields[`PILIHAN ${codeAnswer}`];
    if (!text) {
      problems.push(`PILIHAN ${codeAnswer} tidak ada`);
      continue;
    }
    const original = question.questionChoices.find((c) => c.codeAnswer === codeAnswer);
    choices.push({
      codeAnswer,
      answerText: text,
      answerImage: original?.answerImage ?? null,
    });
  }

  const questionAnswer = Number(fields.KUNCI);
  if (!Number.isInteger(questionAnswer) || questionAnswer < 1 || questionAnswer > 4) {
    problems.push(`KUNCI tidak sah: ${fields.KUNCI ?? "(kosong)"}`);
  }

  if (problems.length > 0) return { problems };

  const patched = { ...question, questionText: stem, questionChoices: choices, questionAnswer };
  const storyText = isPlaceholder(fields.BACAAN) ? null : fields.BACAAN;

  const remaining = checkQuestion({
    item,
    question: patched,
    context: storyText ? { storyText } : null,
  }).filter((problem) => problem.level === "error");

  if (remaining.length > 0) {
    return { problems: remaining.map((problem) => `hasil perbaikan masih cacat: ${problem.message}`) };
  }

  return {
    patched,
    storyText,
    action,
    reason: fields.ALASAN ?? "",
    changes: fields.PERUBAHAN ?? "",
  };
}

function createClient(env) {
  return new OpenAI({
    apiKey: env.EXPLANATION_API_KEY,
    baseURL: env.EXPLANATION_BASE_URL,
    timeout: REQUEST_TIMEOUT_MS,
    maxRetries: SDK_MAX_RETRIES,
    defaultHeaders: { "User-Agent": USER_AGENT },
  });
}

async function complete({ client, model, reasoningEffort, messages }) {
  const completion = await client.chat.completions.create({
    model,
    messages,
    ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
  });
  return completion.choices?.[0]?.message?.content ?? "";
}

async function solve({ client, model, reasoningEffort, pkg, item, question, context }) {
  const reply = await complete({
    client,
    model,
    reasoningEffort,
    messages: [
      { role: "system", content: SOLVER_SYSTEM_PROMPT },
      { role: "user", content: buildSolverPrompt({ pkg, item, question, context }) },
    ],
  });

  const answer = Number(parseLabelledReply(reply).JAWABAN);
  return Number.isInteger(answer) && answer >= 1 && answer <= 4 ? answer : null;
}

async function repairQuestion({ client, model, reasoningEffort, pkg, item, question, context, defects }) {
  const messages = [
    { role: "system", content: REPAIR_SYSTEM_PROMPT },
    { role: "user", content: buildRepairPrompt({ pkg, item, question, context, defects }) },
  ];

  let lastProblems = [];
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const reply = await complete({ client, model, reasoningEffort, messages });
    const result = buildPatchedQuestion({ item, question, fields: parseLabelledReply(reply) });

    if (result.giveUp || result.patched) return { ...result, attempts: attempt };

    lastProblems = result.problems;
    if (attempt < MAX_ATTEMPTS) {
      messages.push(
        { role: "assistant", content: reply },
        {
          role: "user",
          content: `Keluaran tadi belum memenuhi syarat: ${lastProblems.join("; ")}. Tulis ulang seluruh jawaban dari awal dengan format dan aturan yang benar.`,
        },
      );
    }
  }

  return { problems: lastProblems, attempts: MAX_ATTEMPTS };
}

// Sasaran perbaikan: error deterministik dari fixture:lint digabung dengan soal
// yang ditandai kuncinya meragukan oleh generator pembahasan.
function collectTargets(pkg) {
  const contexts = new Map((pkg.questionContexts ?? []).map((context) => [context.id, context]));
  const crossDefects = crossQuestionDefects(pkg);
  const targets = [];

  for (const item of pkg.testPackageItems) {
    if (item.section === "CHOUKAI") continue;

    for (const question of item.questions) {
      const context = question.questionContextRef ? contexts.get(question.questionContextRef) : null;
      const defects = [
        ...(crossDefects.get(`${item.mondaiType}#${question.order}`) ?? []),
        ...checkQuestion({ item, question, context })
          .filter((problem) => problem.level === "error")
          .map((problem) => problem.message),
      ];

      const explanation = question.explanation;
      if (explanation && typeof explanation === "object" && explanation.answerKeyDoubt) {
        defects.push(
          `kunci jawaban ditandai meragukan: ${explanation.answerKeyDoubtNote ?? "(tanpa catatan)"}`,
        );
      }

      if (defects.length > 0) targets.push({ item, question, context, defects });
    }
  }

  return targets;
}

function contextUsageCount(pkg, contextRef) {
  let count = 0;
  for (const item of pkg.testPackageItems) {
    for (const question of item.questions) {
      if (question.questionContextRef === contextRef) count += 1;
    }
  }
  return count;
}

async function writeFixture(file, pkg) {
  const validation = seedTestPackageSchema.safeParse(pkg);
  if (!validation.success) {
    const issues = validation.error.issues.slice(0, 5).map(formatZodIssue).join("; ");
    throw new Error(`fixture tidak valid setelah perbaikan, file tidak ditulis: ${issues}`);
  }

  const target = path.join(SEED_DATA_DIR, file);
  const temporary = `${target}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(pkg, null, 2)}\n`, "utf-8");
  await fs.rename(temporary, target);
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const entries = await fs.readdir(SEED_DATA_DIR);
  const files = (
    options.selectedFile ? [options.selectedFile] : entries.filter((name) => name.endsWith(".json"))
  ).sort();

  const needsModel = !options.deterministicOnly && !options.dryRun;
  let client = null;
  let env = null;

  if (needsModel) {
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
      throw new Error(
        `environment belum lengkap: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`,
      );
    }
    env = parsed.data;
    client = createClient(env);
  }

  const summary = {
    ocrCleaned: 0,
    furiganaCleaned: 0,
    clozeRestored: 0,
    slotNormalized: 0,
    repaired: 0,
    verifiedClean: 0,
    rejected: 0,
    giveUp: 0,
    failed: 0,
  };
  let budget = options.limit;

  for (const file of files) {
    const raw = await fs.readFile(path.join(SEED_DATA_DIR, file), "utf-8");
    if (!raw.trim()) continue;

    const pkg = JSON.parse(raw);
    if (options.level && pkg.jlptLevel !== options.level) continue;

    let dirty = false;

    // --- 1. perbaikan deterministik ---

    // Sisa OCR dibersihkan lebih dulu di seluruh kolom teks: polanya tetap, jadi
    // tidak perlu melibatkan model sama sekali.
    const scrub = (owner, field, label) => {
      const { text, changed } = stripOcrArtifacts(owner[field]);
      if (!changed) return;
      owner[field] = text;
      summary.ocrCleaned += 1;
      dirty = true;
      log(`OCR ${file} ${label} - sisa pemisah halaman/header naskah dibuang`);
    };

    for (const context of pkg.questionContexts ?? []) {
      scrub(context, "storyText", `context ${context.id}`);
    }

    for (const item of pkg.testPackageItems) {
      scrub(item, "instruction", `${item.mondaiType} instruksi`);
      for (const question of item.questions) {
        scrub(question, "questionText", `${item.mondaiType}#${question.order}`);
        for (const choice of question.questionChoices) {
          scrub(choice, "answerText", `${item.mondaiType}#${question.order} pilihan ${choice.codeAnswer}`);
        }
      }
    }

    // Furigana berlebih pada teks pembahasan.
    for (const item of pkg.testPackageItems) {
      for (const question of item.questions) {
        const explanation = question.explanation;
        if (!explanation || typeof explanation === "string") continue;

        const scrubField = (owner, field) => {
          const { text, changed } = stripRedundantFurigana(owner[field]);
          if (!changed) return false;
          owner[field] = text;
          return true;
        };

        let touched = false;
        for (const field of ["summary", "detail", "translation"]) {
          if (scrubField(explanation, field)) touched = true;
        }
        for (const choice of explanation.choices ?? []) {
          if (scrubField(choice, "reason")) touched = true;
        }
        if (explanation.keyPoints) {
          const before = explanation.keyPoints.join("\u001f");
          explanation.keyPoints = explanation.keyPoints.map(
            (point) => stripRedundantFurigana(point).text,
          );
          if (explanation.keyPoints.join("\u001f") !== before) touched = true;
        }

        if (touched) {
          summary.furiganaCleaned += 1;
          dirty = true;
        }
      }
    }

    // Rumpang 文章の文法 yang kehilangan pembatasnya: nomornya masih ada di
    // kalimat, hanya telanjang. Dipasangi ＿N＿ kembali bila nomor itu muncul
    // tepat sekali — selain itu diserahkan ke pemeriksaan manual.
    for (const item of pkg.testPackageItems) {
      if (item.mondaiType !== "BUNPOU_TEXT_GRAMMAR") continue;

      for (const question of item.questions) {
        const context = (pkg.questionContexts ?? []).find(
          (candidate) => candidate.id === question.questionContextRef,
        );
        if (!context?.storyText) continue;

        const number = clozeNumber(question);
        if (hasClozeMarker(context.storyText, number)) continue;

        const index = findBareClozeNumber(context.storyText, number);
        if (index === null) continue;

        context.storyText =
          context.storyText.slice(0, index) +
          `＿${number}＿` +
          context.storyText.slice(index + String(number).length);
        summary.clozeRestored += 1;
        dirty = true;
        log(`RUMPANG ${file} ${item.mondaiType}#${question.order} - penanda ＿${number}＿ dipasang`);
      }
    }

    for (const item of pkg.testPackageItems) {
      if (item.mondaiType !== "BUNPOU_SENTENCE_COMPOSITION") continue;
      for (const question of item.questions) {
        const { text, changed } = normalizeSlotMarkers(question.questionText);
        if (!changed) continue;
        question.questionText = text;
        summary.slotNormalized += 1;
        dirty = true;
        log(`SLOT ${file} ${item.mondaiType}#${question.order} - penanda slot dinormalkan`);
      }
    }

    // --- 2 & 3. perbaikan dengan model + verifikasi ---
    const targets = options.deterministicOnly ? [] : collectTargets(pkg);

    for (const target of targets) {
      if (budget <= 0) break;
      const { item, question, context, defects } = target;
      const label = `${file.replace(".json", "")} ${item.mondaiType}#${question.order}`;

      if (options.dryRun) {
        log(`DRY-RUN ${label}\n  cacat: ${defects.join(" | ")}`);
        continue;
      }

      budget -= 1;

      try {
        // Soal yang cacatnya hanya "kunci diragukan" diperiksa dulu apa adanya:
        // bila solver setuju dengan kunci resmi, datanya memang sudah benar dan
        // tidak perlu disentuh sama sekali.
        const onlyDoubt = defects.every((defect) => defect.startsWith("kunci jawaban ditandai"));
        if (onlyDoubt) {
          const answer = await solve({
            client,
            model: env.EXPLANATION_MODEL,
            reasoningEffort: options.reasoningEffort,
            pkg,
            item,
            question,
            context,
          });
          if (answer !== null && answer !== question.questionAnswer) {
            // Verifikator independen tidak setuju dengan kunci resmi. Itu bukti
            // yang harus ikut dipertimbangkan tahap perbaikan: tanpa ini, model
            // akan terus memaksakan pembenaran untuk kunci yang tidak dapat
            // dibela, lalu tambalannya ditolak verifikasi — berputar terus.
            defects.push(
              `verifikasi independen menjawab ${answer}, berbeda dari kunci resmi ` +
                `${question.questionAnswer}`,
            );
          }

          if (answer === question.questionAnswer) {
            // Tuduhan yang terbukti salah: penandanya dicabut, kalau tidak soal
            // ini akan terus muncul di daftar ragu setiap kali diperiksa.
            const explanation = question.explanation;
            explanation.answerKeyDoubt = false;
            delete explanation.answerKeyDoubtNote;
            explanation.meta = { ...(explanation.meta ?? {}), reviewedAt: new Date().toISOString() };

            summary.verifiedClean += 1;
            dirty = true;
            log(
              `OK ${label} - kunci ${question.questionAnswer} terverifikasi, data dibiarkan, ` +
                "penanda ragu dicabut",
            );
            continue;
          }
        }

        const result = await repairQuestion({
          client,
          model: env.EXPLANATION_MODEL,
          reasoningEffort: options.reasoningEffort,
          pkg,
          item,
          question,
          context,
          defects,
        });

        if (result.giveUp) {
          summary.giveUp += 1;
          log(`LEWAT ${label} - model menyatakan tidak bisa: ${result.reason}`);
          continue;
        }

        if (!result.patched) {
          summary.failed += 1;
          log(`GAGAL ${label} - ${result.problems.join("; ")}`);
          continue;
        }

        const verifyContext = result.storyText ? { storyText: result.storyText } : context;
        const answer = await solve({
          client,
          model: env.EXPLANATION_MODEL,
          reasoningEffort: options.reasoningEffort,
          pkg,
          item,
          question: result.patched,
          context: verifyContext,
        });

        if (answer !== result.patched.questionAnswer) {
          summary.rejected += 1;
          log(
            `TOLAK ${label} - verifikasi menjawab ${answer ?? "?"}, kunci hasil perbaikan ` +
              `${result.patched.questionAnswer}; data asli dibiarkan`,
          );
          continue;
        }

        question.questionText = result.patched.questionText;
        question.questionChoices = result.patched.questionChoices;
        question.questionAnswer = result.patched.questionAnswer;

        if (result.storyText) {
          const ref = question.questionContextRef;
          if (ref && contextUsageCount(pkg, ref) === 1) {
            const existing = (pkg.questionContexts ?? []).find((c) => c.id === ref);
            if (existing) existing.storyText = result.storyText;
          } else if (!ref) {
            const newRef = `ctx-repair-${item.mondaiType.toLowerCase()}-${question.order}`;
            pkg.questionContexts = pkg.questionContexts ?? [];
            pkg.questionContexts.push({ id: newRef, storyText: result.storyText });
            question.questionContextRef = newRef;
          } else {
            log(`  catatan: BACAAN diabaikan, context ${ref} dipakai beberapa soal`);
          }
        }

        // Pembahasan lama ditulis di atas data yang rusak, jadi tidak lagi
        // sahih. Dihapus supaya gen:explanation menulisnya ulang.
        if (!options.keepExplanation) delete question.explanation;

        summary.repaired += 1;
        dirty = true;
        log(`PERBAIKI ${label} - ${result.changes || result.reason}`);
      } catch (error) {
        summary.failed += 1;
        log(`GAGAL ${label} - ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    if (dirty) {
      await writeFixture(file, pkg);
      log(`TULIS ${file}`);
    }
  }

  log(
    `DONE (${REPAIR_PROMPT_VERSION}) - ${summary.ocrCleaned} sisa OCR dibersihkan, ` +
      `${summary.furiganaCleaned} pembahasan dirapikan furiganya, ` +
      `${summary.clozeRestored} rumpang dipulihkan, ${summary.slotNormalized} slot dinormalkan, ` +
      `${summary.repaired} soal diperbaiki, ` +
      `${summary.verifiedClean} sudah benar, ${summary.rejected} ditolak verifikasi, ` +
      `${summary.giveUp} tidak bisa, ${summary.failed} gagal`,
  );
  if (summary.failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("[fixture:repair] gagal", error);
  process.exitCode = 1;
});
