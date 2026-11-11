"use client";

import { useSyncExternalStore } from "react";
import { z } from "zod";
const KEY = "nihongofy:article-reader:v1";
const EVENT = "nihongofy:article-reader-change";
const schema = z.object({
  mode: z.enum(["id", "ja", "bilingual"]),
  furigana: z.boolean(),
  fontSize: z.number().int().min(17).max(25),
  theme: z.enum(["light", "paper", "dark"]),
  parallel: z.boolean(),
});
export type ReaderPreferences = z.infer<typeof schema>;
const DEFAULTS: ReaderPreferences = {
  mode: "bilingual",
  furigana: true,
  fontSize: 20,
  theme: "light",
  parallel: false,
};
let memory: string | null = null;
function snapshot() {
  try {
    return localStorage.getItem(KEY) ?? memory;
  } catch {
    return memory;
  }
}
function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}
export function useReaderPreferences() {
  const raw = useSyncExternalStore(subscribe, snapshot, () => null);
  let preferences = DEFAULTS;
  if (raw) {
    try {
      preferences = schema.safeParse(JSON.parse(raw)).data ?? DEFAULTS;
    } catch {
      /* Ignore invalid browser preferences. */
    }
  }
  function update(patch: Partial<ReaderPreferences>) {
    const next = JSON.stringify({ ...preferences, ...patch });
    memory = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* Browser storage can be disabled. */
    }
    window.dispatchEvent(new Event(EVENT));
  }
  return [preferences, update] as const;
}
