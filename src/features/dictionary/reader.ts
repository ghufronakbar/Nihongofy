import "server-only";

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import manifestData from "../../../assets/dictionary/manifest.json";
import { DICTIONARY_LIMITS } from "@/constants/dictionary";
import { dictionaryEntriesSchema, dictionaryManifestSchema, dictionaryTermsSchema, type DictionaryRecord } from "./schemas";
import { entryBucket, termBucket } from "./index-format";
import type { DictionaryReader } from "./lookup";

export const dictionaryManifest = dictionaryManifestSchema.parse(manifestData);
type ParsedShard =
  | { kind: "terms"; data: Record<string, string[]> }
  | { kind: "entries"; data: Record<string, DictionaryRecord> };
const cache = new Map<string, { value: ParsedShard; bytes: number }>();
const inflight = new Map<string, Promise<ParsedShard>>();
let cacheBytes = 0;
let diskReads = 0;
let cacheHits = 0;
let readers = 0;
const waiting: (() => void)[] = [];

async function diskSlot<T>(read: () => Promise<T>): Promise<T> {
  if (readers >= 4) await new Promise<void>((resolve) => waiting.push(resolve));
  else readers++;
  try { return await read(); }
  finally {
    const next = waiting.shift();
    if (next) next(); else readers--;
  }
}

async function shard(file: string): Promise<ParsedShard> {
  const cached = cache.get(file);
  if (cached) {
    cacheHits++;
    cache.delete(file); cache.set(file, cached);
    return cached.value;
  }
  const pending = inflight.get(file);
  if (pending) return pending;
  const metadata = dictionaryManifest.files[file];
  if (!metadata) throw new Error("Dictionary shard absent from manifest.");
  const promise = diskSlot(async () => {
    const compressed = await readFile(path.join(process.cwd(), "assets/dictionary", file));
    if (compressed.length !== metadata.bytes || createHash("sha256").update(compressed).digest("hex") !== metadata.sha256) {
      throw new Error("Dictionary shard integrity check failed.");
    }
    diskReads++;
    const json = gunzipSync(compressed, { maxOutputLength: 8 * 1024 * 1024 });
    const raw: unknown = JSON.parse(json.toString("utf8"));
    const value: ParsedShard = file.startsWith("terms/")
      ? { kind: "terms", data: dictionaryTermsSchema.parse(raw) }
      : { kind: "entries", data: dictionaryEntriesSchema.parse(raw) };
    // Conservative object/UTF-16 allowance, rather than counting gzip bytes as RAM.
    const bytes = json.length * 3;
    while (cacheBytes + bytes > DICTIONARY_LIMITS.shardCacheBytes && cache.size) {
      const first = cache.keys().next().value!;
      cacheBytes -= cache.get(first)!.bytes; cache.delete(first);
    }
    if (bytes <= DICTIONARY_LIMITS.shardCacheBytes) {
      cache.set(file, { value, bytes }); cacheBytes += bytes;
    }
    return value;
  });
  inflight.set(file, promise);
  try { return await promise; } finally { inflight.delete(file); }
}

export function dictionaryReader(signal?: AbortSignal): DictionaryReader {
  return {
    version: dictionaryManifest.version, sourceDate: dictionaryManifest.sourceDate, tags: dictionaryManifest.tags,
    async findTerms(terms) {
      signal?.throwIfAborted();
      const result = new Map<string, string[]>();
      const buckets = [...new Set(terms.map(termBucket))];
      await Promise.all(buckets.map(async (bucket) => {
        const parsed = await shard(`terms/${bucket}.json.gz`);
        if (parsed.kind !== "terms") throw new Error("Dictionary shard kind mismatch.");
        const data = parsed.data;
        signal?.throwIfAborted();
        for (const term of terms) if (termBucket(term) === bucket && Object.hasOwn(data, term)) result.set(term, data[term]);
      }));
      return result;
    },
    async readEntries(ids) {
      signal?.throwIfAborted();
      const groups = new Map<string, string[]>();
      for (const id of ids) { const bucket = entryBucket(id); groups.set(bucket, [...(groups.get(bucket) ?? []), id]); }
      const records = await Promise.all([...groups].map(async ([bucket, entryIds]) => {
        const parsed = await shard(`entries/${bucket}.json.gz`);
        if (parsed.kind !== "entries") throw new Error("Dictionary shard kind mismatch.");
        const data = parsed.data;
        signal?.throwIfAborted();
        return entryIds.map((id) => {
          const record = data[id];
          if (!record || record.id !== id) throw new Error("Dictionary posting points to a missing entry.");
          return record;
        });
      }));
      return records.flat();
    },
  };
}

export function dictionaryReaderMetrics() {
  return { diskReads, cacheHits, cacheBytes, cachedShards: cache.size, pendingReads: inflight.size };
}
