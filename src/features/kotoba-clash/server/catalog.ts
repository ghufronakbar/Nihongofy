import "server-only";

import { randomInt, randomUUID } from "node:crypto";
import { unstable_cache } from "next/cache";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { CACHE_KEYS, CACHE_TAGS } from "@/constants/cache-key";
import { FEATURES } from "@/constants";
import { ClashQuestionSnapshotSchema, type ClashConfig } from "../schemas";
import { CLASH_LEVELS, CLASH_MONDAI_TYPES, type ClashMondaiType } from "../domain/rules";
import { ClashError, type ClashAssignment } from "../domain/ports";

export type ClashCatalogEntry = { jlptLevel: ClashConfig["jlptLevel"]; mondaiType: ClashMondaiType; count: number };

async function eligibleQuestions(db: PrismaClient, level?: ClashConfig["jlptLevel"], types?: ClashMondaiType[]) {
  const rows = await db.question.findMany({
    where: {
      questionAudio: null,
      OR: [{ questionContextId: null }, { questionContext: { storyAudio: null } }],
      testPackageItem: { mondaiType: { in: types ?? CLASH_MONDAI_TYPES }, ...(level ? { testPackage: { jlptLevel: level } } : {}) },
    },
    select: {
      id: true, questionText: true, questionImage: true, questionAnswer: true,
      testPackageItem: { select: { instruction: true, mondaiType: true, testPackage: { select: { jlptLevel: true } } } },
      questionContext: { select: { storyText: true, storyImage: true } },
      questionChoices: { orderBy: { codeAnswer: "asc" }, select: { codeAnswer: true, answerText: true, answerImage: true } },
      explanation: { select: { summary: true } },
    },
  });
  return rows.flatMap((row) => {
    const type = row.testPackageItem.mondaiType;
    const context = row.questionContext;
    if ((type.startsWith("DOKKAI_") || type === "BUNPOU_TEXT_GRAMMAR") && !context?.storyText?.trim() && !context?.storyImage) return [];
    if (!row.questionText.trim() && !row.questionImage) return [];
    const parsed = ClashQuestionSnapshotSchema.safeParse({
      sourceQuestionId: row.id, mondaiType: type, correctChoice: row.questionAnswer,
      explanation: row.explanation?.summary ?? null,
      content: {
        instruction: row.testPackageItem.instruction, text: row.questionText, image: row.questionImage,
        context: context && { text: context.storyText, image: context.storyImage },
        choices: row.questionChoices.map((choice) => ({ code: choice.codeAnswer, text: choice.answerText, image: choice.answerImage })),
      },
    });
    return parsed.success ? [{ jlptLevel: row.testPackageItem.testPackage.jlptLevel, question: parsed.data }] : [];
  });
}

async function loadCatalog(): Promise<ClashCatalogEntry[]> {
  const rows = await eligibleQuestions(prisma);
  return CLASH_LEVELS.flatMap((jlptLevel) => CLASH_MONDAI_TYPES.map((mondaiType) => ({
    jlptLevel, mondaiType,
    count: rows.filter((row) => row.jlptLevel === jlptLevel && row.question.mondaiType === mondaiType).length,
  })));
}

// Only aggregate stock counts are cached. Private question content never enters this cache.
const getCachedCatalog = unstable_cache(loadCatalog, CACHE_KEYS.kotobaCatalog, {
  revalidate: 3600, tags: [CACHE_TAGS.testPackageList],
});

export async function getClashCatalog() {
  if (!FEATURES.kotobaClash) throw new ClashError("NOT_FOUND");
  return getCachedCatalog();
}

export function shuffleClash<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const other = randomInt(index + 1);
    [result[index], result[other]] = [result[other]!, result[index]!];
  }
  return result;
}

export async function sampleClashQuestions(config: ClashConfig, db: PrismaClient = prisma): Promise<ClashAssignment[]> {
  const rows = await eligibleQuestions(db, config.jlptLevel, config.mondaiTypes);
  const groups = shuffleClash(config.mondaiTypes).map((type) => shuffleClash(rows.filter((row) => row.question.mondaiType === type)));
  if (groups.some((group) => group.length === 0) || rows.length < config.questionCount) throw new ClashError("INVALID_QUESTIONS");
  const selected: ClashAssignment[] = [];
  while (selected.length < config.questionCount) {
    for (const group of groups) {
      const row = group.pop();
      if (row) selected.push({ id: randomUUID(), question: row.question });
      if (selected.length === config.questionCount) break;
    }
  }
  return shuffleClash(selected);
}
