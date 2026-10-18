// Aman untuk client; konfigurasi environment tetap di constants/index.ts.
export const DICTIONARY_LIMITS = {
  queryCodePoints: 40,
  candidates: 96,
  deinflectionDepth: 5,
  results: 10,
  senses: 40,
  responseBytes: 96 * 1024,
  selectionDelayMs: 200,
  timeoutMs: 5_000,
  concurrentLookups: 8,
  clientCacheEntries: 40,
  clientCacheBytes: 512 * 1024,
  shardCacheBytes: 16 * 1024 * 1024,
  rateLimit: { seconds: 60, max: 40 },
} as const;

export const DICTIONARY_SOURCE = {
  name: "JMdict · EDRDG",
  url: "https://www.edrdg.org/jmdict/j_jmdict.html",
  licence: "https://www.edrdg.org/edrdg/licence.html",
  licenceId: "CC-BY-SA-4.0",
  converter: "https://github.com/scriptin/jmdict-simplified",
} as const;

export const DICTIONARY_PREFERENCE_KEY = "nihongofy:dictionary:enabled";
export const DICTIONARY_PREFERENCE_EVENT = "nihongofy:dictionary-preference";
