// Link JLPT bunpou questions to catalog points (Phase B1). Two AI stages with a
// deterministic catalog lookup in between; see docs/seed-bunpou.md "Langkah 4".
// Resumable: recorded questions are skipped unless --refresh-empty/--overwrite.

import OpenAI from "openai";
import { z } from "zod";
import { LEVELS, readAllPointFiles } from "./bunpou-data.mjs";
import {
  LINK_LIMITS,
  buildCatalogIndex,
  catalogLevels,
  derivedKeys,
  linkFileProblems,
  linkedQuestionsOf,
  lookupCandidates,
  nearestLevelKey,
  questionId,
  questionLinkProblems,
  readLinkFile,
  writeLinkFile,
} from "./bunpou-links.mjs";
import {
  IDENTIFY_SYSTEM_PROMPT,
  PROMPT_VERSION,
  SELECT_SYSTEM_PROMPT,
  buildIdentifyPrompt,
  buildRetryPrompt,
  buildSelectPrompt,
  identifyProblems,
  parseIdentifyReply,
  parseSelectReply,
  selectProblems,
  selectableIndexes,
} from "./bunpou-link-prompt.mjs";
import { loadAndValidateSeedFiles } from "./test-package-fixture.mjs";

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
  console.log(`[gen:bunpou-links] ${message}`);
}

function parseArguments(argv) {
  const options = {
    packages: [],
    level: null,
    limit: Infinity,
    batchSize: 8,
    concurrency: 4,
    refreshEmpty: false,
    relookup: false,
    overwrite: false,
    dryRun: false,
    reasoningEffort: "high",
  };
  const readValue = (argument, name, index) =>
    argument.startsWith(`${name}=`) ? argument.slice(name.length + 1) : argv[index + 1];
  const readInteger = (argument, name, index, min, max) => {
    const value = Number(readValue(argument, name, index));
    if (!Number.isInteger(value) || value < min || value > max) {
      throw new Error(`${name} harus bilangan bulat ${min}-${max === Infinity ? "∞" : max}`);
    }
    return value;
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const consumesNext = !argument.includes("=");
    if (argument === "--overwrite") options.overwrite = true;
    else if (argument === "--refresh-empty") options.refreshEmpty = true;
    else if (argument === "--relookup") options.relookup = true;
    else if (argument === "--dry-run") options.dryRun = true;
    else {
      if (argument.startsWith("--package")) {
        const value = readValue(argument, "--package", index);
        if (!value || value.startsWith("--") || !/^[a-z0-9-]+$/.test(value)) {
          throw new Error("--package membutuhkan nama fixture tanpa .json, mis. n5-2018-07");
        }
        options.packages.push(value);
      } else if (argument.startsWith("--level")) {
        const value = readValue(argument, "--level", index)?.toUpperCase();
        if (!LEVELS.includes(value)) throw new Error(`--level harus salah satu dari ${LEVELS.join(", ")}`);
        options.level = value;
      } else if (argument.startsWith("--limit")) {
        options.limit = readInteger(argument, "--limit", index, 1, Infinity);
      } else if (argument.startsWith("--batch-size")) {
        options.batchSize = readInteger(argument, "--batch-size", index, 1, MAX_BATCH_SIZE);
      } else if (argument.startsWith("--concurrency")) {
        options.concurrency = readInteger(argument, "--concurrency", index, 1, MAX_CONCURRENCY);
      } else if (argument.startsWith("--reasoning-effort")) {
        const value = readValue(argument, "--reasoning-effort", index)?.toLowerCase();
        if (!["minimal", "low", "medium", "high"].includes(value)) {
          throw new Error("--reasoning-effort harus minimal|low|medium|high");
        }
        options.reasoningEffort = value;
      } else throw new Error(`argumen tidak dikenal: ${argument}`);
      if (consumesNext) index += 1;
    }
  }
  if (options.overwrite && (options.refreshEmpty || options.relookup)) {
    throw new Error("--overwrite tidak bisa digabung dengan --refresh-empty atau --relookup");
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

// --relookup: pola tanpa key yang kini punya kandidat baru (katalog bertambah
// atau aturan lookup diperbaiki). Soalnya diproses ulang utuh.
function gainedCandidates(record, index, packageLevel) {
  return record.patterns.some((pattern) => {
    if (pattern.key) return false;
    const stored = new Set(pattern.candidates);
    return lookupCandidates(index, pattern, packageLevel).some((key) => !stored.has(key));
  });
}

function needsWork(record, options, index, packageLevel) {
  if (!record || options.overwrite) return true;
  if (options.relookup && gainedCandidates(record, index, packageLevel)) return true;
  if (!options.refreshEmpty) return false;
  const { tested, distractor } = derivedKeys(record);
  return tested.length + distractor.length === 0;
}

/**
 * Satu percakapan dengan retry per item. `check(id, item)` mengembalikan daftar
 * masalah; item yang lolos disimpan dan tidak diminta ulang.
 */
async function converse({ client, model, reasoningEffort, systemPrompt, userPrompt, ids, parse, check, usage }) {
  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];
  const pending = new Set(ids);
  const results = new Map();
  const lastProblems = new Map();
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
    const parsed = parse(reply);
    for (const id of pending) {
      let problems;
      if (parsed.error) problems = [parsed.error];
      else if (!parsed.items.has(id)) problems = ["item tidak ada di keluaran"];
      else problems = check(id, parsed.items.get(id));
      if (problems.length === 0) {
        results.set(id, parsed.items.get(id));
        pending.delete(id);
      } else lastProblems.set(id, problems);
    }
    if (pending.size > 0 && attempt < MAX_ATTEMPTS) {
      const failures = [...pending].map((id) => ({ id, problems: lastProblems.get(id) ?? [] }));
      messages.push(
        { role: "assistant", content: reply },
        { role: "user", content: buildRetryPrompt(failures) },
      );
    }
  }
  const failures = [...pending].map((id) => ({ id, problems: lastProblems.get(id) ?? [] }));
  return { results, failures, attempts };
}

// Terapkan pilihan tahap 2 ke pola, lalu aturan level terdekat. Key pengganti
// dimasukkan ke candidates supaya catatan tetap memenuhi kontrak.
function applySelection(patterns, item, index, packageLevel) {
  const chosen = new Map(item.choices.map((choice) => [choice.index, choice.key]));
  let swapped = 0;
  const applied = patterns.map((pattern, position) => {
    const selected = chosen.get(position) ?? null;
    if (!selected) return { ...pattern, key: null };
    const key = nearestLevelKey(index, selected, packageLevel);
    if (key === selected) return { ...pattern, key };
    swapped += 1;
    const candidates = pattern.candidates.includes(key)
      ? pattern.candidates
      : [...pattern.candidates.slice(0, LINK_LIMITS.candidates - 1), key];
    return { ...pattern, candidates, key };
  });
  return { patterns: applied, swapped };
}

async function processBatch({ client, model, reasoningEffort, index, pkg, entries, usage }) {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const failures = [];

  const identified = await converse({
    client,
    model,
    reasoningEffort,
    systemPrompt: IDENTIFY_SYSTEM_PROMPT,
    userPrompt: buildIdentifyPrompt(pkg, entries),
    ids: entries.map((entry) => entry.id),
    parse: parseIdentifyReply,
    check: (id, item) => identifyProblems(byId.get(id), item),
    usage,
  });
  failures.push(...identified.failures.map((failure) => ({ ...failure, stage: 1 })));

  const looked = new Map();
  for (const [id, item] of identified.results) {
    looked.set(
      id,
      item.patterns.map((pattern) => ({
        form: pattern.form.trim(),
        reading: pattern.reading.trim(),
        meaning: pattern.meaning.trim(),
        role: pattern.role,
        candidates: lookupCandidates(index, pattern, pkg.jlptLevel),
        key: null,
      })),
    );
  }

  const selectable = [...looked].filter(([, patterns]) => selectableIndexes(patterns).length > 0);
  const records = new Map();
  let swapped = 0;
  for (const [id, patterns] of looked) {
    if (selectableIndexes(patterns).length === 0) {
      records.set(id, { patterns, confidence: null, note: null });
    }
  }

  if (selectable.length > 0) {
    const selected = await converse({
      client,
      model,
      reasoningEffort,
      systemPrompt: SELECT_SYSTEM_PROMPT,
      userPrompt: buildSelectPrompt(
        pkg,
        selectable.map(([id, patterns]) => ({ entry: byId.get(id), patterns })),
        index,
      ),
      ids: selectable.map(([id]) => id),
      parse: parseSelectReply,
      check: (id, item) => {
        const patterns = looked.get(id);
        const problems = selectProblems(patterns, item);
        if (problems.length > 0) return problems;
        const applied = applySelection(patterns, item, index, pkg.jlptLevel);
        const entry = byId.get(id);
        const hasKey = applied.patterns.some((pattern) => pattern.key);
        return questionLinkProblems(
          {
            mondaiType: entry.item.mondaiType,
            patterns: applied.patterns,
            confidence: hasKey ? item.confidence : null,
          },
          index,
        );
      },
      usage,
    });
    failures.push(...selected.failures.map((failure) => ({ ...failure, stage: 2 })));
    for (const [id, item] of selected.results) {
      const applied = applySelection(looked.get(id), item, index, pkg.jlptLevel);
      swapped += applied.swapped;
      const hasKey = applied.patterns.some((pattern) => pattern.key);
      records.set(id, {
        patterns: applied.patterns,
        confidence: hasKey ? item.confidence : null,
        note: item.note?.trim() || null,
      });
    }
  }

  return { records, failures, swapped };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const index = buildCatalogIndex(await readAllPointFiles());
  const levelsWithCatalog = catalogLevels(index);

  const { seedFiles, errors } = await loadAndValidateSeedFiles(null);
  if (errors.length > 0) {
    throw new Error(`fixture paket tidak valid: ${errors.map((error) => `${error.file} ${error.message}`).join("; ")}`);
  }
  const known = new Set(seedFiles.map(({ file }) => file.slice(0, -".json".length)));
  const unknown = options.packages.filter((name) => !known.has(name));
  if (unknown.length > 0) throw new Error(`fixture paket tidak ditemukan: ${unknown.join(", ")}`);

  const packages = seedFiles
    .map(({ file, pkg }) => ({ name: file.slice(0, -".json".length), pkg }))
    .filter(({ name, pkg }) =>
      (options.packages.length === 0 || options.packages.includes(name)) &&
      (!options.level || pkg.jlptLevel === options.level),
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
  for (const { name, pkg } of packages) {
    if (budget <= 0) break;
    if (!levelsWithCatalog.has(pkg.jlptLevel)) {
      log(`${name}: dilewati, katalog ${pkg.jlptLevel} belum ada`);
      continue;
    }
    const file = await readLinkFile(name, pkg.name);
    const existingProblems = linkFileProblems(file, pkg, index);
    if (existingProblems.length > 0) {
      throw new Error(`question-links/${name}.json tidak valid: ${existingProblems.slice(0, 5).join("; ")}`);
    }
    const records = new Map(file.questions.map((record) => [questionId(record.mondaiType, record.order), record]));
    const entries = linkedQuestionsOf(pkg)
      .filter((entry) => needsWork(records.get(entry.id), options, index, pkg.jlptLevel))
      .slice(0, budget);
    budget -= entries.length;
    if (entries.length === 0) continue;

    const batches = chunk(entries, options.batchSize);
    log(`${name} (${pkg.jlptLevel}): ${entries.length} soal dalam ${batches.length} batch`);

    if (options.dryRun) {
      if (!printedPrompt) {
        log(`DRY-RUN system prompt tahap 1 (${PROMPT_VERSION}):\n${IDENTIFY_SYSTEM_PROMPT}\n---`);
        log(`DRY-RUN prompt tahap 1 batch pertama:\n${buildIdentifyPrompt(pkg, batches[0])}\n---`);
        printedPrompt = true;
      }
      continue;
    }

    const order = new Map(linkedQuestionsOf(pkg).map((entry, position) => [entry.id, position]));
    const writer = { queue: Promise.resolve() };
    const persist = () => {
      writer.queue = writer.queue.then(() => {
        file.questions = [...records.values()].sort(
          (left, right) =>
            order.get(questionId(left.mondaiType, left.order)) - order.get(questionId(right.mondaiType, right.order)),
        );
        return writeLinkFile(name, file);
      });
      return writer.queue;
    };
    writers.push(writer);
    batches.forEach((batch, position) =>
      tasks.push({ pkg, batch, records, persist, label: `${name}#${position + 1}` }),
    );
  }

  if (options.dryRun) {
    const sample = { form: "〜ように", reading: "ように" };
    const keys = lookupCandidates(index, sample, "N4");
    log(`DRY-RUN contoh lookup ${sample.form} (paket N4): ${keys.join(", ") || "(kosong)"}`);
    return;
  }
  if (tasks.length === 0) {
    log("tidak ada soal yang perlu diproses");
    return;
  }

  const usage = { input: 0, output: 0 };
  const summary = { recorded: 0, linked: 0, empty: 0, low: 0, swapped: 0, failed: 0 };
  const total = tasks.reduce((sum, task) => sum + task.batch.length, 0);
  let processed = 0;
  await runPool(tasks, options.concurrency, async (task) => {
    try {
      const result = await processBatch({
        client,
        model,
        reasoningEffort: options.reasoningEffort,
        index,
        pkg: task.pkg,
        entries: task.batch,
        usage,
      });
      const generatedAt = new Date().toISOString();
      for (const entry of task.batch) {
        const record = result.records.get(entry.id);
        if (!record) continue;
        task.records.set(entry.id, {
          mondaiType: entry.item.mondaiType,
          order: entry.question.order,
          patterns: record.patterns,
          confidence: record.confidence,
          note: record.note,
          ai: { model, promptVersion: PROMPT_VERSION, generatedAt },
        });
        summary.recorded += 1;
        if (record.confidence === null) summary.empty += 1;
        else summary.linked += 1;
        if (record.confidence === "low") summary.low += 1;
      }
      summary.swapped += result.swapped;
      summary.failed += result.failures.length;
      if (result.records.size > 0) await task.persist();
      processed += task.batch.length;
      log(`OK ${task.label}: ${result.records.size}/${task.batch.length} [${processed}/${total}]`);
      for (const failure of result.failures) {
        log(`  FAIL tahap ${failure.stage} ${failure.id}: ${failure.problems.join("; ")}`);
      }
    } catch (error) {
      processed += task.batch.length;
      summary.failed += task.batch.length;
      log(`FAIL ${task.label}: ${error.message} [${processed}/${total}]`);
    }
  });

  await Promise.all(writers.map((writer) => writer.queue));
  log(
    `DONE: ${summary.recorded} tercatat (${summary.linked} bertautan, ${summary.empty} kosong, ` +
      `${summary.low} low), ${summary.swapped} key ditukar ke level terdekat, ${summary.failed} gagal, ` +
      `${usage.input}/${usage.output} token`,
  );
  if (summary.failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("[gen:bunpou-links] gagal", error);
  process.exitCode = 1;
});
