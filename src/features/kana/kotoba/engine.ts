import { z } from "zod";
import { getKotoba, getKotobaByBabs, inKotobaScope, KOTOBA_BABS, KOTOBA_CONFLICTS, KOTOBA_ENTRIES, KOTOBA_FAMILIES, KOTOBA_SCOPES, type KotobaEntry, type KotobaScope } from "./data";

export const KOTOBA_QUIZ_STORAGE_KEY = "nihongofy:kotoba-quiz:v1";
export const KOTOBA_OPTION_COUNT = 4;
/**
 * `10`/`20`: jumlah soal seluruh sesi. `10-bab`/`20-bab`: jumlah soal dari setiap bab terpilih
 * (bab yang katanya lebih sedikit memakai semua katanya). `all`: semua kata pada bab terpilih.
 */
export const KOTOBA_LENGTHS = ["10", "20", "10-bab", "20-bab", "all"] as const;
/** Bab dengan akurasi di bawah batas ini (persen) ditandai merah di hasil supaya bab yang lemah langsung terlihat. */
export const KOTOBA_WEAK_BAB_ACCURACY = 60;
export const KOTOBA_TIME_LIMIT = { min: 3, max: 300, default: 15 } as const;
/**
 * `choice`: pilih satu dari empat arti. `flip`: balik kartu lalu nilai sendiri benar/salah; setiap kata
 * tetap muncul sekali saja, tanpa antrean ulang seperti flashcard.
 */
export const KOTOBA_MODES = ["choice", "flip"] as const;

// Batas waktu per kata dalam detik; null berarti tanpa batas.
const TimeLimitSchema = z.number({ error: "Isi batas waktu dalam detik." })
  .int("Gunakan bilangan bulat.")
  .min(KOTOBA_TIME_LIMIT.min, `Minimal ${KOTOBA_TIME_LIMIT.min} detik.`)
  .max(KOTOBA_TIME_LIMIT.max, `Maksimal ${KOTOBA_TIME_LIMIT.max} detik.`)
  .nullable();

export const KotobaQuizSetupSchema = z.object({
  nickname: z.string().trim().min(1, "Isi nickname kamu terlebih dahulu.").max(32, "Maksimal 32 karakter."),
  babs: z.array(z.number().int().refine((bab) => KOTOBA_BABS.includes(bab)))
    .min(1, "Pilih minimal satu bab.")
    .refine((babs) => new Set(babs).size === babs.length, "Bab tidak boleh ganda."),
  front: z.enum(["kana", "kanji"]),
  // "inti" hanya menguji kosakata utama bab; pengecohnya juga diambil dari kata inti.
  scope: z.enum(KOTOBA_SCOPES),
  mode: z.enum(KOTOBA_MODES),
  length: z.enum(KOTOBA_LENGTHS),
  timeLimit: TimeLimitSchema,
});

export type KotobaQuizSetup = z.infer<typeof KotobaQuizSetupSchema>;
export type KotobaFront = KotobaQuizSetup["front"];
export type KotobaMode = KotobaQuizSetup["mode"];
export type KotobaLength = KotobaQuizSetup["length"];
export type KotobaVerdict = "correct" | "wrong";
/** Mode `flip` tidak memakai pilihan, jadi `options` kosong. */
export type KotobaQuestion = { key: string; options: string[] };
/**
 * `selectedKey` null berarti kata dilewati atau waktunya habis: kunci tetap ditampilkan, tetapi
 * tidak dihitung benar. Waktu habis dikenali dari `elapsedMs` yang mencapai batas waktu.
 * Mode `flip` selalu menyimpan `selectedKey` null; penilaian diri ada di `verdict`, dan kata yang
 * waktunya habis tidak punya `verdict`.
 */
export type KotobaAnswer = { key: string; selectedKey: string | null; elapsedMs: number; verdict?: KotobaVerdict };
export type KotobaQuizSession = KotobaQuizSetup & {
  version: 1;
  questions: KotobaQuestion[];
  answers: KotobaAnswer[];
  startedAt: number;
  questionStartedAt: number | null;
  /** Mode `flip`: waktu tebak saat kartu dibalik, menunggu penilaian benar/salah. */
  revealedMs: number | null;
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

/** Batas jumlah soal untuk `length`, atau null bila semua kata diuji. */
export function kotobaLengthLimit(length: KotobaLength): { count: number; perBab: boolean } | null {
  if (length === "all") return null;
  const perBab = length.endsWith("-bab");
  return { count: Number(perBab ? length.slice(0, -4) : length), perBab };
}

/** Mengambil soal dari daftar yang sudah diacak sesuai batas jumlah soal, urutan acaknya tetap. */
function takeKotoba(entries: readonly KotobaEntry[], length: KotobaLength): KotobaEntry[] {
  const limit = kotobaLengthLimit(length);
  if (!limit) return [...entries];
  if (!limit.perBab) return entries.slice(0, limit.count);
  const perBab = new Map<number, number>();
  return entries.filter((entry) => {
    const count = perBab.get(entry.bab) ?? 0;
    if (count >= limit.count) return false;
    perBab.set(entry.bab, count + 1);
    return true;
  });
}

/** Jumlah soal yang akan dibuat untuk pengaturan ini, untuk ditampilkan di form. */
export function countKotobaQuestions(babs: readonly number[], scope: KotobaScope, length: KotobaLength): number {
  return takeKotoba(getKotobaByBabs(babs, scope), length).length;
}

export function createKotobaQuiz(setup: KotobaQuizSetup, now: number, random: () => number = Math.random, onlyKeys?: readonly string[]): KotobaQuizSession {
  const validated = KotobaQuizSetupSchema.parse(setup);
  const babs = [...validated.babs].sort((a, b) => a - b);
  const pool = getKotobaByBabs(babs, validated.scope);
  const chosen = onlyKeys ? pool.filter((entry) => onlyKeys.includes(entry.key)) : pool;
  if (!chosen.length) throw new Error("Tidak ada kata untuk diuji.");
  // Pada mode per bab, kata diacak lintas bab lalu dibatasi per bab, jadi urutan bab tetap tercampur.
  const questions = takeKotoba(shuffled(chosen, random), validated.length)
    .map((entry) => ({ key: entry.key, options: validated.mode === "flip" ? [] : pickOptions(entry, pool, random) }));
  return { ...validated, babs, version: 1, questions, answers: [], startedAt: now, questionStartedAt: null, revealedMs: null, finishedAt: null };
}

/** Membuka soal berikutnya, atau menutup quiz bila semua soal sudah dijawab dan ditinjau. */
export function advanceKotobaQuiz(session: KotobaQuizSession, now: number): KotobaQuizSession {
  if (session.finishedAt !== null || session.questionStartedAt !== null) return session;
  const latest = Math.max(now, session.startedAt);
  if (session.answers.length === session.questions.length) return { ...session, finishedAt: latest };
  return { ...session, questionStartedAt: latest };
}

function timeLimitMs(session: KotobaQuizSession): number | null {
  return session.timeLimit === null ? null : session.timeLimit * 1000;
}

/** Sisa waktu kata yang sedang tampil dalam milidetik, atau null bila tanpa batas/tidak aktif. */
export function kotobaTimeLeft(session: KotobaQuizSession, now: number): number | null {
  const limit = timeLimitMs(session);
  if (limit === null || session.questionStartedAt === null || session.revealedMs !== null || session.finishedAt !== null) return null;
  return Math.max(0, limit - Math.max(0, now - session.questionStartedAt));
}

/** Waktu tebak kata aktif, atau null bila sudah melewati batas waktu. */
function guessElapsed(session: KotobaQuizSession, startedAt: number, now: number): number | null {
  const elapsedMs = Math.max(now, startedAt) - startedAt;
  const limit = timeLimitMs(session);
  return limit !== null && elapsedMs >= limit ? null : elapsedMs;
}

function recordTimeout(session: KotobaQuizSession, key: string): KotobaQuizSession {
  const limit = timeLimitMs(session) ?? 0;
  return { ...session, answers: [...session.answers, { key, selectedKey: null, elapsedMs: limit }], questionStartedAt: null, revealedMs: null };
}

export function answerKotoba(session: KotobaQuizSession, key: string, selectedKey: string | null, now: number): KotobaQuizSession {
  const question = session.questions[session.answers.length];
  if (session.mode !== "choice" || session.finishedAt !== null || session.questionStartedAt === null || question?.key !== key
    || (selectedKey !== null && !question.options.includes(selectedKey))) return session;
  const elapsedMs = guessElapsed(session, session.questionStartedAt, now);
  // Jawaban yang tiba setelah batas waktu (tab di latar belakang, refresh) tetap dicatat waktu habis.
  if (elapsedMs === null) return recordTimeout(session, key);
  return { ...session, answers: [...session.answers, { key, selectedKey, elapsedMs }], questionStartedAt: null };
}

/**
 * Mode `flip`: membalik kartu aktif. Waktu tebak berhenti di sini; menilai benar/salah tidak dihitung.
 * Kartu yang dibalik setelah batas waktu langsung dicatat waktu habis.
 */
export function revealKotoba(session: KotobaQuizSession, key: string, now: number): KotobaQuizSession {
  const question = session.questions[session.answers.length];
  if (session.mode !== "flip" || session.finishedAt !== null || session.questionStartedAt === null || session.revealedMs !== null
    || question?.key !== key) return session;
  const elapsedMs = guessElapsed(session, session.questionStartedAt, now);
  if (elapsedMs === null) return recordTimeout(session, key);
  return { ...session, revealedMs: elapsedMs };
}

/** Mode `flip`: mencatat penilaian diri lalu langsung membuka kartu berikutnya (atau menutup quiz). */
export function judgeKotoba(session: KotobaQuizSession, key: string, verdict: KotobaVerdict, now: number): KotobaQuizSession {
  const question = session.questions[session.answers.length];
  if (session.mode !== "flip" || session.finishedAt !== null || session.revealedMs === null || question?.key !== key) return session;
  const answer: KotobaAnswer = { key, selectedKey: null, elapsedMs: session.revealedMs, verdict };
  return advanceKotobaQuiz({ ...session, answers: [...session.answers, answer], questionStartedAt: null, revealedMs: null }, now);
}

/** Mencatat kata aktif sebagai waktu habis bila batas waktunya sudah lewat; di mode `flip` kartu ikut terbalik. */
export function expireKotoba(session: KotobaQuizSession, now: number): KotobaQuizSession {
  const question = session.questions[session.answers.length];
  return kotobaTimeLeft(session, now) === 0 && question ? recordTimeout(session, question.key) : session;
}

const TimestampSchema = z.number().int().min(0).max(8_640_000_000_000_000);
const KeySchema = z.string().max(20);
const SessionSchema = KotobaQuizSetupSchema.extend({
  // Sesi yang tersimpan sebelum ada pengaturan timer atau mode balik kartu tetap bisa dipulihkan.
  timeLimit: TimeLimitSchema.default(null),
  // Sesi yang tersimpan sebelum ada pilihan kata inti selalu memakai semua kata.
  scope: z.enum(KOTOBA_SCOPES).default("semua"),
  mode: z.enum(KOTOBA_MODES).default("choice"),
  version: z.literal(1),
  questions: z.array(z.object({ key: KeySchema, options: z.array(KeySchema).max(KOTOBA_OPTION_COUNT) })).min(1).max(KOTOBA_ENTRIES.length),
  answers: z.array(z.object({ key: KeySchema, selectedKey: KeySchema.nullable(), elapsedMs: TimestampSchema, verdict: z.enum(["correct", "wrong"]).optional() })).max(KOTOBA_ENTRIES.length),
  startedAt: TimestampSchema,
  questionStartedAt: TimestampSchema.nullable(),
  revealedMs: TimestampSchema.nullable().default(null),
  finishedAt: TimestampSchema.nullable(),
}).superRefine((session, ctx) => {
  const inPool = (key: string) => {
    const entry = getKotoba(key);
    return entry !== undefined && session.babs.includes(entry.bab) && inKotobaScope(entry, session.scope);
  };
  const limit = kotobaLengthLimit(session.length);
  const perBab = new Map<number, number>();
  for (const question of session.questions) {
    const bab = getKotoba(question.key)?.bab;
    if (bab !== undefined) perBab.set(bab, (perBab.get(bab) ?? 0) + 1);
  }
  const withinLimit = !limit || (limit.perBab ? [...perBab.values()].every((count) => count <= limit.count) : session.questions.length <= limit.count);
  const flip = session.mode === "flip";
  const limitMs = session.timeLimit === null ? null : session.timeLimit * 1000;
  const validQuestions = withinLimit
    && new Set(session.questions.map((question) => question.key)).size === session.questions.length
    && session.questions.every((question) => inPool(question.key) && (flip ? question.options.length === 0
      : question.options.length === KOTOBA_OPTION_COUNT && question.options.includes(question.key)
        && question.options.every((option, index) => inPool(option)
          && question.options.slice(index + 1).every((other) => !kotobaConflict(option, other)))));
  const validAnswers = session.answers.length <= session.questions.length && session.answers.every((answer, index) => {
    const question = session.questions[index];
    const timedOut = answer.selectedKey === null && answer.verdict === undefined && limitMs !== null && answer.elapsedMs === limitMs;
    const validChoice = flip ? answer.selectedKey === null && (answer.verdict !== undefined || timedOut)
      : answer.verdict === undefined && (answer.selectedKey === null || question.options.includes(answer.selectedKey));
    return answer.key === question.key && validChoice && (limitMs === null || answer.elapsedMs < limitMs || timedOut);
  });
  const complete = session.answers.length === session.questions.length;
  const validReveal = session.revealedMs === null || (flip && session.questionStartedAt !== null && !complete
    && (limitMs === null || session.revealedMs < limitMs));
  const end = session.finishedAt ?? session.questionStartedAt;
  // `revealedMs` milik kata aktif yang dimulai pada `questionStartedAt`, jadi tidak ikut dijumlahkan.
  const elapsed = session.answers.reduce((sum, answer) => sum + answer.elapsedMs, 0);
  if (!validQuestions || !validAnswers || !validReveal || (session.finishedAt !== null && (!complete || session.questionStartedAt !== null))
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

function timedOut(session: KotobaQuizSession, answer: KotobaAnswer): boolean {
  const limit = timeLimitMs(session);
  return answer.selectedKey === null && answer.verdict === undefined && limit !== null && answer.elapsedMs >= limit;
}

function isCorrect(session: KotobaQuizSession, answer: KotobaAnswer): boolean {
  return session.mode === "flip" ? answer.verdict === "correct" : answer.selectedKey === answer.key;
}

export function getKotobaResults(session: KotobaQuizSession) {
  const rows = session.answers.map((answer, index) => ({
    ...answer,
    number: index + 1,
    entry: entryOf(answer.key),
    selected: answer.selectedKey === null ? null : entryOf(answer.selectedKey),
    skipped: session.mode === "choice" && answer.selectedKey === null && !timedOut(session, answer),
    timedOut: timedOut(session, answer),
    correct: isCorrect(session, answer),
  }));
  const correctCount = rows.filter((row) => row.correct).length;
  const skippedCount = rows.filter((row) => row.skipped).length;
  const timedOutCount = rows.filter((row) => row.timedOut).length;
  const wrongCount = rows.length - correctCount - skippedCount - timedOutCount;
  const totalMs = rows.reduce((sum, row) => sum + row.elapsedMs, 0);
  return {
    rows, correctCount, wrongCount, skippedCount, timedOutCount, totalMs,
    total: session.questions.length,
    accuracy: session.questions.length ? Math.round(correctCount / session.questions.length * 100) : 0,
    averageMs: rows.length ? totalMs / rows.length : 0,
    mistakes: rows.filter((row) => !row.correct),
    byBab: groupKotobaRows(rows).map(({ bab, rows: babRows }) => {
      const correct = babRows.filter((row) => row.correct).length;
      return { bab, total: babRows.length, correct, accuracy: Math.round(correct / babRows.length * 100), mistakes: babRows.filter((row) => !row.correct) };
    }),
  };
}

/**
 * Mengelompokkan baris hasil per bab (bab naik), urutan soal di dalam bab tetap. Bab tanpa baris
 * tidak ikut, jadi sesi ulang kata tertentu hanya menampilkan bab yang benar-benar diuji.
 */
export function groupKotobaRows<T extends { entry: KotobaEntry }>(rows: readonly T[]): { bab: number; rows: T[] }[] {
  const groups = new Map<number, T[]>();
  for (const row of rows) groups.set(row.entry.bab, [...(groups.get(row.entry.bab) ?? []), row]);
  return [...groups.entries()].sort(([a], [b]) => a - b).map(([bab, babRows]) => ({ bab, rows: babRows }));
}

/** Label jumlah soal, mis. "10 kata", "10 kata per bab", atau "Semua kata". */
export function formatKotobaLength(length: KotobaLength): string {
  const limit = kotobaLengthLimit(length);
  return !limit ? "Semua kata" : `${limit.count} kata${limit.perBab ? " per bab" : ""}`;
}

export function formatBabs(babs: readonly number[]): string {
  return `Bab ${babs.join(", ")}`;
}
