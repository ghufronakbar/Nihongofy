// Normalize identity-only sources into Bunpou point fixtures: video text
// indexes (text-sources/) and patterns tested by JLPT questions but missing from
// the catalog (gap-sources/). This stage creates point identities and source
// evidence; publishable content is still produced by generate-bunpou-content.mjs.

import OpenAI from "openai";
import { z } from "zod";
import {
  LEVELS,
  bunpouPointSchema,
  loadTaxonomy,
  pointIdentityProblems,
  readAllPointFiles,
  readGapSources,
  readTextSources,
  writePointFile,
} from "./bunpou-data.mjs";
import { buildCatalogIndex, explanationOf, lookupCandidates, questionId } from "./bunpou-links.mjs";
import {
  GAP_PROMPT_VERSION,
  PROMPT_VERSION,
  buildGapImportUserPrompt,
  buildTextImportRetryPrompt,
  buildTextImportSystemPrompt,
  buildTextImportUserPrompt,
  parseTextImportReply,
} from "./bunpou-text-import-prompt.mjs";
import { stripJapaneseMarkup } from "./japanese-markup-check.mjs";
import { loadAndValidateSeedFiles } from "./test-package-fixture.mjs";

const REQUEST_TIMEOUT_MS = 300_000;
const SDK_MAX_RETRIES = 4;
const MAX_ATTEMPTS = 3;
const MAX_BATCH_SIZE = 10;
const MAX_CONCURRENCY = 12;
const USER_AGENT = "nihongofy/1.0";

const envSchema = z.object({
  EXPLANATION_BASE_URL: z.url(),
  EXPLANATION_API_KEY: z.string().trim().min(1),
  EXPLANATION_MODEL: z.string().trim().min(1),
  BUNPOU_MODEL: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().trim().min(1).optional(),
  ),
});

function log(message) {
  console.log(`[bunpou:import-text] ${message}`);
}

function parseArguments(argv) {
  const options = {
    source: null,
    level: null,
    days: [],
    keys: [],
    limit: Infinity,
    batchSize: 4,
    concurrency: 3,
    overwrite: false,
    dryRun: false,
    reasoningEffort: "high",
  };
  const readValue = (argument, name, index) =>
    argument.startsWith(`${name}=`) ? argument.slice(name.length + 1) : argv[index + 1];

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const consumesNext = !argument.includes("=");
    if (argument === "--overwrite") options.overwrite = true;
    else if (argument === "--dry-run") options.dryRun = true;
    else if (argument.startsWith("--source")) {
      const value = readValue(argument, "--source", index);
      if (!value || value.startsWith("--")) throw new Error("--source membutuhkan key source");
      options.source = value;
      if (consumesNext) index += 1;
    } else if (argument.startsWith("--level")) {
      const value = readValue(argument, "--level", index)?.toUpperCase();
      if (!LEVELS.includes(value)) throw new Error(`--level harus salah satu dari ${LEVELS.join(", ")}`);
      options.level = value;
      if (consumesNext) index += 1;
    } else if (argument.startsWith("--day")) {
      const value = Number(readValue(argument, "--day", index));
      if (!Number.isInteger(value) || value < 1) throw new Error("--day harus bilangan bulat > 0");
      options.days.push(value);
      if (consumesNext) index += 1;
    } else if (argument.startsWith("--key")) {
      const value = readValue(argument, "--key", index);
      if (!value || value.startsWith("--")) throw new Error("--key membutuhkan key item source");
      options.keys.push(value);
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
    } else throw new Error(`argumen tidak dikenal: ${argument}`);
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

const EXISTING_LIMIT = 10;

function flattenSource(source) {
  if (source.kind === "jlpt-gap") {
    return source.items.map((item, itemIndex) => ({ ...item, sourceKey: source.key, sourcePosition: itemIndex }));
  }
  return source.days.flatMap((day) =>
    day.items.map((item, itemIndex) => ({
      ...item,
      day: day.day,
      timestampSeconds: day.timestampSeconds,
      sourceKey: source.key,
      sourcePosition: day.day * 100 + itemIndex,
    })),
  );
}

function referenceIdentity(sourceKey, itemKey) {
  return `${sourceKey}:${itemKey}`;
}

function pointHasReference(point, identity) {
  return point.source.references.some(
    (reference) => referenceIdentity(reference.sourceKey, reference.itemKey) === identity,
  );
}

function uniqueKey(proposed, level, usedKeys, owners, replaceIdentity) {
  const owner = owners.get(proposed);
  if (!usedKeys.has(proposed) || (owner && pointHasReference(owner, replaceIdentity))) return proposed;

  const suffix = level.toLowerCase();
  const base = proposed.endsWith(`-${suffix}`) ? proposed : `${proposed}-${suffix}`;
  let candidate = base;
  let counter = 2;
  while (usedKeys.has(candidate) && !pointHasReference(owners.get(candidate) ?? { source: { references: [] } }, replaceIdentity)) {
    candidate = `${base}-${counter}`;
    counter += 1;
  }
  return candidate;
}

function sourcePositions(textSources) {
  const positions = new Map();
  let position = 0;
  for (const source of textSources) {
    if (source.kind === "jlpt-gap") continue;
    for (const item of flattenSource(source)) {
      positions.set(referenceIdentity(source.key, item.key), position);
      position += 1;
    }
  }
  return positions;
}

function recomputeOrders(file, positions) {
  const positionOf = (point) => {
    for (const reference of point.source.references) {
      const position = positions.get(referenceIdentity(reference.sourceKey, reference.itemKey));
      if (position != null) return position;
    }
    return Number.MAX_SAFE_INTEGER;
  };
  file.points.sort((left, right) => positionOf(left) - positionOf(right) || left.order - right.order);
  file.points.forEach((point, index) => {
    point.order = index + 1;
  });
}

function validateCandidates({ source, item, candidates, level, taxonomy, usedKeys, owners }) {
  const problems = [];
  const points = [];
  const localKeys = new Set();
  const identity = referenceIdentity(source.key, item.key);
  const extractedAt = new Date().toISOString();

  candidates.forEach((candidate, index) => {
    const key = uniqueKey(candidate.key, level, usedKeys, owners, identity);
    if (localKeys.has(key)) {
      problems.push(`points[${index}].key: key ganda setelah normalisasi: ${key}`);
      return;
    }
    localKeys.add(key);
    const point = {
      key,
      order: index + 1,
      kind: candidate.kind,
      sectionKey: candidate.sectionKey,
      family: candidate.family,
      title: candidate.title,
      source: {
        slides: [],
        references: [{ type: source.kind, sourceKey: source.key, itemKey: item.key }],
        ...candidate.source,
      },
      extract: {
        model: "pending",
        promptVersion: source.kind === "jlpt-gap" ? GAP_PROMPT_VERSION : PROMPT_VERSION,
        extractedAt,
        doubt: candidate.doubt,
      },
      content: null,
      ai: null,
      review: null,
    };
    const parsed = bunpouPointSchema.safeParse(point);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      problems.push(`points[${index}].${issue?.path.join(".") || "root"}: ${issue?.message}`);
      return;
    }
    const identityProblems = pointIdentityProblems(level, parsed.data, taxonomy);
    if (identityProblems.length > 0) {
      problems.push(...identityProblems.map((problem) => `points[${index}]: ${problem}`));
      return;
    }
    points.push(parsed.data);
  });
  return { problems, points };
}

function userPromptFor(source, items) {
  return source.kind === "jlpt-gap" ? buildGapImportUserPrompt(source, items) : buildTextImportUserPrompt(source, items);
}

function plain(value) {
  return value ? stripJapaneseMarkup(value).trim() : null;
}

/**
 * Bukti soal dan entri katalog mirip untuk item gap. Soal yang tidak ditemukan
 * di fixture paket adalah error, karena bukti adalah inti item gap.
 */
function enrichGapItems(source, items, packages, index) {
  return items.map((item) => ({
    ...item,
    evidenceQuestions: item.evidence.map(({ package: packageFile, mondaiType, order }) => {
      const pkg = packages.get(packageFile);
      const question = pkg?.testPackageItems
        .find((entry) => entry.mondaiType === mondaiType)
        ?.questions.find((entry) => entry.order === order);
      if (!question) {
        throw new Error(`${source.key}:${item.key}: soal ${packageFile} ${questionId(mondaiType, order)} tidak ditemukan`);
      }
      const context = question.questionContextRef
        ? pkg.questionContexts?.find((entry) => entry.id === question.questionContextRef)
        : null;
      return {
        package: `${pkg.name} (${pkg.jlptLevel})`,
        passage: plain(context?.storyText),
        question: plain(question.questionText),
        choices: Object.fromEntries(question.questionChoices.map((choice) => [choice.codeAnswer, plain(choice.answerText)])),
        answer: question.questionAnswer,
        summary: plain(explanationOf(question)?.summary),
      };
    }),
    existing: lookupCandidates(index, { form: item.raw, reading: item.raw }, source.level)
      .slice(0, EXISTING_LIMIT)
      .map((key) => {
        const point = index.points.get(key);
        return { key, level: point.level, title: point.title, senseLabel: point.senseLabel, meaning: point.meaningId };
      }),
  }));
}

async function importBatch({ client, model, reasoningEffort, systemPrompt, source, items, taxonomy, usedKeys, owners }) {
  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPromptFor(source, items) },
  ];
  const pending = new Map(items.map((item) => [item.key, item]));
  const results = new Map();
  const lastProblems = new Map();
  const usage = { input: 0, output: 0 };
  let attempts = 0;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS && pending.size > 0; attempt += 1) {
    attempts = attempt;
    const completion = await client.chat.completions.create({
      model,
      messages,
      reasoning_effort: reasoningEffort,
    });
    const reply = completion.choices?.[0]?.message?.content ?? "";
    usage.input += completion.usage?.prompt_tokens ?? 0;
    usage.output += completion.usage?.completion_tokens ?? 0;
    const parsed = parseTextImportReply(reply);

    for (const [itemKey, item] of pending) {
      let problems;
      let points = [];
      if (parsed.error) problems = [parsed.error];
      else if (!parsed.items.has(itemKey)) problems = ["item tidak ada di keluaran"];
      else {
        const validation = validateCandidates({
          source,
          item,
          candidates: parsed.items.get(itemKey),
          level: source.level,
          taxonomy,
          usedKeys,
          owners,
        });
        problems = validation.problems;
        points = validation.points;
      }
      if (problems.length === 0) {
        results.set(itemKey, { points, attempt });
        pending.delete(itemKey);
      } else lastProblems.set(itemKey, problems);
    }

    if (pending.size > 0 && attempt < MAX_ATTEMPTS) {
      const failures = [...pending.keys()].map((itemKey) => ({
        itemKey,
        problems: lastProblems.get(itemKey) ?? [],
      }));
      messages.push(
        { role: "assistant", content: reply },
        { role: "user", content: buildTextImportRetryPrompt(failures) },
      );
    }
  }

  return {
    results,
    failures: [...pending.keys()].map((itemKey) => ({
      itemKey,
      problems: lastProblems.get(itemKey) ?? [],
    })),
    usage,
    attempts,
  };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const taxonomy = await loadTaxonomy();
  const textSources = [
    ...(await readTextSources()).map((source) => ({ ...source, kind: "video-description" })),
    ...(await readGapSources()).map((source) => ({ ...source, kind: "jlpt-gap" })),
  ];
  const sourceKeys = new Set();
  for (const source of textSources) {
    if (sourceKeys.has(source.key)) throw new Error(`key source ganda antara text-sources dan gap-sources: ${source.key}`);
    sourceKeys.add(source.key);
  }
  const files = await readAllPointFiles();
  const selectedSources = textSources.filter(
    (source) => (!options.source || source.key === options.source) && (!options.level || source.level === options.level),
  );
  if (selectedSources.length === 0) throw new Error("source yang cocok tidak ditemukan");

  let packages = new Map();
  let catalogIndex = null;
  if (selectedSources.some((source) => source.kind === "jlpt-gap")) {
    const { seedFiles, errors } = await loadAndValidateSeedFiles(null);
    if (errors.length > 0) throw new Error(`fixture paket tidak valid: ${errors[0].file} ${errors[0].message}`);
    packages = new Map(seedFiles.map(({ file, pkg }) => [file.slice(0, -".json".length), pkg]));
    catalogIndex = buildCatalogIndex(files);
  }

  let env = null;
  if (!options.dryRun) {
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
      const missing = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
      throw new Error(`environment belum lengkap: ${missing} (lihat .env.example)`);
    }
    env = parsed.data;
  }
  const model = env ? (env.BUNPOU_MODEL ?? env.EXPLANATION_MODEL) : "(dry-run)";
  const client = env
    ? new OpenAI({
        apiKey: env.EXPLANATION_API_KEY,
        baseURL: env.EXPLANATION_BASE_URL,
        timeout: REQUEST_TIMEOUT_MS,
        maxRetries: SDK_MAX_RETRIES,
        defaultHeaders: { "User-Agent": USER_AGENT },
      })
    : null;

  const usedKeys = new Set();
  const owners = new Map();
  for (const file of files.values()) {
    for (const point of file.points) {
      usedKeys.add(point.key);
      owners.set(point.key, point);
    }
  }

  const systemPrompts = {
    "video-description": buildTextImportSystemPrompt(taxonomy, "video-description"),
    "jlpt-gap": buildTextImportSystemPrompt(taxonomy, "jlpt-gap"),
  };
  const tasks = [];
  let remaining = options.limit;
  for (const source of selectedSources) {
    const file = files.get(source.level);
    const existingReferences = new Set(
      file.points.flatMap((point) =>
        point.source.references.map((reference) => referenceIdentity(reference.sourceKey, reference.itemKey)),
      ),
    );
    const selected = flattenSource(source)
      .filter((item) => options.days.length === 0 || options.days.includes(item.day))
      .filter((item) => options.keys.length === 0 || options.keys.includes(item.key))
      .filter((item) => options.overwrite || !existingReferences.has(referenceIdentity(source.key, item.key)))
      .slice(0, remaining);
    remaining -= selected.length;
    const prepared = source.kind === "jlpt-gap" ? enrichGapItems(source, selected, packages, catalogIndex) : selected;
    const batches = chunk(prepared, options.batchSize);
    log(`${source.key}: ${selected.length} item dalam ${batches.length} batch`);
    batches.forEach((items, index) => tasks.push({ source, file, items, label: `${source.key}#${index + 1}` }));
  }

  if (tasks.length === 0) {
    log("tidak ada item source yang perlu diimpor");
    return;
  }
  if (options.dryRun) {
    const { source, items } = tasks[0];
    log(`DRY-RUN system prompt (${source.kind}):\n${systemPrompts[source.kind]}\n---`);
    log(`DRY-RUN prompt batch pertama:\n${userPromptFor(source, items)}\n---`);
    return;
  }

  const positions = sourcePositions(textSources);
  const writers = new Map();
  for (const source of selectedSources) writers.set(source.level, Promise.resolve());
  const persist = (file) => {
    const current = writers.get(file.level) ?? Promise.resolve();
    const next = current.then(() => writePointFile(file));
    writers.set(file.level, next);
    return next;
  };

  const summary = { items: 0, points: 0, failed: 0, doubts: 0, recovered: 0, input: 0, output: 0 };
  let processed = 0;
  const total = tasks.reduce((sum, task) => sum + task.items.length, 0);
  await runPool(tasks, options.concurrency, async (task) => {
    try {
      const result = await importBatch({
        client,
        model,
        reasoningEffort: options.reasoningEffort,
        systemPrompt: systemPrompts[task.source.kind],
        source: task.source,
        items: task.items,
        taxonomy,
        usedKeys,
        owners,
      });
      summary.input += result.usage.input;
      summary.output += result.usage.output;
      for (const item of task.items) {
        const imported = result.results.get(item.key);
        if (!imported) continue;
        const identity = referenceIdentity(task.source.key, item.key);
        if (options.overwrite) {
          task.file.points = task.file.points.filter((point) => !pointHasReference(point, identity));
        }
        // Point gap tidak punya posisi di sumber berurutan, jadi diletakkan di
        // akhir level; point teks diurutkan ulang lewat posisi sumbernya.
        const base = task.source.kind === "jlpt-gap" ? Math.max(0, ...task.file.points.map((point) => point.order)) : 0;
        imported.points.forEach((point, index) => {
          point.key = uniqueKey(point.key, task.source.level, usedKeys, owners, identity);
          point.order = base + index + 1;
          point.extract.model = model;
          task.file.points.push(point);
          usedKeys.add(point.key);
          owners.set(point.key, point);
          if (point.extract.doubt) summary.doubts += 1;
        });
        summary.items += 1;
        summary.points += imported.points.length;
        if (imported.attempt > 1) summary.recovered += 1;
      }
      summary.failed += result.failures.length;
      if (result.results.size > 0) {
        recomputeOrders(task.file, positions);
        await persist(task.file);
      }
      processed += task.items.length;
      log(
        `OK ${task.label}: ${result.results.size}/${task.items.length} item, ` +
          `${result.attempts} percobaan [${processed}/${total}]`,
      );
      for (const failure of result.failures) {
        log(`  FAIL ${failure.itemKey}: ${failure.problems.join("; ")}`);
      }
    } catch (error) {
      processed += task.items.length;
      summary.failed += task.items.length;
      log(`FAIL ${task.label}: ${error.message} [${processed}/${total}]`);
    }
  });

  await Promise.all(writers.values());
  log(
    `DONE: ${summary.items} item menjadi ${summary.points} point, ${summary.recovered} lolos setelah retry, ` +
      `${summary.failed} gagal, ${summary.doubts} doubt, ${summary.input}/${summary.output} token`,
  );
  if (summary.failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("[bunpou:import-text] gagal", error);
  process.exitCode = 1;
});
