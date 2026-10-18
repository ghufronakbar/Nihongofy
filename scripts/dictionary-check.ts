import { createHash } from "node:crypto";
import { readFile, writeFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { performance } from "node:perf_hooks";
import assert from "node:assert/strict";
import { DICTIONARY_LIMITS } from "../src/constants/dictionary";
import { dictionaryEntriesSchema, dictionaryTermsSchema } from "../src/features/dictionary/schemas";
import { dictionaryManifest, dictionaryReader, dictionaryReaderMetrics } from "../src/features/dictionary/reader";
import { lookupDictionary } from "../src/features/dictionary/lookup";
import { entryBucket, termBucket } from "../src/features/dictionary/index-format";

async function main() {
  const base = path.resolve("assets/dictionary");
  let compressedBytes = 0;
  let uncompressedBytes = 0;
  let entryCount = 0;
  let termCount = 0;
  const entries = new Set<string>();
  const references = new Set<string>();
  for (const kind of ["entries", "terms"] as const) {
    const directoryFiles = await readdir(path.join(base, kind));
    assert.equal(directoryFiles.length, 256);
    for (const name of directoryFiles.sort()) {
      const file = `${kind}/${name}`;
      const metadata = dictionaryManifest.files[file];
      assert(metadata, "Manifest must include every published shard.");
      const compressed = await readFile(path.join(base, file));
      assert.equal(compressed.length, metadata.bytes);
      assert.equal(createHash("sha256").update(compressed).digest("hex"), metadata.sha256);
      const json = gunzipSync(compressed, { maxOutputLength: 8 * 1024 * 1024 });
      compressedBytes += compressed.length; uncompressedBytes += json.length;
      const raw: unknown = JSON.parse(json.toString("utf8"));
      if (kind === "entries") {
        for (const [id, record] of Object.entries(dictionaryEntriesSchema.parse(raw))) {
          assert.equal(record.id, id); assert.equal(entryBucket(id), name.slice(0, 2));
          assert(!entries.has(id)); entries.add(id); entryCount++;
          const kanji = new Set(record.kanji.map((form) => form.text));
          const kana = new Set(record.kana.map((form) => form.text));
          for (const reading of record.kana) for (const writing of reading.appliesToKanji) assert(writing === "*" || kanji.has(writing));
          for (const sense of record.sense) {
            for (const writing of sense.appliesToKanji) assert(writing === "*" || kanji.has(writing));
            for (const reading of sense.appliesToKana) assert(reading === "*" || kana.has(reading));
          }
        }
      } else {
        for (const [term, ids] of Object.entries(dictionaryTermsSchema.parse(raw))) {
          assert.equal(termBucket(term), name.slice(0, 2)); termCount++;
          for (const id of ids) references.add(id);
        }
      }
    }
  }
  assert.equal(entryCount, dictionaryManifest.entryCount);
  assert.equal(termCount, dictionaryManifest.termCount);
  assert.deepEqual(references, entries);
  const examples = ["勉強", "ありがとう", "生", "明日", "食べました", "行かなかった", "していました", "来なかった", "高くなかった", "食べられた", "書けました", "話させられました", "謎謎謎ほげほげ不存在"];
  const cold: number[] = []; const warm: number[] = [];
  const beforeMemory = process.memoryUsage();
  const started = performance.now();
  const cases = [];
  for (const query of examples) {
    const begin = performance.now();
    const result = await lookupDictionary(query, dictionaryReader());
    cold.push(performance.now() - begin);
    assert(Buffer.byteLength(JSON.stringify(result)) <= DICTIONARY_LIMITS.responseBytes);
    cases.push({ query, words: result.hits.map((hit) => `${hit.word}/${hit.reading}`), responseBytes: Buffer.byteLength(JSON.stringify(result)) });
  }
  for (const query of examples) {
    const begin = performance.now(); await lookupDictionary(query, dictionaryReader()); warm.push(performance.now() - begin);
  }
  const percentile = (values: number[], p: number) => Math.round(values.toSorted((a, b) => a - b)[Math.min(values.length - 1, Math.ceil(values.length * p) - 1)] * 100) / 100;
  const evidence = {
    checkedAt: new Date().toISOString(), runtime: process.version, platform: `${process.platform}/${process.arch}`,
    version: dictionaryManifest.version, sourceSha256: dictionaryManifest.sourceSha256,
    entryCount, termCount, shards: Object.keys(dictionaryManifest.files).length, compressedBytes, uncompressedBytes,
    manifestBytes: (await stat(path.join(base, "manifest.json"))).size,
    benchmark: { note: "Local Node filesystem+decompression+projection; excludes network, Redis and Next Data Cache. Cold series shares the bounded shard LRU; not a deployment cold start.",
      lookups: examples.length, durationMs: Math.round(performance.now() - started),
      coldSeries: { p50Ms: percentile(cold, .5), p95Ms: percentile(cold, .95) },
      warmSeries: { p50Ms: percentile(warm, .5), p95Ms: percentile(warm, .95) },
      beforeMemory, afterMemory: process.memoryUsage(), reader: dictionaryReaderMetrics() }, cases,
  };
  const evidenceFile = process.argv.slice(2).find((arg) => arg.startsWith("--evidence="))?.slice(11);
  if (evidenceFile) await writeFile(path.resolve(evidenceFile), JSON.stringify(evidence, null, 2) + "\n");
  console.log(JSON.stringify(evidence, null, 2));
}
void main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
