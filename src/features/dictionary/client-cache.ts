import { DICTIONARY_LIMITS } from "@/constants/dictionary";
import type { DictionaryResult } from "./types";

const entries = new Map<string, { value: DictionaryResult; bytes: number }>();
let bytes = 0;
const keyFor = (version: string, query: string) => `${version}:eng:${query}`;

export function cachedDictionaryResult(version: string, query: string) {
  const key = keyFor(version, query);
  const entry = entries.get(key);
  if (!entry) return null;
  entries.delete(key); entries.set(key, entry);
  return entry.value;
}

export function cacheDictionaryResult(result: DictionaryResult) {
  const key = keyFor(result.version, result.query);
  const size = new TextEncoder().encode(JSON.stringify(result)).length * 2;
  if (size > DICTIONARY_LIMITS.clientCacheBytes) return;
  const old = entries.get(key);
  if (old) { bytes -= old.bytes; entries.delete(key); }
  while (entries.size && (entries.size >= DICTIONARY_LIMITS.clientCacheEntries || bytes + size > DICTIONARY_LIMITS.clientCacheBytes)) {
    const first = entries.keys().next().value!;
    bytes -= entries.get(first)!.bytes; entries.delete(first);
  }
  entries.set(key, { value: result, bytes: size }); bytes += size;
}
