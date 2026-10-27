import { z } from "zod";
import { getKanaByScript, type KanaScript } from "../data/kana";

export const QUIZ_LENGTH = 46;
export const QUIZ_STORAGE_KEY = "nihongofy:kana-quiz:v1";

export const QuizSetupSchema = z.object({
  nickname: z.string().trim().min(1, "Isi nickname kamu terlebih dahulu.").max(32, "Maksimal 32 karakter."),
  script: z.enum(["hiragana", "katakana"]),
});

export type QuizSetup = z.infer<typeof QuizSetupSchema>;
export type QuizQuestion = { kanaKey: string; options: string[] };
export type QuizAnswer = { kanaKey: string; selectedRomaji: string; elapsedMs: number };
export type QuizSession = QuizSetup & {
  version: 1;
  questions: QuizQuestion[];
  answers: QuizAnswer[];
  startedAt: number;
  questionStartedAt: number | null;
  finishedAt: number | null;
};

// Every other reading in the same visual family is included, in both directions.
export const CONFUSABLE_GROUPS: Record<KanaScript, readonly (readonly string[])[]> = {
  hiragana: [
    ["nu", "me"], ["re", "ne", "wa"], ["ru", "ro"], ["ha", "ho"],
    ["sa", "ki"], ["a", "o"], ["ta", "na"], ["i", "ri"],
    ["u", "ra"], ["su", "mu"],
  ],
  katakana: [
    ["shi", "tsu", "so", "n"], ["ku", "ke"], ["u", "wa"],
    ["fu", "wo"], ["nu", "su"], ["ma", "mu"], ["na", "me"],
    ["chi", "te"], ["ko", "yu"], ["e", "ni"],
  ],
};

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

export function createQuiz(setup: QuizSetup, now: number, random: () => number = Math.random): QuizSession {
  const validated = QuizSetupSchema.parse(setup);
  const cards = getKanaByScript(validated.script);
  const questions = shuffled(cards, random).map((card) => {
    const family = CONFUSABLE_GROUPS[validated.script].find((group) => group.includes(card.romaji)) ?? [];
    const required = [card.romaji, ...family.filter((reading) => reading !== card.romaji)];
    // を/ヲ uses the chart's "wo" convention. Never offer the equivalent "o"
    // pronunciation as its distractor (or vice versa).
    const remaining = cards.map((item) => item.romaji).filter((reading) =>
      !required.includes(reading) && !([card.romaji, reading].includes("wo") && [card.romaji, reading].includes("o")),
    );
    return { kanaKey: card.key, options: shuffled([...required, ...shuffled(remaining, random).slice(0, 4 - required.length)], random) };
  });

  return { ...validated, version: 1, questions, answers: [], startedAt: now, questionStartedAt: null, finishedAt: null };
}

export function beginQuestion(session: QuizSession, now: number): QuizSession {
  if (session.finishedAt !== null || session.questionStartedAt !== null) return session;
  return { ...session, questionStartedAt: Math.max(now, session.startedAt) };
}

export function answerQuestion(session: QuizSession, kanaKey: string, selectedRomaji: string, now: number): QuizSession {
  const question = session.questions[session.answers.length];
  if (session.finishedAt !== null || session.questionStartedAt === null || question?.kanaKey !== kanaKey || !question.options.includes(selectedRomaji)) return session;
  const answeredAt = Math.max(now, session.questionStartedAt);
  const answers = [...session.answers, { kanaKey, selectedRomaji, elapsedMs: answeredAt - session.questionStartedAt }];
  return { ...session, answers, questionStartedAt: null, finishedAt: answers.length === QUIZ_LENGTH ? answeredAt : null };
}

const TimestampSchema = z.number().int().min(0).max(8_640_000_000_000_000);
const SessionSchema = QuizSetupSchema.extend({
  version: z.literal(1),
  questions: z.array(z.object({ kanaKey: z.string().max(40), options: z.array(z.string().max(4)).length(4) })).length(QUIZ_LENGTH),
  answers: z.array(z.object({ kanaKey: z.string().max(40), selectedRomaji: z.string().max(4), elapsedMs: TimestampSchema })).max(QUIZ_LENGTH),
  startedAt: TimestampSchema,
  questionStartedAt: TimestampSchema.nullable(),
  finishedAt: TimestampSchema.nullable(),
}).superRefine((session, ctx) => {
  const cards = getKanaByScript(session.script);
  const keys = new Set(session.questions.map((question) => question.kanaKey));
  const validQuestions = keys.size === QUIZ_LENGTH && session.questions.every((question) => {
    const card = cards.find((item) => item.key === question.kanaKey);
    return card && new Set(question.options).size === 4 && question.options.includes(card.romaji)
      && question.options.every((reading) => cards.some((item) => item.romaji === reading));
  });
  const validAnswers = session.answers.every((answer, index) => {
    const question = session.questions[index];
    return answer.kanaKey === question.kanaKey && question.options.includes(answer.selectedRomaji);
  });
  const complete = session.answers.length === QUIZ_LENGTH;
  const end = session.finishedAt ?? session.questionStartedAt;
  const elapsed = session.answers.reduce((sum, answer) => sum + answer.elapsedMs, 0);
  if (!validQuestions || !validAnswers || complete !== (session.finishedAt !== null)
    || (complete && session.questionStartedAt !== null) || (end !== null && end < session.startedAt)
    || (end !== null && elapsed > end - session.startedAt)) {
    ctx.addIssue({ code: "custom", message: "Sesi quiz tidak valid." });
  }
});

export function restoreQuiz(value: unknown): QuizSession | null {
  const result = SessionSchema.safeParse(value);
  return result.success ? result.data : null;
}

export function getQuizResults(session: QuizSession) {
  const cards = getKanaByScript(session.script);
  const rows = session.answers.map((answer, index) => {
    const card = cards.find((item) => item.key === answer.kanaKey);
    if (!card) throw new Error("Kana tidak dikenal.");
    return { ...answer, card, number: index + 1, correct: answer.selectedRomaji === card.romaji };
  });
  const correctCount = rows.filter((row) => row.correct).length;
  const totalMs = rows.reduce((sum, row) => sum + row.elapsedMs, 0);
  return {
    rows, correctCount, totalMs,
    accuracy: Math.round(correctCount / QUIZ_LENGTH * 100),
    averageMs: rows.length ? totalMs / rows.length : 0,
    mistakes: rows.filter((row) => !row.correct),
    slowestCorrect: rows.filter((row) => row.correct).sort((a, b) => b.elapsedMs - a.elapsedMs).slice(0, 3),
    chart: cards.map((card) => rows.find((row) => row.kanaKey === card.key)).filter((row) => row !== undefined),
  };
}

export function formatAnswerTime(ms: number): string {
  return `${(ms / 1000).toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} dtk`;
}

export function formatQuizDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

export function formatQuizDate(timestamp: number): string {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(timestamp);
}
