import { z } from "zod";
import { getKotoba, getKotobaByBabs, KOTOBA_BABS, KOTOBA_CONFLICTS, KOTOBA_FAMILIES, type KotobaEntry } from "./data";

export const KOTOBA_QUIZ_STORAGE_KEY = "nihongofy:kotoba-quiz:v1";
export const KOTOBA_OPTION_COUNT = 4;
export const KOTOBA_LENGTHS = ["10", "20", "all"] as const;

export const KotobaQuizSetupSchema = z.object({
  nickname: z.string().trim().min(1, "Isi nickname kamu terlebih dahulu.").max(32, "Maksimal 32 karakter."),
  babs: z.array(z.number().int().refine((bab) => KOTOBA_BABS.includes(bab)))
    .min(1, "Pilih minimal satu bab.")
    .refine((babs) => new Set(babs).size === babs.length, "Bab tidak boleh ganda."),
  front: z.enum(["kana", "kanji"]),
  length: z.enum(KOTOBA_LENGTHS),
});

export type KotobaQuizSetup = z.infer<typeof KotobaQuizSetupSchema>;
export type KotobaFront = KotobaQuizSetup["front"];
export type KotobaQuestion = { key: string; options: string[] };
/** `selectedKey` null berarti kata dilewati: kunci tetap ditampilkan, tetapi tidak dihitung benar. */
export type KotobaAnswer = { key: string; selectedKey: string | null; elapsedMs: number };
export type KotobaQuizSession = KotobaQuizSetup & {
  version: 1;
  questions: KotobaQuestion[];
  answers: KotobaAnswer[];
  startedAt: number;
  questionStartedAt: number | null;
  finishedAt: number | null;
};

const CONFLICTS = new Map<string, Set<string>>();
for (const group of KOTOBA_CONFLICTS) {
  for (const key of group) {
    const set = CONFLICTS.get(key) ?? new Set<string>();
    for (const other of group) if (other !== key) set.add(other);
    CONFLICTS.set(key, set);
  }
}

export function kotobaConflict(a: string, b: string): boolean {
  return a === b || (CONFLICTS.get(a)?.has(b) ?? false);
}

/** Teks bagian depan kartu: kanji bila diminta dan tersedia, selain itu kana. */
export function kotobaFront(entry: KotobaEntry, front: KotobaFront): string {
  return front === "kanji" && entry.kanji ? entry.kanji : entry.kana;
}

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

function pickOptions(entry: KotobaEntry, pool: readonly KotobaEntry[], random: () => number): string[] {
  const family = new Set(KOTOBA_FAMILIES.filter((group) => group.includes(entry.key)).flat());
  const picked: KotobaEntry[] = [entry];
  // Kelompok sejenis lebih dulu, lalu kata dari bab yang sama, lalu sisa bab yang dipilih.
  const tiers = [
    pool.filter((item) => family.has(item.key)),
    pool.filter((item) => item.bab === entry.bab),
    pool,
  ];
  for (const tier of tiers) {
    for (const candidate of shuffled(tier, random)) {
      if (picked.length === KOTOBA_OPTION_COUNT) break;
      if (picked.some((item) => kotobaConflict(item.key, candidate.key))) continue;
      picked.push(candidate);
    }
  }
  return shuffled(picked.map((item) => item.key), random);
}

export function createKotobaQuiz(setup: KotobaQuizSetup, now: number, random: () => number = Math.random, onlyKeys?: readonly string[]): KotobaQuizSession {
  const validated = KotobaQuizSetupSchema.parse(setup);
  const babs = [...validated.babs].sort((a, b) => a - b);
  const pool = getKotobaByBabs(babs);
  const chosen = onlyKeys ? pool.filter((entry) => onlyKeys.includes(entry.key)) : pool;
  if (!chosen.length) throw new Error("Tidak ada kata untuk diuji.");
  const limit = validated.length === "all" ? chosen.length : Number(validated.length);
  const questions = shuffled(chosen, random).slice(0, limit).map((entry) => ({ key: entry.key, options: pickOptions(entry, pool, random) }));
  return { ...validated, babs, version: 1, questions, answers: [], startedAt: now, questionStartedAt: null, finishedAt: null };
}

/** Membuka soal berikutnya, atau menutup quiz bila semua soal sudah dijawab dan ditinjau. */
export function advanceKotobaQuiz(session: KotobaQuizSession, now: number): KotobaQuizSession {
  if (session.finishedAt !== null || session.questionStartedAt !== null) return session;
  const latest = Math.max(now, session.startedAt);
  if (session.answers.length === session.questions.length) return { ...session, finishedAt: latest };
  return { ...session, questionStartedAt: latest };
}

export function answerKotoba(session: KotobaQuizSession, key: string, selectedKey: string | null, now: number): KotobaQuizSession {
  const question = session.questions[session.answers.length];
  if (session.finishedAt !== null || session.questionStartedAt === null || question?.key !== key
    || (selectedKey !== null && !question.options.includes(selectedKey))) return session;
  const answeredAt = Math.max(now, session.questionStartedAt);
  const answers = [...session.answers, { key, selectedKey, elapsedMs: answeredAt - session.questionStartedAt }];
  return { ...session, answers, questionStartedAt: null };
}

const TimestampSchema = z.number().int().min(0).max(8_640_000_000_000_000);
const KeySchema = z.string().max(20);
const SessionSchema = KotobaQuizSetupSchema.extend({
  version: z.literal(1),
  questions: z.array(z.object({ key: KeySchema, options: z.array(KeySchema).length(KOTOBA_OPTION_COUNT) })).min(1).max(500),
  answers: z.array(z.object({ key: KeySchema, selectedKey: KeySchema.nullable(), elapsedMs: TimestampSchema })).max(500),
  startedAt: TimestampSchema,
  questionStartedAt: TimestampSchema.nullable(),
  finishedAt: TimestampSchema.nullable(),
}).superRefine((session, ctx) => {
  const inBabs = (key: string) => {
    const entry = getKotoba(key);
    return entry !== undefined && session.babs.includes(entry.bab);
  };
  const limit = session.length === "all" ? Infinity : Number(session.length);
  const validQuestions = session.questions.length <= limit
    && new Set(session.questions.map((question) => question.key)).size === session.questions.length
    && session.questions.every((question) => inBabs(question.key) && question.options.includes(question.key)
      && question.options.every((option, index) => inBabs(option)
        && question.options.slice(index + 1).every((other) => !kotobaConflict(option, other))));
  const validAnswers = session.answers.length <= session.questions.length && session.answers.every((answer, index) => {
    const question = session.questions[index];
    return answer.key === question.key && (answer.selectedKey === null || question.options.includes(answer.selectedKey));
  });
  const complete = session.answers.length === session.questions.length;
  const end = session.finishedAt ?? session.questionStartedAt;
  const elapsed = session.answers.reduce((sum, answer) => sum + answer.elapsedMs, 0);
  if (!validQuestions || !validAnswers || (session.finishedAt !== null && (!complete || session.questionStartedAt !== null))
    || (complete && session.questionStartedAt !== null) || (end !== null && end < session.startedAt)
    || (end !== null && elapsed > end - session.startedAt)) {
    ctx.addIssue({ code: "custom", message: "Sesi quiz tidak valid." });
  }
});

export function restoreKotobaQuiz(value: unknown): KotobaQuizSession | null {
  const result = SessionSchema.safeParse(value);
  return result.success ? result.data : null;
}

function entryOf(key: string): KotobaEntry {
  const entry = getKotoba(key);
  if (!entry) throw new Error("Kata tidak dikenal.");
  return entry;
}

export function getKotobaResults(session: KotobaQuizSession) {
  const rows = session.answers.map((answer, index) => ({
    ...answer,
    number: index + 1,
    entry: entryOf(answer.key),
    selected: answer.selectedKey === null ? null : entryOf(answer.selectedKey),
    skipped: answer.selectedKey === null,
    correct: answer.selectedKey === answer.key,
  }));
  const correctCount = rows.filter((row) => row.correct).length;
  const skippedCount = rows.filter((row) => row.skipped).length;
  const totalMs = rows.reduce((sum, row) => sum + row.elapsedMs, 0);
  return {
    rows, correctCount, skippedCount, totalMs,
    total: session.questions.length,
    accuracy: session.questions.length ? Math.round(correctCount / session.questions.length * 100) : 0,
    averageMs: rows.length ? totalMs / rows.length : 0,
    mistakes: rows.filter((row) => !row.correct),
    byBab: session.babs.map((bab) => {
      const babRows = rows.filter((row) => row.entry.bab === bab);
      return { bab, total: babRows.length, correct: babRows.filter((row) => row.correct).length };
    }).filter((item) => item.total > 0),
  };
}

export function formatBabs(babs: readonly number[]): string {
  return `Bab ${babs.join(", ")}`;
}
