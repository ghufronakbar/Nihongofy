import "server-only";
import { unstable_cache } from "next/cache";
import { CACHE_KEYS, CACHE_TAGS } from "@/constants/cache-key";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_FLASHCARD_SETTINGS,
  type FlashcardSchedulerSettings,
} from "./settings";

const getCachedSettings = (userId: number) =>
  unstable_cache(
    async (id: number): Promise<FlashcardSchedulerSettings> => {
      const settings = await prisma.flashcardSetting.findUnique({
        where: { userId: id },
        select: {
          newCardsPerDay: true,
          maxReviewsPerDay: true,
          learningStepsMinutes: true,
          graduatingIntervalDays: true,
          easyIntervalDays: true,
          startingEaseFactor: true,
          relearningStepsMinutes: true,
          lapseIntervalMultiplier: true,
          minimumIntervalDays: true,
          maximumIntervalDays: true,
          intervalModifier: true,
          easyBonus: true,
          hardMultiplier: true,
        },
      });

      return settings ?? {
        ...DEFAULT_FLASHCARD_SETTINGS,
        learningStepsMinutes: [...DEFAULT_FLASHCARD_SETTINGS.learningStepsMinutes],
        relearningStepsMinutes: [...DEFAULT_FLASHCARD_SETTINGS.relearningStepsMinutes],
      };
    },
    CACHE_KEYS.flashcardSettings(userId),
    { tags: [CACHE_TAGS.flashcardSettings(userId)] },
  )(userId);

export function getFlashcardSettingsForUser(userId: number) {
  return getCachedSettings(userId);
}
