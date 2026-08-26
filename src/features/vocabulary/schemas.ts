import { z } from "zod";

export const FlashcardRatingSchema = z.enum(["AGAIN", "HARD", "GOOD", "EASY"]);

export const RateFlashcardSchema = z.object({
  flashcardId: z.number().int().positive(),
  deckSlug: z.string().min(1).max(120),
  rating: FlashcardRatingSchema,
});

export const UsageExamplesSchema = z.array(
  z.object({
    sentence: z.string().min(1),
    meaning: z.string().min(1),
  }),
);

export type FlashcardRatingInput = z.infer<typeof FlashcardRatingSchema>;
export type RateFlashcardInput = z.infer<typeof RateFlashcardSchema>;
export type UsageExample = z.infer<typeof UsageExamplesSchema>[number];
