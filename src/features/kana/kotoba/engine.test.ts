import { describe, expect, it } from "vitest";
import { getKotoba, getKotobaByBabs, KOTOBA_BABS, KOTOBA_CONFLICTS, KOTOBA_ENTRIES, KOTOBA_FAMILIES } from "./data";
import { advanceKotobaQuiz, answerKotoba, createKotobaQuiz, expireKotoba, getKotobaResults, kotobaConflict, kotobaFront, KotobaQuizSetupSchema, kotobaTimeLeft, restoreKotobaQuiz, type KotobaQuizSession, type KotobaQuizSetup } from "./engine";

const START = Date.parse("2026-10-29T09:00:00+07:00");
const SETUP: KotobaQuizSetup = { nickname: "生徒 🌸", babs: [1], front: "kana", length: "all", timeLimit: null };

function play(session: KotobaQuizSession, wrong = false): KotobaQuizSession {
  let now = START;
  let current = advanceKotobaQuiz(session, now);
  for (const question of current.questions) {
    now += 1500;
    const selection = wrong ? question.options.find((key) => key !== question.key) : question.key;
    if (!selection) throw new Error("Missing test answer");
    current = answerKotoba(current, question.key, selection, now);
    now += 4000;
    current = advanceKotobaQuiz(current, now);
  }
  return current;
}

describe("data kotoba", () => {
  it("memuat Bab 1-20 dengan key unik dan jumlah kata sesuai daftar", () => {
    expect(KOTOBA_BABS).toEqual(Array.from({ length: 20 }, (_, index) => index + 1));
    expect(KOTOBA_BABS.map((bab) => getKotobaByBabs([bab]).length)).toEqual([44, 47, 44, 59, 59, 54, 48, 57, 50, 47, 62, 50, 61, 73, 50, 51, 83, 46, 34, 16]);
    expect(new Set(KOTOBA_ENTRIES.map((entry) => entry.key)).size).toBe(KOTOBA_ENTRIES.length);
    for (const entry of KOTOBA_ENTRIES) {
      expect(entry.kana.trim()).not.toBe("");
      expect(entry.meaning.trim()).not.toBe("");
      expect(entry.kana).not.toMatch(/^ー/);
    }
  });

  it("hanya merujuk key yang ada pada grup konflik dan kelompok sejenis", () => {
    for (const group of [...KOTOBA_CONFLICTS, ...KOTOBA_FAMILIES]) {
      for (const key of group) expect(getKotoba(key), key).toBeDefined();
    }
  });

  it("menandai kata dengan arti atau tulisan depan yang sama sebagai konflik", () => {
    for (const [index, a] of KOTOBA_ENTRIES.entries()) {
      for (const b of KOTOBA_ENTRIES.slice(index + 1)) {
        const sameMeaning = a.meaning.toLowerCase() === b.meaning.toLowerCase();
        const sameFront = a.kana === b.kana || kotobaFront(a, "kanji") === kotobaFront(b, "kanji");
        if (sameMeaning || sameFront) expect(kotobaConflict(a.key, b.key), `${a.kana} / ${b.kana}`).toBe(true);
      }
    }
  });

  it("menampilkan kanji bila diminta dan kembali ke kana bila kata tidak punya kanji", () => {
    const watashi = KOTOBA_ENTRIES.find((entry) => entry.kana === "わたし");
    const kore = KOTOBA_ENTRIES.find((entry) => entry.kana === "これ");
    if (!watashi || !kore) throw new Error("Missing fixture");
    expect(kotobaFront(watashi, "kana")).toBe("わたし");
    expect(kotobaFront(watashi, "kanji")).toBe("私");
    expect(kotobaFront(kore, "kanji")).toBe("これ");
  });
});

describe.each(KOTOBA_BABS)("Tebak kotoba Bab %i", (bab) => {
  it("menguji setiap kata sekali dengan empat pilihan tanpa arti yang bertumpuk", () => {
    for (let run = 0; run < 8; run++) {
      const quiz = createKotobaQuiz({ ...SETUP, babs: [bab] }, START);
      const pool = getKotobaByBabs([bab]);
      expect(new Set(quiz.questions.map((question) => question.key))).toEqual(new Set(pool.map((entry) => entry.key)));
      for (const question of quiz.questions) {
        expect(question.options).toHaveLength(4);
        expect(question.options).toContain(question.key);
        for (const [index, option] of question.options.entries()) {
          expect(getKotoba(option)?.bab).toBe(bab);
          for (const other of question.options.slice(index + 1)) expect(kotobaConflict(option, other)).toBe(false);
        }
      }
    }
  });
});

it("mengutamakan kata sejenis sebagai pengecoh", () => {
  const quiz = createKotobaQuiz({ ...SETUP, babs: [4] }, START);
  const monday = quiz.questions.find((question) => getKotoba(question.key)?.kana === "げつようび");
  expect(monday?.options.every((key) => getKotoba(key)?.meaning.startsWith("hari "))).toBe(true);
});

it("membatasi jumlah soal, menggabungkan beberapa bab, dan bisa mengulang kata tertentu saja", () => {
  const short = createKotobaQuiz({ ...SETUP, babs: [5, 2], length: "10" }, START);
  expect(short.babs).toEqual([2, 5]);
  expect(short.questions).toHaveLength(10);
  const everything = createKotobaQuiz({ ...SETUP, babs: [...KOTOBA_BABS] }, START);
  expect(everything.questions).toHaveLength(KOTOBA_ENTRIES.length);
  expect(restoreKotobaQuiz(JSON.parse(JSON.stringify(everything)) as unknown)).toEqual(everything);
  const keys = short.questions.slice(0, 3).map((question) => question.key);
  const retry = createKotobaQuiz({ ...SETUP, babs: [2, 5] }, START, Math.random, keys);
  expect(retry.questions.map((question) => question.key).sort()).toEqual([...keys].sort());
  expect(() => createKotobaQuiz({ ...SETUP, babs: [] }, START)).toThrow();
  expect(() => createKotobaQuiz({ ...SETUP, babs: [21] }, START)).toThrow();
});

it("membuka kartu, mengunci jawaban, menampilkan bagian belakang, lalu lanjut tanpa menghitung waktu baca", () => {
  const original = createKotobaQuiz({ ...SETUP, length: "10" }, START);
  const question = original.questions[0];
  expect(answerKotoba(original, question.key, question.key, START + 100)).toBe(original);
  const open = advanceKotobaQuiz(original, START + 200);
  expect(advanceKotobaQuiz(open, START + 300)).toBe(open);
  expect(answerKotoba(open, "bab-9-01", question.key, START + 500)).toBe(open);
  expect(answerKotoba(open, question.key, "bab-9-01", START + 500)).toBe(open);
  const answered = answerKotoba(open, question.key, question.options[0], START + 1700);
  expect(answered.answers[0].elapsedMs).toBe(1500);
  expect(answered.questionStartedAt).toBeNull();
  expect(answerKotoba(answered, question.key, question.options[1], START + 1800)).toBe(answered);
  const next = advanceKotobaQuiz(answered, START + 9000);
  expect(next.questionStartedAt).toBe(START + 9000);
  expect(next.finishedAt).toBeNull();
});

it("menyelesaikan quiz setelah kartu terakhir ditinjau dan menghitung hasil per bab", () => {
  const session = play(createKotobaQuiz({ ...SETUP, babs: [1, 3] }, START));
  expect(session.finishedAt).not.toBeNull();
  const result = getKotobaResults(session);
  expect(result.correctCount).toBe(88);
  expect(result.accuracy).toBe(100);
  expect(result.averageMs).toBe(1500);
  expect(result.byBab).toEqual([{ bab: 1, total: 44, correct: 44 }, { bab: 3, total: 44, correct: 44 }]);
  expect(restoreKotobaQuiz(JSON.parse(JSON.stringify(session)) as unknown)).toEqual(session);

  const wrong = getKotobaResults(play(createKotobaQuiz({ ...SETUP, length: "20" }, START), true));
  expect(wrong.accuracy).toBe(0);
  expect(wrong.mistakes).toHaveLength(20);
  expect(wrong.mistakes.every((row) => row.selected !== null && row.selected.meaning !== row.entry.meaning)).toBe(true);
  expect(wrong.skippedCount).toBe(0);
});

it("melewati kata: kunci tetap dibuka, tidak dihitung benar, dan ikut daftar ulang", () => {
  let session = advanceKotobaQuiz(createKotobaQuiz({ ...SETUP, length: "10" }, START), START);
  const [first, second] = session.questions;
  session = answerKotoba(session, first.key, null, START + 3000);
  expect(session.answers[0]).toEqual({ key: first.key, selectedKey: null, elapsedMs: 3000 });
  expect(session.questionStartedAt).toBeNull();
  expect(answerKotoba(session, first.key, null, START + 3100)).toBe(session);
  expect(answerKotoba(session, second.key, null, START + 3100)).toBe(session);
  expect(restoreKotobaQuiz(JSON.parse(JSON.stringify(session)) as unknown)).toEqual(session);
  session = advanceKotobaQuiz(session, START + 5000);
  session = answerKotoba(session, second.key, second.key, START + 6000);
  const result = getKotobaResults(session);
  expect(result.correctCount).toBe(1);
  expect(result.skippedCount).toBe(1);
  expect(result.mistakes.map((row) => row.key)).toEqual([first.key]);
  expect(result.mistakes[0]).toMatchObject({ skipped: true, selected: null, correct: false });
});

it("memulihkan sesi saat kartu belakang sedang dibaca", () => {
  const open = advanceKotobaQuiz(createKotobaQuiz({ ...SETUP, length: "10" }, START), START);
  const answered = answerKotoba(open, open.questions[0].key, open.questions[0].key, START + 2000);
  expect(restoreKotobaQuiz(JSON.parse(JSON.stringify(answered)) as unknown)).toEqual(answered);
});

it("menolak snapshot rusak, bab yang tidak dipilih, pilihan bertumpuk, dan hasil prematur", () => {
  const session = createKotobaQuiz({ ...SETUP, length: "10" }, START);
  const question = session.questions[0];
  expect(restoreKotobaQuiz(null)).toBeNull();
  expect(restoreKotobaQuiz({ ...session, version: 2 })).toBeNull();
  expect(restoreKotobaQuiz({ ...session, babs: [2] })).toBeNull();
  expect(restoreKotobaQuiz({ ...session, length: "all", questions: [...session.questions, ...session.questions] })).toBeNull();
  expect(restoreKotobaQuiz({ ...session, finishedAt: START })).toBeNull();
  expect(restoreKotobaQuiz({ ...session, questions: [{ ...question, options: [question.key, question.key, question.key, question.key] }, ...session.questions.slice(1)] })).toBeNull();
  expect(restoreKotobaQuiz({ ...session, answers: [{ key: session.questions[1].key, selectedKey: session.questions[1].key, elapsedMs: 0 }] })).toBeNull();
  const sensei = getKotoba("bab-1-11");
  const kyoushi = getKotoba("bab-1-12");
  if (!sensei || !kyoushi) throw new Error("Missing fixture");
  const others = getKotobaByBabs([1]).filter((entry) => !kotobaConflict(entry.key, sensei.key)).slice(0, 2).map((entry) => entry.key);
  expect(restoreKotobaQuiz({ ...session, questions: [{ key: sensei.key, options: [sensei.key, kyoushi.key, ...others] }, ...session.questions.slice(1).filter((item) => item.key !== sensei.key)] })).toBeNull();
});

describe("timer per kata", () => {
  it("menerima detik bulat 3-300 atau tanpa batas", () => {
    for (const timeLimit of [null, 3, 15, 300]) expect(KotobaQuizSetupSchema.safeParse({ ...SETUP, timeLimit }).success).toBe(true);
    for (const timeLimit of [0, 2, 301, 7.5, Number.NaN]) expect(KotobaQuizSetupSchema.safeParse({ ...SETUP, timeLimit }).success).toBe(false);
  });

  it("menghitung sisa waktu dan mencatat waktu habis tepat pada batasnya", () => {
    const open = advanceKotobaQuiz(createKotobaQuiz({ ...SETUP, length: "10", timeLimit: 10 }, START), START);
    const question = open.questions[0];
    expect(kotobaTimeLeft(open, START + 4000)).toBe(6000);
    expect(expireKotoba(open, START + 9999)).toBe(open);
    const expired = expireKotoba(open, START + 10_000);
    expect(expired.answers[0]).toEqual({ key: question.key, selectedKey: null, elapsedMs: 10_000 });
    expect(kotobaTimeLeft(expired, START + 10_000)).toBeNull();
    expect(restoreKotobaQuiz(JSON.parse(JSON.stringify(expired)) as unknown)).toEqual(expired);
  });

  it("mencatat jawaban yang terlambat sebagai waktu habis, bukan jawaban", () => {
    const open = advanceKotobaQuiz(createKotobaQuiz({ ...SETUP, length: "10", timeLimit: 5 }, START), START);
    const question = open.questions[0];
    const late = answerKotoba(open, question.key, question.key, START + 30_000);
    expect(late.answers[0]).toEqual({ key: question.key, selectedKey: null, elapsedMs: 5000 });
    const onTime = answerKotoba(open, question.key, question.key, START + 4999);
    expect(onTime.answers[0].selectedKey).toBe(question.key);
  });

  it("memisahkan waktu habis dari kata yang dilewati di hasil", () => {
    let session = advanceKotobaQuiz(createKotobaQuiz({ ...SETUP, length: "10", timeLimit: 8 }, START), START);
    const [first, second, third] = session.questions;
    session = advanceKotobaQuiz(answerKotoba(session, first.key, null, START + 2000), START + 3000);
    session = advanceKotobaQuiz(expireKotoba(session, START + 11_000), START + 12_000);
    session = answerKotoba(session, third.key, third.key, START + 13_000);
    const result = getKotobaResults(session);
    expect(result.rows.map((row) => [row.key, row.skipped, row.timedOut, row.correct])).toEqual([
      [first.key, true, false, false], [second.key, false, true, false], [third.key, false, false, true],
    ]);
    expect([result.correctCount, result.skippedCount, result.timedOutCount]).toEqual([1, 1, 1]);
  });

  it("menolak snapshot dengan waktu jawaban melebihi batas dan memulihkan sesi lama tanpa timer", () => {
    const open = advanceKotobaQuiz(createKotobaQuiz({ ...SETUP, length: "10", timeLimit: 5 }, START), START);
    const question = open.questions[0];
    const answered = answerKotoba(open, question.key, question.key, START + 1000);
    expect(restoreKotobaQuiz({ ...answered, answers: [{ ...answered.answers[0], elapsedMs: 5000 }] })).toBeNull();
    expect(restoreKotobaQuiz({ ...answered, answers: [{ ...answered.answers[0], selectedKey: null, elapsedMs: 6000 }] })).toBeNull();
    const legacy: Record<string, unknown> = { ...createKotobaQuiz({ ...SETUP, length: "10" }, START) };
    delete legacy.timeLimit;
    expect(restoreKotobaQuiz(legacy)?.timeLimit).toBeNull();
  });
});
