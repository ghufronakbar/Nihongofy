import { describe, expect, it } from "vitest";
import { getKotoba, getKotobaByBabs, KOTOBA_BABS, KOTOBA_CONFLICTS, KOTOBA_ENTRIES, KOTOBA_FAMILIES, type KotobaKind } from "./data";
import { advanceKotobaQuiz, answerKotoba, createKotobaQuiz, expireKotoba, getKotobaResults, judgeKotoba, kotobaConflict, kotobaFront, KotobaQuizSetupSchema, kotobaTimeLeft, restoreKotobaQuiz, revealKotoba, type KotobaQuizSession, type KotobaQuizSetup } from "./engine";

const START = Date.parse("2026-10-29T09:00:00+07:00");
const SETUP: KotobaQuizSetup = { nickname: "生徒 🌸", babs: [1], front: "kana", scope: "semua", mode: "choice", length: "all", timeLimit: null };

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
  it("memuat Bab 1-25 dengan key unik dan jumlah kata sesuai daftar", () => {
    expect(KOTOBA_BABS).toEqual(Array.from({ length: 25 }, (_, index) => index + 1));
    expect(KOTOBA_BABS.map((bab) => getKotobaByBabs([bab]).length)).toEqual([45, 47, 44, 59, 59, 54, 48, 57, 50, 47, 62, 50, 61, 73, 50, 51, 83, 46, 34, 16, 40, 20, 29, 17, 30]);
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

  it("memisahkan kata inti dari kosakata referensi dan nama diri", () => {
    const count = (kind: KotobaKind) => KOTOBA_BABS.map((bab) => getKotobaByBabs([bab]).filter((entry) => entry.kind === kind).length);
    expect(count("inti")).toEqual([45, 47, 41, 54, 55, 52, 46, 57, 50, 47, 61, 47, 29, 44, 22, 51, 32, 25, 21, 14, 26, 17, 28, 17, 14]);
    expect(count("referensi")).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 32, 29, 28, 0, 51, 21, 13, 2, 14, 3, 0, 0, 16]);
    expect(count("nama")).toEqual([0, 0, 3, 5, 4, 2, 2, 0, 0, 0, 1, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0]);
    expect(getKotobaByBabs(KOTOBA_BABS, "inti")).toHaveLength(942);
    for (const bab of KOTOBA_BABS) {
      // Kosakata referensi selalu menjadi ekor daftar bab.
      const kinds = getKotobaByBabs([bab]).map((entry) => entry.kind);
      const first = kinds.indexOf("referensi");
      if (first >= 0) expect(kinds.slice(first).every((kind) => kind === "referensi"), `Bab ${bab}`).toBe(true);
    }
    for (const entry of KOTOBA_ENTRIES) expect(entry.topic !== null, entry.key).toBe(entry.kind === "referensi");
    expect(getKotobaByBabs([1], "inti").map((entry) => entry.kana)).toContain("インドネシア");
    expect(getKotoba("bab-15-34")).toMatchObject({ kana: "べんごし", kind: "referensi", topic: "pekerjaan" });
    expect(getKotoba("bab-4-56")).toMatchObject({ kana: "ペキン", kind: "nama" });
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

  it("menguji kata inti saja dengan pengecoh yang juga kata inti", () => {
    for (let run = 0; run < 8; run++) {
      const quiz = createKotobaQuiz({ ...SETUP, babs: [bab], scope: "inti" }, START);
      const pool = getKotobaByBabs([bab], "inti");
      expect(new Set(quiz.questions.map((question) => question.key))).toEqual(new Set(pool.map((entry) => entry.key)));
      for (const question of quiz.questions) {
        expect(question.options).toHaveLength(4);
        for (const [index, option] of question.options.entries()) {
          expect(getKotoba(option)).toMatchObject({ bab, kind: "inti" });
          for (const other of question.options.slice(index + 1)) expect(kotobaConflict(option, other)).toBe(false);
        }
      }
      expect(restoreKotobaQuiz(JSON.parse(JSON.stringify(quiz)) as unknown)).toEqual(quiz);
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
  expect(() => createKotobaQuiz({ ...SETUP, babs: [26] }, START)).toThrow();
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
  expect(result.correctCount).toBe(89);
  expect(result.accuracy).toBe(100);
  expect(result.averageMs).toBe(1500);
  expect(result.byBab).toEqual([{ bab: 1, total: 45, correct: 45 }, { bab: 3, total: 44, correct: 44 }]);
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

describe("kata inti", () => {
  it("memulihkan sesi lama tanpa pilihan kata sebagai semua kata", () => {
    const legacy: Record<string, unknown> = { ...createKotobaQuiz({ ...SETUP, length: "10" }, START) };
    delete legacy.scope;
    expect(restoreKotobaQuiz(legacy)?.scope).toBe("semua");
  });

  it("menolak snapshot kata inti yang memuat kata tambahan", () => {
    const everything = createKotobaQuiz({ ...SETUP, babs: [13] }, START);
    expect(everything.questions.some((question) => getKotoba(question.key)?.kind === "referensi")).toBe(true);
    expect(restoreKotobaQuiz({ ...everything, scope: "inti" })).toBeNull();
    const core = createKotobaQuiz({ ...SETUP, babs: [13], scope: "inti" }, START);
    expect(core.questions).toHaveLength(29);
    // Ganti satu pengecoh dengan モスク (kosakata referensi): sah untuk semua kata, tidak untuk inti.
    const [question, ...rest] = core.questions;
    const tampered = { ...core, questions: [{ ...question, options: [question.key, "bab-13-48", ...question.options.filter((option) => option !== question.key).slice(1)] }, ...rest] };
    expect(restoreKotobaQuiz({ ...tampered, scope: "semua" })).not.toBeNull();
    expect(restoreKotobaQuiz(tampered)).toBeNull();
  });
});

describe("mode balik kartu", () => {
  const FLIP: KotobaQuizSetup = { ...SETUP, mode: "flip", length: "10" };
  const roundTrip = (session: KotobaQuizSession) => restoreKotobaQuiz(JSON.parse(JSON.stringify(session)) as unknown);

  it("menguji setiap kata sekali tanpa pilihan jawaban", () => {
    const quiz = createKotobaQuiz({ ...FLIP, length: "all" }, START);
    expect(new Set(quiz.questions.map((question) => question.key)).size).toBe(getKotobaByBabs([1]).length);
    expect(quiz.questions.every((question) => question.options.length === 0)).toBe(true);
    expect(roundTrip(quiz)).toEqual(quiz);
  });

  it("membalik kartu, menghentikan waktu tebak, lalu penilaian langsung membuka kata berikutnya", () => {
    const open = advanceKotobaQuiz(createKotobaQuiz(FLIP, START), START);
    const [first, second] = open.questions;
    expect(answerKotoba(open, first.key, null, START + 100)).toBe(open);
    expect(judgeKotoba(open, first.key, "correct", START + 100)).toBe(open);
    expect(revealKotoba(open, second.key, START + 100)).toBe(open);
    const revealed = revealKotoba(open, first.key, START + 2500);
    expect(revealed.revealedMs).toBe(2500);
    expect(revealed.answers).toHaveLength(0);
    expect(revealKotoba(revealed, first.key, START + 3000)).toBe(revealed);
    expect(roundTrip(revealed)).toEqual(revealed);
    const judged = judgeKotoba(revealed, first.key, "wrong", START + 9000);
    expect(judged.answers[0]).toEqual({ key: first.key, selectedKey: null, elapsedMs: 2500, verdict: "wrong" });
    expect(judged.revealedMs).toBeNull();
    expect(judged.questionStartedAt).toBe(START + 9000);
    expect(judgeKotoba(judged, first.key, "correct", START + 9100)).toBe(judged);
    expect(roundTrip(judged)).toEqual(judged);
  });

  it("menutup quiz setelah kata terakhir dinilai dan menghitung rapor dari penilaian diri", () => {
    let now = START;
    let session = advanceKotobaQuiz(createKotobaQuiz(FLIP, START), now);
    for (const [index, question] of session.questions.entries()) {
      now += 1000;
      session = revealKotoba(session, question.key, now);
      now += 3000;
      session = judgeKotoba(session, question.key, index < 7 ? "correct" : "wrong", now);
    }
    expect(session.finishedAt).toBe(now);
    const result = getKotobaResults(session);
    expect([result.correctCount, result.wrongCount, result.skippedCount, result.timedOutCount]).toEqual([7, 3, 0, 0]);
    expect(result.accuracy).toBe(70);
    expect(result.averageMs).toBe(1000);
    expect(result.mistakes.map((row) => row.key)).toEqual(session.questions.slice(7).map((question) => question.key));
    expect(roundTrip(session)).toEqual(session);
  });

  it("timer langsung membalik kartu dan mencatat waktu habis tanpa penilaian", () => {
    const open = advanceKotobaQuiz(createKotobaQuiz({ ...FLIP, timeLimit: 5 }, START), START);
    const question = open.questions[0];
    expect(kotobaTimeLeft(open, START + 1000)).toBe(4000);
    const expired = expireKotoba(open, START + 5000);
    expect(expired.answers[0]).toEqual({ key: question.key, selectedKey: null, elapsedMs: 5000 });
    expect(expired.questionStartedAt).toBeNull();
    expect(judgeKotoba(expired, question.key, "correct", START + 5100)).toBe(expired);
    expect(roundTrip(expired)).toEqual(expired);
    const late = revealKotoba(open, question.key, START + 60_000);
    expect(late.answers[0]).toEqual({ key: question.key, selectedKey: null, elapsedMs: 5000 });
    expect(getKotobaResults(advanceKotobaQuiz(expired, START + 6000)).rows[0]).toMatchObject({ timedOut: true, skipped: false, correct: false });

    const revealed = revealKotoba(open, question.key, START + 4000);
    expect(kotobaTimeLeft(revealed, START + 30_000)).toBeNull();
    expect(expireKotoba(revealed, START + 30_000)).toBe(revealed);
  });

  it("menolak snapshot mode balik kartu yang tidak konsisten", () => {
    const open = advanceKotobaQuiz(createKotobaQuiz({ ...FLIP, timeLimit: 5 }, START), START);
    const question = open.questions[0];
    const choice = createKotobaQuiz({ ...SETUP, length: "10" }, START);
    expect(restoreKotobaQuiz({ ...choice, mode: "flip" })).toBeNull();
    expect(restoreKotobaQuiz({ ...open, mode: "choice" })).toBeNull();
    expect(restoreKotobaQuiz({ ...open, revealedMs: 5000 })).toBeNull();
    expect(restoreKotobaQuiz({ ...choice, revealedMs: 0 })).toBeNull();
    expect(restoreKotobaQuiz({ ...open, questionStartedAt: START + 10_000, answers: [{ key: question.key, selectedKey: question.key, elapsedMs: 100, verdict: "correct" }] })).toBeNull();
    expect(restoreKotobaQuiz({ ...open, questionStartedAt: START + 10_000, answers: [{ key: question.key, selectedKey: null, elapsedMs: 100 }] })).toBeNull();
    const legacy: Record<string, unknown> = { ...choice };
    delete legacy.mode;
    delete legacy.revealedMs;
    expect(restoreKotobaQuiz(legacy)).toEqual(choice);
  });
});
