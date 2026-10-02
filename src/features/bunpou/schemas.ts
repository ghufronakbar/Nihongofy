import { z } from "zod";
import type { BunpouComparisonContent, BunpouContent } from "./types";

/** Key pola dan perbandingan di URL; sama dengan aturan identitas di docs/seed-bunpou.md. */
export const BunpouKeySchema = z
  .string()
  .max(80)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);

// Kolom JSONB sudah divalidasi ketat oleh `seed:bunpou`. Skema di sini hanya
// penyaring saat membaca: bagian yang rusak jatuh ke nilai kosong alih-alih
// menjatuhkan halaman.

const ConnectionSchema = z.object({
  form: z.string(),
  pattern: z.string(),
  note: z.string().nullish(),
});

const FormationRowSchema = z.object({
  label: z.string(),
  input: z.string(),
  rule: z.string(),
  output: z.string(),
  note: z.string().nullable().catch(null),
});

const ExampleSchema = z.object({ jp: z.string(), id: z.string(), en: z.string() });

export const BunpouContentSchema: z.ZodType<BunpouContent> = z.object({
  title: z.string(),
  senseLabel: z.string().nullable().catch(null),
  meaningId: z.string(),
  meaningEn: z.string(),
  connections: z.array(ConnectionSchema).catch([]),
  formation: z.array(FormationRowSchema).catch([]),
  variants: z.array(z.string()).catch([]),
  explanation: z.array(z.string()).catch([]),
  examples: z.array(ExampleSchema).catch([]),
  pitfalls: z.array(z.string()).catch([]),
  tags: z.array(z.string()).catch([]),
});

export const BunpouComparisonContentSchema: z.ZodType<BunpouComparisonContent> = z.object({
  summary: z.string(),
  rows: z
    .array(
      z.object({
        key: z.string(),
        nuance: z.string(),
        register: z.string(),
        restriction: z.string(),
      }),
    )
    .catch([]),
  contrasts: z
    .array(
      z.object({
        jp: z.string(),
        id: z.string(),
        options: z.array(
          z.object({
            key: z.string(),
            text: z.string(),
            verdict: z.enum(["ok", "awkward", "wrong"]),
            note: z.string().nullish(),
          }),
        ),
      }),
    )
    .catch([]),
});
