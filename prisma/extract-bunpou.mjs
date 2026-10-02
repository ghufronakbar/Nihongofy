// Extract Bunpou identities and source evidence from raw slide images.
// This script never touches the database; generated fixtures are reviewed and
// enriched by generate-bunpou-content.mjs before seeding.

import OpenAI from "openai";
import { z } from "zod";
import {
  LEVELS,
  bunpouPointSchema,
  contextSlidesBeforeBatch,
  discoverRawDecks,
  fileToDataUrl,
  loadTaxonomy,
  mergeDoubts,
  mergeUniqueStrings,
  readAllPointFiles,
  readManifest,
  recomputePointOrders,
  sha256File,
  writeManifest,
  writePointFile,
} from "./bunpou-data.mjs";
import {
  PROMPT_VERSION,
  buildRetryPrompt,
  buildSystemPrompt,
  buildUserPrompt,
  parseExtractionReply,
} from "./bunpou-extract-prompt.mjs";

const REQUEST_TIMEOUT_MS = 300_000;
const SDK_MAX_RETRIES = 4;
const MAX_ATTEMPTS = 3;
const MAX_BATCH_SIZE = 10;
const MAX_CONTEXT_SIZE = 10;
const MAX_CONCURRENCY = 8;
const USER_AGENT = "nihongofy/1.0";

const optionalEnvString = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().min(1).optional(),
);

const envSchema = z.object({
  EXPLANATION_BASE_URL: z.url(),
  EXPLANATION_API_KEY: z.string().trim().min(1),
  BUNPOU_EXTRACT_MODEL: optionalEnvString,
  EXPLANATION_VISION_MODEL: optionalEnvString,
});

function log(message) {
  console.log(`[bunpou:extract] ${message}`);
}

function parseArguments(argv) {
  const options = {
    level: null,
    deck: null,
    limit: Infinity,
    batchSize: 6,
    contextSize: 0,
    concurrency: 4,
    dryRun: false,
    reasoningEffort: "high",
  };
  const readValue = (argument, name, index) =>
    argument.startsWith(`${name}=`) ? argument.slice(name.length + 1) : argv[index + 1];

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const consumesNext = !argument.includes("=");
    if (argument === "--dry-run") {
      options.dryRun = true;
    } else if (argument.startsWith("--level")) {
      const value = readValue(argument, "--level", index)?.toUpperCase();
      if (!LEVELS.includes(value)) throw new Error(`--level harus salah satu dari ${LEVELS.join(", ")}`);
      options.level = value;
      if (consumesNext) index += 1;
    } else if (argument.startsWith("--deck")) {
      const value = readValue(argument, "--deck", index);
      if (!value || value.startsWith("--")) throw new Error("--deck membutuhkan nama deck");
      options.deck = value;
      if (consumesNext) index += 1;
    } else if (argument.startsWith("--limit")) {
      const value = Number(readValue(argument, "--limit", index));
      if (!Number.isInteger(value) || value < 1) throw new Error("--limit harus bilangan bulat > 0");
      options.limit = value;
      if (consumesNext) index += 1;
    } else if (argument.startsWith("--batch-size")) {
      const value = Number(readValue(argument, "--batch-size", index));
      if (!Number.isInteger(value) || value < 1 || value > MAX_BATCH_SIZE) {
        throw new Error(`--batch-size harus bilangan bulat 1-${MAX_BATCH_SIZE}`);
      }
      options.batchSize = value;
      if (consumesNext) index += 1;
    } else if (argument.startsWith("--context-size")) {
      const value = Number(readValue(argument, "--context-size", index));
      if (!Number.isInteger(value) || value < 0 || value > MAX_CONTEXT_SIZE) {
        throw new Error(`--context-size harus bilangan bulat 0-${MAX_CONTEXT_SIZE}`);
      }
      options.contextSize = value;
      if (consumesNext) index += 1;
    } else if (argument.startsWith("--concurrency")) {
      const value = Number(readValue(argument, "--concurrency", index));
      if (!Number.isInteger(value) || value < 1 || value > MAX_CONCURRENCY) {
        throw new Error(`--concurrency harus bilangan bulat 1-${MAX_CONCURRENCY}`);
      }
      options.concurrency = value;
      if (consumesNext) index += 1;
    } else if (argument.startsWith("--reasoning-effort")) {
      const value = readValue(argument, "--reasoning-effort", index)?.toLowerCase();
      if (!["minimal", "low", "medium", "high"].includes(value)) {
        throw new Error("--reasoning-effort harus minimal|low|medium|high");
      }
      options.reasoningEffort = value;
      if (consumesNext) index += 1;
    } else {
      throw new Error(`argumen tidak dikenal: ${argument}`);
    }
  }
  return options;
}

function chunk(items, size) {
  const result = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

async function runPool(items, concurrency, worker) {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      await worker(items[index], index);
    }
  });
  await Promise.all(runners);
}

function pointIndex(pointFiles) {
  const index = new Map();
  for (const [level, file] of pointFiles) {
    for (const point of file.points) index.set(point.key, { level, point });
  }
  return index;
}

function existingDeckPoints(deck, manifest, pointsByKey) {
  const keys = new Set(
    manifest.slides.filter((slide) => slide.deck === deck).flatMap((slide) => slide.points),
  );
  return [...keys]
    .map((key) => pointsByKey.get(key)?.point)
    .filter(Boolean)
    .map((point) => ({
      key: point.key,
      kind: point.kind,
      sectionKey: point.sectionKey,
      family: point.family,
      title: point.title,
      meaning: point.source.meaning,
      slides: point.source.slides,
    }));
}

function extractionProblems(value, batch, taxonomy, pointsByKey, level) {
  const problems = [];
  const expectedPaths = new Set(batch.map((slide) => slide.path));
  const returnedPaths = new Set();
  const returnedPoints = new Map();

  for (const point of value.points) {
    if (returnedPoints.has(point.key)) problems.push(`point key ganda: ${point.key}`);
    returnedPoints.set(point.key, point);
    if (!taxonomy.sectionByKey.has(point.sectionKey)) {
      problems.push(`${point.key}: sectionKey "${point.sectionKey}" tidak dikenal`);
    }
    if (point.title.includes("{") || point.title.includes("__") || point.title.includes("\n")) {
      problems.push(`${point.key}: title harus teks polos satu baris`);
    }
    if (point.family === point.key) problems.push(`${point.key}: family tidak boleh sama dengan key`);
    for (const sourcePath of point.source.slides) {
      if (!expectedPaths.has(sourcePath)) problems.push(`${point.key}: source slide di luar batch: ${sourcePath}`);
    }
    const known = pointsByKey.get(point.key);
    if (known && known.level !== level) {
      problems.push(`${point.key}: key sudah dipakai di ${known.level}, tidak boleh dibuat ulang di ${level}`);
    }
  }

  for (const slide of value.slides) {
    if (!expectedPaths.has(slide.path)) problems.push(`path slide tidak diminta: ${slide.path}`);
    if (returnedPaths.has(slide.path)) problems.push(`path slide ganda: ${slide.path}`);
    returnedPaths.add(slide.path);
    if (slide.skipped && slide.pointKeys.length > 0) {
      problems.push(`${slide.path}: skipped tetapi pointKeys tidak kosong`);
    }
    if (!slide.skipped && slide.pointKeys.length === 0) {
      problems.push(`${slide.path}: bukan skipped tetapi pointKeys kosong`);
    }
    for (const key of slide.pointKeys) {
      if (!returnedPoints.has(key)) problems.push(`${slide.path}: point ${key} tidak ada di points`);
    }
  }
  for (const expected of expectedPaths) {
    if (!returnedPaths.has(expected)) problems.push(`slide tidak ada di keluaran: ${expected}`);
  }
  return problems;
}

async function extractBatch({ client, model, reasoningEffort, systemPrompt, taxonomy, level, deck, contextSlides, batch, existing, pointsByKey }) {
  const userPrompt = buildUserPrompt({
    level,
    deck,
    contextSlides,
    slides: batch,
    existingPoints: existing,
  });
  const userContent = [
    { type: "text", text: userPrompt },
    ...(await Promise.all(
      [...contextSlides, ...batch].map(async (slide) => ({
        type: "image_url",
        image_url: { url: await fileToDataUrl(slide.absolutePath, slide.extension) },
      })),
    )),
  ];
  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userContent },
  ];
  let lastProblems = [];
  const usage = { input: 0, output: 0 };

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const completion = await client.chat.completions.create({
      model,
      messages,
      reasoning_effort: reasoningEffort,
    });
    const reply = completion.choices?.[0]?.message?.content ?? "";
    usage.input += completion.usage?.prompt_tokens ?? 0;
    usage.output += completion.usage?.completion_tokens ?? 0;
    const parsed = parseExtractionReply(reply);
    lastProblems = parsed.error
      ? [parsed.error]
      : extractionProblems(parsed.value, batch, taxonomy, pointsByKey, level);
    if (!parsed.error && lastProblems.length === 0) {
      return { value: parsed.value, attempts: attempt, usage };
    }
    if (attempt < MAX_ATTEMPTS) {
      messages.push(
        { role: "assistant", content: reply },
        { role: "user", content: buildRetryPrompt(lastProblems) },
      );
    }
  }
  return { problems: lastProblems, attempts: MAX_ATTEMPTS, usage };
}

function mergeText(left, right) {
  return mergeUniqueStrings(left ? left.split("\n") : [], right ? right.split("\n") : []).join("\n");
}

function mergeFormation(left, right) {
  const rows = new Map();
  for (const row of [...left, ...right]) rows.set(JSON.stringify(row), row);
  return [...rows.values()];
}

function mergeExtractedPoint({ extracted, level, model, extractedAt, pointFiles, pointsByKey }) {
  const known = pointsByKey.get(extracted.key);
  if (!known) {
    const file = pointFiles.get(level);
    const point = {
      key: extracted.key,
      order: file.points.length + 1,
      kind: extracted.kind,
      sectionKey: extracted.sectionKey,
      family: extracted.family,
      title: extracted.title,
      source: extracted.source,
      extract: {
        model,
        promptVersion: PROMPT_VERSION,
        extractedAt,
        doubt: extracted.doubt,
      },
      content: null,
      ai: null,
      review: null,
    };
    const parsed = bunpouPointSchema.safeParse(point);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new Error(`${extracted.key}: ${issue?.path.join(".")}: ${issue?.message}`);
    }
    file.points.push(point);
    pointsByKey.set(point.key, { level, point });
    return;
  }

  const point = known.point;
  const identityChanges = [];
  for (const field of ["kind", "sectionKey", "family", "title"]) {
    if (point[field] !== extracted[field]) {
      identityChanges.push(`${field} existing=${JSON.stringify(point[field])} baru=${JSON.stringify(extracted[field])}`);
    }
  }
  point.source = {
    slides: mergeUniqueStrings(point.source.slides, extracted.source.slides),
    title: mergeText(point.source.title, extracted.source.title),
    meaning: mergeText(point.source.meaning, extracted.source.meaning),
    connection: mergeText(point.source.connection, extracted.source.connection),
    formation: mergeFormation(point.source.formation, extracted.source.formation),
    notes: mergeText(point.source.notes, extracted.source.notes),
    examples: mergeUniqueStrings(point.source.examples, extracted.source.examples),
  };
  point.extract = {
    model,
    promptVersion: PROMPT_VERSION,
    extractedAt,
    doubt: mergeDoubts(
      point.extract.doubt,
      mergeDoubts(extracted.doubt, identityChanges.length > 0 ? `identitas berbeda: ${identityChanges.join(", ")}` : null),
    ),
  };
  point.content = null;
  point.ai = null;
  point.review = null;
}

function ensureDeckManifest(manifest, deck) {
  let existing = manifest.decks.find((item) => item.key === deck.key);
  if (existing) return existing;
  const lastOrder = Math.max(
    0,
    ...manifest.decks.filter((item) => item.level === deck.level).map((item) => item.order),
  );
  existing = { key: deck.key, level: deck.level, order: lastOrder + 1 };
  manifest.decks.push(existing);
  return existing;
}

async function persistCatalog(pointFiles, manifest) {
  recomputePointOrders(pointFiles, manifest);
  for (const level of LEVELS) await writePointFile(pointFiles.get(level));
  await writeManifest(manifest);
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const taxonomy = await loadTaxonomy();
  const systemPrompt = buildSystemPrompt(taxonomy);
  const pointFiles = await readAllPointFiles();
  const pointsByKey = pointIndex(pointFiles);
  const manifest = await readManifest();
  let decks = await discoverRawDecks();

  if (options.level) decks = decks.filter((deck) => deck.level === options.level);
  if (options.deck) decks = decks.filter((deck) => deck.key === options.deck);
  if (options.deck && decks.length === 0) throw new Error(`deck tidak ditemukan: ${options.deck}`);

  const byHash = new Map(manifest.slides.map((slide) => [slide.sha256, slide]));
  const byPath = new Map(manifest.slides.map((slide) => [slide.path, slide]));
  const jobs = [];
  let budget = options.limit;
  let manifestChanged = false;

  for (const deck of decks) {
    ensureDeckManifest(manifest, deck);
    const pending = [];
    for (const file of deck.files) {
      const sha256 = await sha256File(file.absolutePath);
      const sameHash = byHash.get(sha256);
      if (sameHash) {
        if (sameHash.level !== deck.level) {
          throw new Error(`${file.path}: file identik sudah tercatat di level ${sameHash.level}`);
        }
        if (sameHash.path !== file.path) {
          const oldPath = sameHash.path;
          sameHash.path = file.path;
          sameHash.deck = deck.key;
          sameHash.sequence = file.sequence;
          for (const { point } of pointsByKey.values()) {
            point.source.slides = point.source.slides.map((value) => (value === oldPath ? file.path : value));
          }
          manifestChanged = true;
        }
        continue;
      }
      if (byPath.has(file.path)) {
        throw new Error(
          `${file.path}: isi file berubah sejak ekstraksi. Hapus catatan slide dan evidence terkait secara manual sebelum mengulang.`,
        );
      }
      if (budget <= 0) continue;
      pending.push({ ...file, sha256 });
      budget -= 1;
    }
    if (pending.length > 0) jobs.push({ deck, batches: chunk(pending, options.batchSize) });
  }

  if (options.dryRun) {
    log(`${jobs.reduce((sum, job) => sum + job.batches.flat().length, 0)} slide belum diekstraksi`);
    const exampleJob = jobs[0];
    const exampleBatchIndex = options.contextSize > 0 && exampleJob?.batches.length > 1 ? 1 : 0;
    const exampleBatch = exampleJob?.batches[exampleBatchIndex];
    if (exampleBatch) {
      log(`DRY-RUN system prompt (${PROMPT_VERSION}):\n${systemPrompt}\n---`);
      log(
        `DRY-RUN prompt contoh batch:\n${buildUserPrompt({
          level: exampleJob.deck.level,
          deck: exampleJob.deck.key,
          contextSlides: contextSlidesBeforeBatch(
            exampleJob.deck.files,
            exampleBatch,
            options.contextSize,
          ),
          slides: exampleBatch,
          existingPoints: existingDeckPoints(exampleJob.deck.key, manifest, pointsByKey),
        })}\n---`,
      );
    }
    return;
  }

  const envResult = envSchema.safeParse(process.env);
  if (!envResult.success) {
    const missing = envResult.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`environment belum lengkap: ${missing} (lihat .env.example)`);
  }
  const env = envResult.data;
  const model = env.BUNPOU_EXTRACT_MODEL ?? env.EXPLANATION_VISION_MODEL;
  if (!model) throw new Error("BUNPOU_EXTRACT_MODEL atau EXPLANATION_VISION_MODEL wajib diisi");
  const client = new OpenAI({
    apiKey: env.EXPLANATION_API_KEY,
    baseURL: env.EXPLANATION_BASE_URL,
    timeout: REQUEST_TIMEOUT_MS,
    maxRetries: SDK_MAX_RETRIES,
    defaultHeaders: { "User-Agent": USER_AGENT },
  });

  if (manifestChanged) await persistCatalog(pointFiles, manifest);
  if (jobs.length === 0) {
    log("tidak ada slide baru");
    return;
  }

  let commitQueue = Promise.resolve();
  let processed = 0;
  let failed = 0;
  const total = jobs.reduce((sum, job) => sum + job.batches.flat().length, 0);
  const usage = { input: 0, output: 0 };

  await runPool(jobs, options.concurrency, async ({ deck, batches }) => {
    for (const batch of batches) {
      const existing = existingDeckPoints(deck.key, manifest, pointsByKey);
      const contextSlides = contextSlidesBeforeBatch(deck.files, batch, options.contextSize);
      try {
        const result = await extractBatch({
          client,
          model,
          reasoningEffort: options.reasoningEffort,
          systemPrompt,
          taxonomy,
          level: deck.level,
          deck: deck.key,
          contextSlides,
          batch,
          existing,
          pointsByKey,
        });
        usage.input += result.usage.input;
        usage.output += result.usage.output;
        if (!result.value) {
          failed += batch.length;
          log(`FAIL ${deck.key} ${batch[0].sequence}-${batch.at(-1).sequence}: ${result.problems.join("; ")}`);
          continue;
        }

        commitQueue = commitQueue.then(async () => {
          const extractedAt = new Date().toISOString();
          for (const point of result.value.points) {
            mergeExtractedPoint({
              extracted: point,
              level: deck.level,
              model,
              extractedAt,
              pointFiles,
              pointsByKey,
            });
          }
          for (const extractedSlide of result.value.slides) {
            const source = batch.find((slide) => slide.path === extractedSlide.path);
            manifest.slides.push({
              path: source.path,
              sha256: source.sha256,
              level: deck.level,
              deck: deck.key,
              sequence: source.sequence,
              points: extractedSlide.pointKeys,
              skipped: extractedSlide.skipped,
              model,
              promptVersion: PROMPT_VERSION,
              extractedAt,
            });
          }
          await persistCatalog(pointFiles, manifest);
        });
        await commitQueue;
        processed += batch.length;
        log(
          `OK ${deck.key} ${batch[0].sequence}-${batch.at(-1).sequence}: ` +
            `${result.value.points.length} point, ${result.attempts} percobaan [${processed}/${total}]`,
        );
      } catch (error) {
        failed += batch.length;
        log(`FAIL ${deck.key} ${batch[0].sequence}-${batch.at(-1).sequence}: ${error.message}`);
      }
    }
  });

  await commitQueue;
  log(`DONE: ${processed} slide tersimpan, ${failed} gagal, ${usage.input}/${usage.output} token`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("[bunpou:extract] gagal", error);
  process.exitCode = 1;
});
