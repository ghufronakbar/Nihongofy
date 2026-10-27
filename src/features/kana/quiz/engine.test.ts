import { describe, expect, it } from "vitest";
import { getKanaByScript, type KanaScript } from "../data/kana";
import { answerQuestion, beginQuestion, CONFUSABLE_GROUPS, createQuiz, getQuizResults, QUIZ_LENGTH, restoreQuiz, type QuizSession } from "./engine";

const START = Date.parse("2026-10-27T09:00:00+07:00");

function complete(script: KanaScript, wrong = false): QuizSession {
  let session = createQuiz({ nickname: "生徒 🌸", script }, START);
  let now = START;
  for (const question of session.questions) {
    now += 320;
    session = beginQuestion(session, now);
    const correct = getKanaByScript(script).find((card) => card.key === question.kanaKey)?.romaji;
    const selection = wrong ? question.options.find((reading) => reading !== correct) : correct;
    if (!selection) throw new Error("Missing test answer");
    now += 1500;
    session = answerQuestion(session, question.kanaKey, selection, now);
  }
  return session;
}

describe.each(["hiragana", "katakana"] as const)("Quiz %s", (script) => {
  it("menguji tepat 46 kana sekali, dengan empat pilihan unik dan satu kunci", () => {
    const cards = getKanaByScript(script);
    for (let run = 0; run < 12; run++) {
      const quiz = createQuiz({ nickname: "Siswa", script }, START);
      expect(quiz.questions).toHaveLength(QUIZ_LENGTH);
      expect(new Set(quiz.questions.map((question) => question.kanaKey))).toEqual(new Set(cards.map((card) => card.key)));
      for (const question of quiz.questions) {
        const card = cards.find((item) => item.key === question.kanaKey);
        expect(new Set(question.options).size).toBe(4);
        expect(question.options).toContain(card?.romaji);
        if (card?.romaji === "wo") expect(question.options).not.toContain("o");
        if (card?.romaji === "o") expect(question.options).not.toContain("wo");
      }
    }
  });

  it("selalu menyertakan seluruh keluarga kana yang mirip, di kedua arah", () => {
    const quiz = createQuiz({ nickname: "Siswa", script }, START);
    for (const group of CONFUSABLE_GROUPS[script]) {
      for (const reading of group) {
        const question = quiz.questions.find((item) => item.kanaKey === `${script}-${reading}`);
        for (const confusable of group) expect(question?.options).toContain(confusable);
      }
    }
  });

  it("menyelesaikan 46 jawaban, menghitung ketepatan dan waktu tanpa jeda transisi", () => {
    const session = complete(script);
    const result = getQuizResults(session);
    expect(result.correctCount).toBe(46);
    expect(result.accuracy).toBe(100);
    expect(result.totalMs).toBe(46 * 1500);
    expect(result.averageMs).toBe(1500);
    expect(result.chart).toHaveLength(46);
    expect(result.mistakes).toHaveLength(0);
    expect(restoreQuiz(JSON.parse(JSON.stringify(session)) as unknown)).toEqual(session);
    expect(answerQuestion(session, session.questions[0].kanaKey, "a", START + 999_999)).toBe(session);
  });

  it("tetap menampilkan laporan lengkap saat seluruh jawaban salah", () => {
    const result = getQuizResults(complete(script, true));
    expect(result.accuracy).toBe(0);
    expect(result.rows).toHaveLength(46);
    expect(result.mistakes).toHaveLength(46);
    expect(result.slowestCorrect).toHaveLength(0);
    expect(result.mistakes.every((row) => row.selectedRomaji !== row.card.romaji)).toBe(true);
  });
});

it("mengunci satu jawaban dan mengabaikan klik berulang atau pilihan tidak valid", () => {
  const original = createQuiz({ nickname: "Siswa", script: "hiragana" }, START);
  const question = original.questions[0];
  expect(answerQuestion(original, question.kanaKey, question.options[0], START + 500)).toBe(original);
  const active = beginQuestion(original, START + 100);
  expect(answerQuestion(active, "hiragana-unknown", "a", START + 500)).toBe(active);
  expect(answerQuestion(active, question.kanaKey, "xyz", START + 500)).toBe(active);
  const answered = answerQuestion(active, question.kanaKey, question.options[0], START + 1500);
  expect(answered.answers[0].elapsedMs).toBe(1400);
  expect(answerQuestion(answered, question.kanaKey, question.options[1], START + 1501)).toBe(answered);
  const next = beginQuestion(answered, START + 2000);
  expect(answerQuestion(next, question.kanaKey, question.options[1], START + 2001)).toBe(next);
});

it("memulihkan timer soal setelah refresh tanpa memulai dari nol", () => {
  const active = beginQuestion(createQuiz({ nickname: "A", script: "katakana" }, START), START);
  const saved = restoreQuiz(JSON.parse(JSON.stringify(active)) as unknown);
  expect(saved).not.toBeNull();
  if (!saved) throw new Error("Snapshot missing");
  expect(beginQuestion(saved, START + 5000)).toBe(saved);
  const question = saved.questions[0];
  const answered = answerQuestion(saved, question.kanaKey, question.options[0], START + 9200);
  expect(answered.answers[0].elapsedMs).toBe(9200);
});

it("menolak snapshot rusak, duplikasi soal, jawaban tidak berurutan, dan hasil prematur", () => {
  const session = createQuiz({ nickname: "Siswa", script: "hiragana" }, START);
  expect(restoreQuiz(null)).toBeNull();
  expect(restoreQuiz({ ...session, version: 2 })).toBeNull();
  expect(restoreQuiz({ ...session, script: "katakana" })).toBeNull();
  expect(restoreQuiz({ ...session, questions: Array(46).fill(session.questions[0]) })).toBeNull();
  expect(restoreQuiz({ ...session, finishedAt: START })).toBeNull();
  expect(restoreQuiz({ ...session, answers: [{ kanaKey: session.questions[1].kanaKey, selectedRomaji: "a", elapsedMs: -1 }] })).toBeNull();
  const question = session.questions[0];
  expect(restoreQuiz({ ...session, questions: [{ ...question, options: ["a", "a", "a", "a"] }, ...session.questions.slice(1)] })).toBeNull();
});
