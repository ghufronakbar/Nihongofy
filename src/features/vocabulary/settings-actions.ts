"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { CACHE_TAGS } from "@/constants/cache-key";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFlashcardSettingsForUser } from "./lib/settings-data";
import {
  DEFAULT_FLASHCARD_SETTINGS,
  formatReviewSteps,
  parseReviewSteps,
  type FlashcardSchedulerSettings,
} from "./lib/settings";
import {
  FlashcardSettingsSchema,
  type FlashcardSettingsInput,
} from "./settings-schemas";

export type FlashcardSettingsActionResult =
  | { ok: true; message: string; values: FlashcardSettingsInput }
  | { ok: false; message: string };

function toFormValues(settings: FlashcardSchedulerSettings): FlashcardSettingsInput {
  return {
    newCardsPerDay: settings.newCardsPerDay,
    maxReviewsPerDay: settings.maxReviewsPerDay,
    learningSteps: formatReviewSteps(settings.learningStepsMinutes),
    graduatingIntervalDays: settings.graduatingIntervalDays,
    easyIntervalDays: settings.easyIntervalDays,
    startingEasePercent: Math.round(settings.startingEaseFactor * 100),
    relearningSteps: formatReviewSteps(settings.relearningStepsMinutes),
    lapseIntervalPercent: Math.round(settings.lapseIntervalMultiplier * 100),
    minimumIntervalDays: settings.minimumIntervalDays,
    maximumIntervalDays: settings.maximumIntervalDays,
    intervalModifierPercent: Math.round(settings.intervalModifier * 100),
    easyBonusPercent: Math.round(settings.easyBonus * 100),
    hardMultiplierPercent: Math.round(settings.hardMultiplier * 100),
  };
}

export async function getFlashcardSettingsAction() {
  const session = await getSession();
  if (!session) redirect("/login");

  return toFormValues(await getFlashcardSettingsForUser(session.userId));
}

export async function saveFlashcardSettingsAction(
  input: FlashcardSettingsInput,
): Promise<FlashcardSettingsActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Sesi berakhir. Silakan masuk lagi." };

  const validated = FlashcardSettingsSchema.safeParse(input);
  if (!validated.success) {
    return {
      ok: false,
      message: validated.error.issues[0]?.message ?? "Pengaturan tidak valid.",
    };
  }

  const values = validated.data;
  const learningStepsMinutes = parseReviewSteps(values.learningSteps);
  const relearningStepsMinutes = parseReviewSteps(values.relearningSteps);

  if (!learningStepsMinutes || !relearningStepsMinutes) {
    return { ok: false, message: "Format langkah belajar tidak valid." };
  }

  const data: FlashcardSchedulerSettings = {
    newCardsPerDay: values.newCardsPerDay,
    maxReviewsPerDay: values.maxReviewsPerDay,
    learningStepsMinutes,
    graduatingIntervalDays: values.graduatingIntervalDays,
    easyIntervalDays: values.easyIntervalDays,
    startingEaseFactor: values.startingEasePercent / 100,
    relearningStepsMinutes,
    lapseIntervalMultiplier: values.lapseIntervalPercent / 100,
    minimumIntervalDays: values.minimumIntervalDays,
    maximumIntervalDays: values.maximumIntervalDays,
    intervalModifier: values.intervalModifierPercent / 100,
    easyBonus: values.easyBonusPercent / 100,
    hardMultiplier: values.hardMultiplierPercent / 100,
  };

  await prisma.flashcardSetting.upsert({
    where: { userId: session.userId },
    create: { userId: session.userId, ...data },
    update: data,
  });

  updateTag(CACHE_TAGS.flashcardSettings(session.userId));

  return {
    ok: true,
    message: "Pengaturan flashcard tersimpan.",
    values: toFormValues(data),
  };
}

export async function resetFlashcardSettingsAction(): Promise<FlashcardSettingsActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Sesi berakhir. Silakan masuk lagi." };

  const defaults = {
    ...DEFAULT_FLASHCARD_SETTINGS,
    learningStepsMinutes: [...DEFAULT_FLASHCARD_SETTINGS.learningStepsMinutes],
    relearningStepsMinutes: [...DEFAULT_FLASHCARD_SETTINGS.relearningStepsMinutes],
  };

  await prisma.flashcardSetting.upsert({
    where: { userId: session.userId },
    create: { userId: session.userId, ...defaults },
    update: defaults,
  });

  updateTag(CACHE_TAGS.flashcardSettings(session.userId));

  return {
    ok: true,
    message: "Pengaturan dikembalikan ke nilai default.",
    values: toFormValues(defaults),
  };
}
