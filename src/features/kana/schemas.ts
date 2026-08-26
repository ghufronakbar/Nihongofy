import { z } from "zod";

export const KanaProgressSchema = z.object({
  kanaKey: z.string().min(1).max(40),
  grade: z.enum(["VIEWED", "AGAIN", "CORRECT"]),
});

export type KanaProgressInput = z.infer<typeof KanaProgressSchema>;
