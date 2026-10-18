"use server";

import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { unstable_cache } from "next/cache";
import { env, FEATURES } from "@/constants";
import { CACHE_KEYS, CACHE_TAGS } from "@/constants/cache-key";
import { DICTIONARY_LIMITS } from "@/constants/dictionary";
import { limitByRedis } from "@/lib/redis-rate-limit";
import { logServerEvent, reportServerError } from "@/lib/server-logger";
import { dictionaryQuerySchema } from "./schemas";
import { lookupDictionary } from "./lookup";
import { dictionaryManifest, dictionaryReader, dictionaryReaderMetrics } from "./reader";
import type { DictionaryResponse } from "./types";

let active = 0;
let completed = 0;
let totalMs = 0;

export async function lookupDictionaryAction(input: unknown): Promise<DictionaryResponse> {
  if (!FEATURES.dictionary) return { ok: false, code: "disabled", message: "Kamus seleksi belum tersedia." };
  const parsed = dictionaryQuerySchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid", message: "Pilih satu kata atau frasa pendek Jepang (maksimal 40 karakter)." };
  if (active >= DICTIONARY_LIMITS.concurrentLookups) return { ok: false, code: "busy", message: "Kamus sedang sibuk. Coba lagi sebentar.", retryAfterSeconds: 2 };
  const started = performance.now();
  active++;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  // Keep the capacity slot until the actual work finishes, including work that
  // outlives the UI timeout. Closing a popup never cancels a Server Action.
  const work = (async (): Promise<DictionaryResponse> => {
    const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const subject = createHmac("sha256", env.SESSION_SECRET).update(`dictionary:${ip}`).digest("hex");
    const limit = await limitByRedis(CACHE_KEYS.dictionaryRateLimit, subject, [DICTIONARY_LIMITS.rateLimit]);
    controller.signal.throwIfAborted();
    if (!limit.allowed) return { ok: false, code: "busy", message: "Terlalu banyak pencarian. Coba lagi setelah jeda.", retryAfterSeconds: limit.retryAfterSeconds };
    const query = parsed.data;
    // Immutable version/language/query key. Empty hits are cached; exceptions
    // from corrupt/missing shards propagate and are never cached as empty hits.
    const result = await unstable_cache(
      () => lookupDictionary(query, dictionaryReader(controller.signal)),
      CACHE_KEYS.dictionaryLookup(dictionaryManifest.version, query),
      { tags: [CACHE_TAGS.dictionary], revalidate: 24 * 60 * 60 },
    )();
    controller.signal.throwIfAborted();
    completed++; totalMs += performance.now() - started;
    if (completed % 100 === 0) logServerEvent("info", "dictionary.lookup.metrics", {
      version: dictionaryManifest.version, completed, meanMs: Math.round(totalMs / completed), ...dictionaryReaderMetrics(),
    });
    return { ok: true, result };
  })().finally(() => { active--; });
  try {
    return await Promise.race([work, new Promise<never>((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new Error("Dictionary lookup timed out.")); }, DICTIONARY_LIMITS.timeoutMs);
    })]);
  } catch {
    // Never log selected text, cache arguments, request headers, or raw parser
    // errors: Zod/JSON errors can contain the user's query or source content.
    reportServerError("dictionary.lookup.failed", new Error("Dictionary lookup unavailable."), { version: dictionaryManifest.version });
    return { ok: false, code: "unavailable", message: "Kamus belum dapat dimuat. Coba lagi." };
  } finally { if (timer) clearTimeout(timer); }
}
