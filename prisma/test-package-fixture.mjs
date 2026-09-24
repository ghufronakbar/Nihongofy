// Kontrak fixture bank soal: satu file JSON di src/test-package-data/ = satu
// paket tes. Dipakai bersama oleh import struktur soal, import pembahasan, dan
// generator pembahasan, supaya ketiganya tidak pernah punya definisi kontrak
// yang berbeda. Dokumentasi kontrak yang sama untuk tool eksternal ada di
// docs/seed.md, dan tipe TypeScript-nya di src/test-package-data/types.ts.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

export const SEED_DATA_DIR = fileURLToPath(new URL("../src/test-package-data/", import.meta.url));

export const JLPT_LEVELS = ["N1", "N2", "N3", "N4", "N5"];
export const JLPT_SECTIONS = ["MOJI_GOI", "BUNPOU", "DOKKAI", "CHOUKAI"];
export const SECTION_BY_MONDAI = {
  MOJI_GOI_READ_KANJI: "MOJI_GOI",
  MOJI_GOI_WRITE_KANJI: "MOJI_GOI",
  MOJI_GOI_WORD_FORMATION: "MOJI_GOI",
  MOJI_GOI_CONTEXT: "MOJI_GOI",
  MOJI_GOI_SYNONYM: "MOJI_GOI",
  MOJI_GOI_WORD_USAGE: "MOJI_GOI",
  BUNPOU_GRAMMAR: "BUNPOU",
  BUNPOU_SENTENCE_COMPOSITION: "BUNPOU",
  BUNPOU_TEXT_GRAMMAR: "BUNPOU",
  DOKKAI_SHORT_TEXT: "DOKKAI",
  DOKKAI_MEDIUM_TEXT: "DOKKAI",
  DOKKAI_LONG_TEXT: "DOKKAI",
  DOKKAI_INTEGRATED: "DOKKAI",
  DOKKAI_MAIN_IDEA: "DOKKAI",
  DOKKAI_INFORMATION_RETRIEVAL: "DOKKAI",
  CHOUKAI_TASK_BASED: "CHOUKAI",
  CHOUKAI_MAIN_POINT: "CHOUKAI",
  CHOUKAI_OUTLINE: "CHOUKAI",
  CHOUKAI_EXPRESSION: "CHOUKAI",
  CHOUKAI_QUICK_RESPONSE: "CHOUKAI",
  CHOUKAI_INTEGRATED: "CHOUKAI",
};
export const MONDAI_TYPES = Object.keys(SECTION_BY_MONDAI);

const optionalNullableString = z.string().nullable().optional();

const questionChoiceSchema = z
  .object({
    codeAnswer: z.number().int().min(1).max(4),
    answerText: z.string(),
    answerImage: optionalNullableString,
  })
  .strict();

const explanationChoiceSchema = z
  .object({
    codeAnswer: z.number().int().min(1).max(4),
    reason: z.string().trim().min(1),
  })
  .strict();

const explanationObjectSchema = z
  .object({
    summary: z.string().trim().min(1),
    detail: optionalNullableString,
    translation: optionalNullableString,
    keyPoints: z.array(z.string().trim().min(1)).default([]),
    choices: z.array(explanationChoiceSchema).length(4).optional(),
    answerKeyDoubt: z.boolean().default(false),
    answerKeyDoubtNote: optionalNullableString,
    meta: z
      .object({
        source: z.enum(["AI", "HUMAN", "IMPORTED"]).default("AI"),
        aiModel: optionalNullableString,
        promptVersion: optionalNullableString,
        generatedAt: z.iso.datetime({ offset: true }).nullable().optional(),
        reviewedAt: z.iso.datetime({ offset: true }).nullable().optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((explanation, context) => {
    if (!explanation.choices) return;

    const seen = new Set();
    for (const [index, choice] of explanation.choices.entries()) {
      if (seen.has(choice.codeAnswer)) {
        addValidationIssue(
          context,
          ["choices", index, "codeAnswer"],
          `codeAnswer duplikat: ${choice.codeAnswer}`,
        );
      }
      seen.add(choice.codeAnswer);
    }

    for (const codeAnswer of [1, 2, 3, 4]) {
      if (!seen.has(codeAnswer)) {
        addValidationIssue(context, ["choices"], `codeAnswer ${codeAnswer} belum dijelaskan`);
      }
    }
  });

// Bentuk lama explanation adalah satu string. Tetap diterima supaya fixture yang
// sudah ada tidak perlu ditulis ulang; string dipetakan ke `summary`.
const explanationSchema = z.union([z.string().trim().min(1), explanationObjectSchema]);

const questionSchema = z
  .object({
    order: z.number().int().positive(),
    questionText: z.string(),
    questionImage: optionalNullableString,
    questionAudio: optionalNullableString,
    questionAnswer: z.number().int().min(1).max(4),
    explanation: explanationSchema.nullable().optional(),
    questionContextRef: optionalNullableString,
    questionChoices: z.array(questionChoiceSchema).length(4),
  })
  .strict();

const testPackageItemSchema = z
  .object({
    mondaiType: z.enum(MONDAI_TYPES),
    section: z.enum(JLPT_SECTIONS),
    session: z.number().int().positive(),
    order: z.number().int().positive(),
    instruction: optionalNullableString,
    questions: z.array(questionSchema).min(1),
  })
  .strict();

const questionContextSchema = z
  .object({
    id: z.string().min(1),
    storyText: optionalNullableString,
    storyImage: optionalNullableString,
    storyAudio: optionalNullableString,
    // Provenance metadata used by some extraction fixtures; not stored in DB.
    refs: z.array(z.string()).optional(),
  })
  .strict();

function expectedSession(jlptLevel, section) {
  if (jlptLevel === "N1" || jlptLevel === "N2") {
    return section === "CHOUKAI" ? 2 : 1;
  }

  if (section === "MOJI_GOI") return 1;
  if (section === "CHOUKAI") return 3;
  return 2;
}

function addValidationIssue(context, pathParts, message) {
  context.addIssue({ code: "custom", path: pathParts, message });
}

export const seedTestPackageSchema = z
  .object({
    name: z.string().min(1),
    jlptLevel: z.enum(JLPT_LEVELS),
    questionContexts: z.array(questionContextSchema).default([]),
    testPackageItems: z.array(testPackageItemSchema).min(1),
  })
  .strict()
  .superRefine((pkg, context) => {
    const contextIndexes = new Map();
    const usedContextIds = new Set();

    pkg.questionContexts.forEach((questionContext, index) => {
      const previousIndex = contextIndexes.get(questionContext.id);
      if (previousIndex !== undefined) {
        addValidationIssue(
          context,
          ["questionContexts", index, "id"],
          `id duplikat dengan questionContexts[${previousIndex}]: ${questionContext.id}`,
        );
      } else {
        contextIndexes.set(questionContext.id, index);
      }

      const hasContent = [
        questionContext.storyText,
        questionContext.storyImage,
        questionContext.storyAudio,
      ].some((value) => typeof value === "string" && value.length > 0);

      if (!hasContent) {
        addValidationIssue(
          context,
          ["questionContexts", index],
          `context "${questionContext.id}" tidak memiliki text, image, atau audio`,
        );
      }
    });

    const mondaiIndexes = new Map();
    const itemOrderIndexes = new Map();

    pkg.testPackageItems.forEach((item, itemIndex) => {
      const previousMondaiIndex = mondaiIndexes.get(item.mondaiType);
      if (previousMondaiIndex !== undefined) {
        addValidationIssue(
          context,
          ["testPackageItems", itemIndex, "mondaiType"],
          `mondaiType duplikat dengan testPackageItems[${previousMondaiIndex}]`,
        );
      } else {
        mondaiIndexes.set(item.mondaiType, itemIndex);
      }

      const itemOrderKey = `${item.session}:${item.order}`;
      const previousOrderIndex = itemOrderIndexes.get(itemOrderKey);
      if (previousOrderIndex !== undefined) {
        addValidationIssue(
          context,
          ["testPackageItems", itemIndex, "order"],
          `order ${item.order} duplikat dalam session ${item.session} dengan testPackageItems[${previousOrderIndex}]`,
        );
      } else {
        itemOrderIndexes.set(itemOrderKey, itemIndex);
      }

      const requiredSection = SECTION_BY_MONDAI[item.mondaiType];
      if (item.section !== requiredSection) {
        addValidationIssue(
          context,
          ["testPackageItems", itemIndex, "section"],
          `${item.mondaiType} harus memakai section ${requiredSection}`,
        );
      }

      const requiredSession = expectedSession(pkg.jlptLevel, item.section);
      if (item.session !== requiredSession) {
        addValidationIssue(
          context,
          ["testPackageItems", itemIndex, "session"],
          `${pkg.jlptLevel}/${item.section} harus memakai session ${requiredSession}`,
        );
      }

      const questionOrderIndexes = new Map();
      item.questions.forEach((question, questionIndex) => {
        const previousQuestionIndex = questionOrderIndexes.get(question.order);
        if (previousQuestionIndex !== undefined) {
          addValidationIssue(
            context,
            ["testPackageItems", itemIndex, "questions", questionIndex, "order"],
            `order soal duplikat dengan questions[${previousQuestionIndex}]: ${question.order}`,
          );
        } else {
          questionOrderIndexes.set(question.order, questionIndex);
        }

        const choiceCodes = new Set();
        question.questionChoices.forEach((choice, choiceIndex) => {
          if (choiceCodes.has(choice.codeAnswer)) {
            addValidationIssue(
              context,
              [
                "testPackageItems",
                itemIndex,
                "questions",
                questionIndex,
                "questionChoices",
                choiceIndex,
                "codeAnswer",
              ],
              `codeAnswer duplikat: ${choice.codeAnswer}`,
            );
          }
          choiceCodes.add(choice.codeAnswer);
        });

        if (!choiceCodes.has(question.questionAnswer)) {
          addValidationIssue(
            context,
            ["testPackageItems", itemIndex, "questions", questionIndex, "questionAnswer"],
            `questionAnswer ${question.questionAnswer} tidak ada di questionChoices`,
          );
        }

        if (question.questionContextRef) {
          if (!contextIndexes.has(question.questionContextRef)) {
            addValidationIssue(
              context,
              [
                "testPackageItems",
                itemIndex,
                "questions",
                questionIndex,
                "questionContextRef",
              ],
              `context tidak ditemukan: ${question.questionContextRef}`,
            );
          } else {
            usedContextIds.add(question.questionContextRef);
          }
        }
      });
    });

    pkg.questionContexts.forEach((questionContext, index) => {
      if (!usedContextIds.has(questionContext.id)) {
        addValidationIssue(
          context,
          ["questionContexts", index, "id"],
          `context tidak direferensikan oleh question mana pun: ${questionContext.id}`,
        );
      }
    });
  });

export function formatZodIssue(issue) {
  const location = issue.path.length > 0 ? `$.${issue.path.join(".")}` : "$";
  return `${location}: ${issue.message}`;
}

// Nama file dibatasi ke basename *.json supaya argumen --file tidak bisa
// dipakai membaca file di luar folder fixture.
export function assertSafeFileName(fileName) {
  const isSafeFileName = path.basename(fileName) === fileName && fileName.endsWith(".json");
  if (!isSafeFileName) {
    throw new Error("--file harus berupa nama file *.json tanpa path");
  }
  return fileName;
}

export async function loadAndValidateSeedFiles(selectedFile) {
  let entries;
  try {
    entries = await fs.readdir(SEED_DATA_DIR);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`folder tidak dapat dibaca: ${SEED_DATA_DIR} (${message})`);
  }

  const availableJsonFiles = entries.filter((name) => name.endsWith(".json")).sort();
  if (selectedFile && !availableJsonFiles.includes(selectedFile)) {
    throw new Error(`file tidak ditemukan di ${SEED_DATA_DIR}: ${selectedFile}`);
  }

  const jsonFiles = selectedFile ? [selectedFile] : availableJsonFiles;
  const seedFiles = [];
  const emptyFiles = [];
  const errors = [];

  for (const file of jsonFiles) {
    const raw = await fs.readFile(path.join(SEED_DATA_DIR, file), "utf-8");
    if (!raw.trim()) {
      emptyFiles.push(file);
      continue;
    }

    let json;
    try {
      json = JSON.parse(raw);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push({ file, message: `$: JSON tidak valid (${message})` });
      continue;
    }

    const result = seedTestPackageSchema.safeParse(json);
    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.push({ file, message: formatZodIssue(issue) });
      }
      continue;
    }

    seedFiles.push({ file, pkg: result.data });
  }

  const filesByPackageName = new Map();
  for (const { file, pkg } of seedFiles) {
    const previousFile = filesByPackageName.get(pkg.name);
    if (previousFile) {
      errors.push({
        file,
        message: `$.name: package name duplikat dengan ${previousFile}: ${pkg.name}`,
      });
    } else {
      filesByPackageName.set(pkg.name, file);
    }
  }

  return { checkedFiles: jsonFiles.length, seedFiles, emptyFiles, errors };
}

// Bentuk kanonik pembahasan untuk penulisan ke database. Fixture lama menulis
// explanation sebagai satu string; bentuk itu dipetakan ke `summary` dan
// ditandai IMPORTED karena bukan hasil generator.
export function normalizeExplanation(question) {
  const explanation = question.explanation;
  if (!explanation) return null;

  if (typeof explanation === "string") {
    return {
      summary: explanation,
      detail: null,
      translation: null,
      keyPoints: [],
      answerKeyDoubt: false,
      answerKeyDoubtNote: null,
      source: "IMPORTED",
      aiModel: null,
      promptVersion: null,
      generatedAt: null,
      reviewedAt: null,
      choices: null,
    };
  }

  const meta = explanation.meta ?? {};
  return {
    summary: explanation.summary,
    detail: explanation.detail ?? null,
    translation: explanation.translation ?? null,
    keyPoints: explanation.keyPoints,
    answerKeyDoubt: explanation.answerKeyDoubt,
    answerKeyDoubtNote: explanation.answerKeyDoubtNote ?? null,
    source: meta.source ?? "AI",
    aiModel: meta.aiModel ?? null,
    promptVersion: meta.promptVersion ?? null,
    generatedAt: meta.generatedAt ? new Date(meta.generatedAt) : null,
    reviewedAt: meta.reviewedAt ? new Date(meta.reviewedAt) : null,
    choices: explanation.choices
      ? explanation.choices.map((choice) => ({
          codeAnswer: choice.codeAnswer,
          isCorrect: choice.codeAnswer === question.questionAnswer,
          reason: choice.reason,
        }))
      : null,
  };
}
