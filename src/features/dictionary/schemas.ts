import { z } from "zod";
import { DICTIONARY_LIMITS } from "@/constants/dictionary";

export function normalizeDictionaryQuery(text: string) {
  return text.normalize("NFKC").trim();
}

export const dictionaryQuerySchema = z.string().max(160).trim()
  .refine((value) => [...value].length >= 1 && [...value].length <= DICTIONARY_LIMITS.queryCodePoints,
    "Pilih satu kata atau frasa pendek (maksimal 40 karakter).")
  .transform(normalizeDictionaryQuery)
  .refine((value) => [...value].length <= DICTIONARY_LIMITS.queryCodePoints &&
    /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(value) &&
    !/[\p{Cc}\p{Cf}]/u.test(value), "Pilih kata Jepang.");

const strings = z.array(z.string());
const spelling = z.object({ text: z.string().min(1), common: z.boolean(), tags: strings });
const rawSense = z.object({
  partOfSpeech: strings,
  appliesToKanji: strings,
  appliesToKana: strings,
  field: strings,
  dialect: strings,
  misc: strings,
  info: strings,
  gloss: z.array(z.object({ lang: z.literal("eng"), text: z.string(),
    type: z.string().nullable(), gender: z.string().nullable() })),
});
export const jmdictWordSchema = z.object({
  id: z.string().regex(/^\d+$/),
  kanji: z.array(spelling),
  kana: z.array(spelling.extend({ appliesToKanji: strings })).min(1),
  sense: z.array(rawSense).min(1),
});

export const dictionaryRecordSchema = jmdictWordSchema.extend({
  sense: z.array(rawSense.extend({ gloss: strings })).min(1),
});
export type DictionaryRecord = z.infer<typeof dictionaryRecordSchema>;

export const dictionaryManifestSchema = z.object({
  format: z.literal(1),
  version: z.string().regex(/^[\w.+-]+$/),
  language: z.literal("eng"),
  commonOnly: z.literal(false),
  sourceDate: z.iso.date(),
  sourceUrl: z.url(),
  sourceSha256: z.string().regex(/^[a-f0-9]{64}$/),
  converterVersion: z.string(),
  licence: z.literal("CC-BY-SA-4.0"),
  entryCount: z.number().int().positive(),
  termCount: z.number().int().positive(),
  tags: z.record(z.string(), z.string()),
  files: z.record(z.string().regex(/^(terms|entries)\/[a-f0-9]{2}\.json\.gz$/),
    z.object({ sha256: z.string().regex(/^[a-f0-9]{64}$/), bytes: z.number().int().positive() })),
});
export type DictionaryManifest = z.infer<typeof dictionaryManifestSchema>;

export const dictionaryTermsSchema = z.record(z.string(), z.array(z.string().regex(/^\d+$/)).max(200));
export const dictionaryEntriesSchema = z.record(z.string(), dictionaryRecordSchema);
