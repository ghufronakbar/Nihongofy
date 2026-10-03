// Generate publishable Bunpou content from extracted fixtures. This script is
// resumable: populated entries are skipped unless --overwrite is supplied.

import OpenAI from "openai";
import { z } from "zod";
import {
  LEVELS,
  bunpouContentProblems,
  loadTaxonomy,
  normalizeBunpouContent,
  normalizeTitle,
  readAllPointFiles,
  writePointFile,
} from "./bunpou-data.mjs";
import {
  PROMPT_VERSION,
  buildRetryPrompt,
  buildSystemPrompt,
  buildUserPrompt,
  parseContentReply,
} from "./bunpou-content-prompt.mjs";

const REQUEST_TIMEOUT_MS = 300_000;
const SDK_MAX_RETRIES = 4;
const MAX_ATTEMPTS = 3;
const MAX_BATCH_SIZE = 10;
const MAX_CONCURRENCY = 16;
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
  console.log(`[gen:bunpou] ${message}`);
}

function parseArguments(argv) {
  const options = {
    level: null,
    keys: [],
    limit: Infinity,
    batchSize: 5,
    concurrency: 4,
    overwrite: false,
    onlyDoubts: false,
    dryRun: false,
    reasoningEffort: "high",
  };
  const readValue = (argument, name, index) =>
    argument.startsWith(`${name}=`) ? argument.slice(name.length + 1) : argv[index + 1];

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const consumesNext = !argument.includes("=");
    if (argument === "--overwrite") options.overwrite = true;
    else if (argument === "--only-doubts") options.onlyDoubts = true;
    else if (argument === "--dry-run") options.dryRun = true;
    else if (argument.startsWith("--level")) {
      const value = readValue(argument, "--level", index)?.toUpperCase();
      if (!LEVELS.includes(value)) throw new Error(`--level harus salah satu dari ${LEVELS.join(", ")}`);
      options.level = value;
      if (consumesNext) index += 1;
    } else if (argument.startsWith("--key")) {
      const value = readValue(argument, "--key", index);
      if (!value || value.startsWith("--")) throw new Error("--key membutuhkan key point");
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
  if (options.onlyDoubts && !options.overwrite) {
    throw new Error("--only-doubts harus dipakai bersama --overwrite");
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
    while (cursor < items.length) await worker(items[cursor], cursor++);
  });
  await Promise.all(runners);
}

function relatedFor(point, allPoints) {
  const normalized = normalizeTitle(point.title);
  return allPoints
    .filter(
      (candidate) =>
        candidate.key !== point.key &&
        ((point.family && candidate.family === point.family) || normalizeTitle(candidate.title) === normalized),
    )
    .map((candidate) => ({
      key: candidate.key,
      level: candidate.level,
      title: candidate.title,
      senseLabel: candidate.content?.senseLabel ?? null,
      meaning: candidate.content?.meaningId ?? candidate.source.meaning,
    }));
}

function selectedPoints(file, options) {
  if (options.keys.length > 0) return file.points.filter((point) => options.keys.includes(point.key));
  if (options.onlyDoubts) return file.points.filter((point) => point.ai?.doubt);
  return options.overwrite ? file.points : file.points.filter((point) => !point.content);
}

async function generateBatch({ client, model, reasoningEffort, systemPrompt, taxonomy, level, items }) {
  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: buildUserPrompt(level, items) },
  ];
  const pending = new Map(items.map((item) => [item.point.key, item]));
  const results = new Map();
  const lastProblems = new Map();
  const retries = [];
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
    const parsed = parseContentReply(reply);

    for (const [key, item] of pending) {
      let problems;
      let generated = null;
      if (parsed.error) problems = [parsed.error];
      else if (!parsed.items.has(key)) problems = ["item tidak ada di keluaran"];
      else {
        generated = parsed.items.get(key);
        normalizeBunpouContent(generated.content);
        problems = bunpouContentProblems(item.point, generated.content, taxonomy, {
          doubt: generated.doubt,
          strictConnectionBoundary: true,
        });
      }
      if (problems.length === 0) {
        results.set(key, { ...generated, attempt });
        pending.delete(key);
      } else lastProblems.set(key, problems);
    }

    if (pending.size > 0 && attempt < MAX_ATTEMPTS) {
      const failures = [...pending.keys()].map((key) => ({ key, problems: lastProblems.get(key) ?? [] }));
      retries.push(...failures.map((failure) => ({ ...failure, attempt })));
      messages.push(
        { role: "assistant", content: reply },
        { role: "user", content: buildRetryPrompt(failures) },
      );
    }
  }
  return {
    results,
    failures: [...pending.keys()].map((key) => ({ key, problems: lastProblems.get(key) ?? [] })),
    retries,
    usage,
    attempts,
  };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const taxonomy = await loadTaxonomy();
  const systemPrompt = buildSystemPrompt(taxonomy);
  const files = await readAllPointFiles();
  const allPoints = [...files.entries()].flatMap(([level, file]) =>
    file.points.map((point) => ({ ...point, level })),
  );

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

  const tasks = [];
  const writers = [];
  let budget = options.limit;
  let printedPrompt = false;
  for (const level of LEVELS) {
    if (options.level && options.level !== level) continue;
    const file = files.get(level);
    const selected = selectedPoints(file, options).slice(0, budget);
    budget -= selected.length;
    if (selected.length === 0) continue;
    const batches = chunk(
      selected.map((point) => ({ point, related: relatedFor(point, allPoints) })),
      options.batchSize,
    );
    log(`${level}: ${selected.length} point dalam ${batches.length} batch`);

    if (options.dryRun) {
      if (!printedPrompt) {
        log(`DRY-RUN system prompt (${PROMPT_VERSION}):\n${systemPrompt}\n---`);
        log(`DRY-RUN prompt batch pertama:\n${buildUserPrompt(level, batches[0])}\n---`);
        printedPrompt = true;
      }
      continue;
    }

    const writer = { queue: Promise.resolve() };
    const persist = () => {
      writer.queue = writer.queue.then(() => writePointFile(file));
      return writer.queue;
    };
    writers.push(writer);
    batches.forEach((batch, index) => tasks.push({ level, batch, persist, label: `${level}#${index + 1}` }));
  }

  if (options.dryRun || tasks.length === 0) {
    if (!options.dryRun) log("tidak ada point yang perlu digenerate");
    return;
  }

  const summary = { generated: 0, failed: 0, doubts: 0, recovered: 0, input: 0, output: 0 };
  let processed = 0;
  const total = tasks.reduce((sum, task) => sum + task.batch.length, 0);
  await runPool(tasks, options.concurrency, async (task) => {
    try {
      const result = await generateBatch({
        client,
        model,
        reasoningEffort: options.reasoningEffort,
        systemPrompt,
        taxonomy,
        level: task.level,
        items: task.batch,
      });
      summary.input += result.usage.input;
      summary.output += result.usage.output;
      const generatedAt = new Date().toISOString();
      for (const item of task.batch) {
        const generated = result.results.get(item.point.key);
        if (!generated) continue;
        item.point.content = generated.content;
        item.point.ai = {
          model,
          promptVersion: PROMPT_VERSION,
          generatedAt,
          doubt: generated.doubt,
        };
        item.point.review = null;
        summary.generated += 1;
        if (generated.doubt) summary.doubts += 1;
        if (generated.attempt > 1) summary.recovered += 1;
      }
      summary.failed += result.failures.length;
      if (result.results.size > 0) await task.persist();
      processed += task.batch.length;
      log(
        `OK ${task.label}: ${result.results.size}/${task.batch.length}, ` +
          `${result.attempts} percobaan [${processed}/${total}]`,
      );
      for (const failure of result.failures) log(`  FAIL ${failure.key}: ${failure.problems.join("; ")}`);
    } catch (error) {
      processed += task.batch.length;
      summary.failed += task.batch.length;
      log(`FAIL ${task.label}: ${error.message} [${processed}/${total}]`);
    }
  });

  await Promise.all(writers.map((writer) => writer.queue));
  log(
    `DONE: ${summary.generated} dibuat, ${summary.recovered} lolos setelah retry, ` +
      `${summary.failed} gagal, ${summary.doubts} doubt, ${summary.input}/${summary.output} token`,
  );
  if (summary.failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("[gen:bunpou] gagal", error);
  process.exitCode = 1;
});
