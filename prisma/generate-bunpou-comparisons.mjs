// Generate content for human-selected Bunpou comparison groups.

import OpenAI from "openai";
import { z } from "zod";
import {
  comparisonProblems,
  readAllPointFiles,
  readComparisons,
  writeComparisons,
} from "./bunpou-data.mjs";
import {
  PROMPT_VERSION,
  SYSTEM_PROMPT,
  buildRetryPrompt,
  buildUserPrompt,
  parseComparisonReply,
} from "./bunpou-comparison-prompt.mjs";

const REQUEST_TIMEOUT_MS = 300_000;
const SDK_MAX_RETRIES = 4;
const MAX_ATTEMPTS = 3;
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
  console.log(`[gen:bunpou-comparisons] ${message}`);
}

function parseArguments(argv) {
  const options = {
    keys: [],
    limit: Infinity,
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
    else if (argument.startsWith("--key")) {
      const value = readValue(argument, "--key", index);
      if (!value || value.startsWith("--")) throw new Error("--key membutuhkan key comparison");
      options.keys.push(value);
      if (consumesNext) index += 1;
    } else if (argument.startsWith("--limit")) {
      const value = Number(readValue(argument, "--limit", index));
      if (!Number.isInteger(value) || value < 1) throw new Error("--limit harus bilangan bulat > 0");
      options.limit = value;
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

function buildInput(comparison, pointsByKey) {
  return {
    key: comparison.key,
    title: comparison.title,
    points: comparison.points.map((key) => {
      const stored = pointsByKey.get(key);
      return {
        key,
        level: stored.level,
        title: stored.point.title,
        senseLabel: stored.point.content?.senseLabel ?? null,
        meaningId: stored.point.content?.meaningId ?? stored.point.source.meaning,
        connections: stored.point.content?.connections ?? [],
        explanation: stored.point.content?.explanation ?? [],
        pitfalls: stored.point.content?.pitfalls ?? [],
        tags: stored.point.content?.tags ?? [],
      };
    }),
  };
}

async function generateOne({ client, model, reasoningEffort, comparison, input, pointsByKey }) {
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: buildUserPrompt([input]) },
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
    const parsed = parseComparisonReply(reply);
    if (parsed.error) lastProblems = [parsed.error];
    else if (!parsed.items.has(comparison.key)) lastProblems = ["item tidak ada di keluaran"];
    else {
      const item = parsed.items.get(comparison.key);
      lastProblems = comparisonProblems(
        { ...comparison, content: item.content, ai: { doubt: item.doubt } },
        pointsByKey,
      );
      if (lastProblems.length === 0) return { item, attempt, usage };
    }
    if (attempt < MAX_ATTEMPTS) {
      messages.push(
        { role: "assistant", content: reply },
        {
          role: "user",
          content: buildRetryPrompt([{ key: comparison.key, problems: lastProblems }]),
        },
      );
    }
  }
  return { problems: lastProblems, usage };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const pointFiles = await readAllPointFiles();
  const pointsByKey = new Map();
  for (const [level, file] of pointFiles) {
    for (const point of file.points) pointsByKey.set(point.key, { level, point });
  }
  const file = await readComparisons();
  let selected = options.keys.length > 0
    ? file.comparisons.filter((comparison) => options.keys.includes(comparison.key))
    : file.comparisons.filter((comparison) => options.overwrite || !comparison.content);
  selected = selected.slice(0, options.limit);

  for (const comparison of selected) {
    const missing = comparison.points.filter((key) => !pointsByKey.has(key));
    if (missing.length > 0) throw new Error(`${comparison.key}: point tidak ditemukan: ${missing.join(", ")}`);
  }
  if (selected.length === 0) {
    log("tidak ada comparison yang perlu digenerate");
    return;
  }

  const inputs = selected.map((comparison) => buildInput(comparison, pointsByKey));
  if (options.dryRun) {
    log(`DRY-RUN system prompt (${PROMPT_VERSION}):\n${SYSTEM_PROMPT}\n---`);
    log(`DRY-RUN prompt:\n${buildUserPrompt(inputs.slice(0, 1))}\n---`);
    return;
  }

  const parsedEnv = envSchema.safeParse(process.env);
  if (!parsedEnv.success) {
    const missing = parsedEnv.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`environment belum lengkap: ${missing} (lihat .env.example)`);
  }
  const env = parsedEnv.data;
  const model = env.BUNPOU_MODEL ?? env.EXPLANATION_MODEL;
  const client = new OpenAI({
    apiKey: env.EXPLANATION_API_KEY,
    baseURL: env.EXPLANATION_BASE_URL,
    timeout: REQUEST_TIMEOUT_MS,
    maxRetries: SDK_MAX_RETRIES,
    defaultHeaders: { "User-Agent": USER_AGENT },
  });

  let failed = 0;
  let generated = 0;
  const usage = { input: 0, output: 0 };
  for (let index = 0; index < selected.length; index += 1) {
    const comparison = selected[index];
    const result = await generateOne({
      client,
      model,
      reasoningEffort: options.reasoningEffort,
      comparison,
      input: inputs[index],
      pointsByKey,
    });
    usage.input += result.usage.input;
    usage.output += result.usage.output;
    if (!result.item) {
      failed += 1;
      log(`FAIL ${comparison.key}: ${result.problems.join("; ")}`);
      continue;
    }
    comparison.content = result.item.content;
    comparison.ai = {
      model,
      promptVersion: PROMPT_VERSION,
      generatedAt: new Date().toISOString(),
      doubt: result.item.doubt,
    };
    comparison.reviewedAt = null;
    await writeComparisons(file);
    generated += 1;
    log(`OK ${comparison.key} (${result.attempt} percobaan) [${index + 1}/${selected.length}]`);
  }
  log(`DONE: ${generated} dibuat, ${failed} gagal, ${usage.input}/${usage.output} token`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("[gen:bunpou-comparisons] gagal", error);
  process.exitCode = 1;
});
