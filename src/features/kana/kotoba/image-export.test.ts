import { describe, expect, it } from "vitest";
import { KOTOBA_BABS } from "./data";
import { advanceKotobaQuiz, answerKotoba, createKotobaQuiz, expireKotoba, getKotobaResults, judgeKotoba, revealKotoba, type KotobaQuizSession, type KotobaQuizSetup } from "./engine";
import { KOTOBA_REPORT_MAX_ROWS, kotobaImageFileName, kotobaReportLabels, kotobaRowVerdict, selectKotobaReportRows } from "./image-export";

const START = Date.parse("2026-11-01T19:00:00+07:00");
const SETUP: KotobaQuizSetup = { nickname: "Lans", babs: [1], front: "kana", scope: "semua", mode: "choice", length: "10", timeLimit: null };

/** Menjawab setiap kata: benar bila `correct(index)`, selain itu salah. */
function finish(setup: KotobaQuizSetup, correct: (index: number) => boolean): KotobaQuizSession {
  let now = START;
  let session = advanceKotobaQuiz(createKotobaQuiz(setup, START), now);
  for (const [index, question] of session.questions.entries()) {
    now += 1000;
    if (session.mode === "flip") {
      session = judgeKotoba(revealKotoba(session, question.key, now), question.key, correct(index) ? "correct" : "wrong", now + 500);
    } else {
      const selected = correct(index) ? question.key : question.options.find((key) => key !== question.key) ?? null;
      session = advanceKotobaQuiz(answerKotoba(session, question.key, selected, now), now + 500);
    }
    now += 500;
  }
  return session;
}

describe("ekspor rapor tebak kotoba", () => {
  it("memuat semua kata bila muat, dan hanya kata yang perlu diulang bila terlalu banyak", () => {
    const short = getKotobaResults(finish(SETUP, (index) => index % 2 === 0));
    expect(selectKotobaReportRows(short)).toEqual({ rows: short.rows, mistakesOnly: false, hidden: 0 });
    expect(selectKotobaReportRows(short, 4)).toEqual({ rows: short.mistakes.slice(0, 4), mistakesOnly: true, hidden: 1 });

    const everything = getKotobaResults(finish({ ...SETUP, babs: [...KOTOBA_BABS], length: "all", mode: "flip" }, (index) => index % 10 !== 0));
    expect(everything.rows.length).toBeGreaterThan(KOTOBA_REPORT_MAX_ROWS);
    const report = selectKotobaReportRows(everything);
    expect(report.mistakesOnly).toBe(true);
    expect(report.rows.length).toBeLessThanOrEqual(KOTOBA_REPORT_MAX_ROWS);
    expect(report.rows.every((row) => !row.correct)).toBe(true);
    expect(report.rows.length + report.hidden).toBe(everything.mistakes.length);
  });

  it("menuliskan label pengaturan dan penilaian per kata sesuai mode", () => {
    const flip = finish({ ...SETUP, mode: "flip", front: "kanji", scope: "inti", timeLimit: 4 }, (index) => index > 0);
    expect(kotobaReportLabels(flip)).toEqual(["Bab 1", "Depan kanji", "Balik kartu", "Kata inti", "Timer 4 dtk"]);
    const flipRows = getKotobaResults(flip).rows;
    expect(kotobaRowVerdict(flip, flipRows[0])).toBe("Salah");
    expect(kotobaRowVerdict(flip, flipRows[1])).toBe("Benar");

    const choice = finish(SETUP, (index) => index > 0);
    expect(kotobaReportLabels(choice)).toEqual(["Bab 1", "Depan kana", "4 pilihan"]);
    const [wrong, right] = getKotobaResults(choice).rows;
    expect(kotobaRowVerdict(choice, wrong)).toBe(`Salah: ${wrong.selected?.meaning}`);
    expect(kotobaRowVerdict(choice, right)).toBe("Benar");

    let timed = advanceKotobaQuiz(createKotobaQuiz({ ...SETUP, timeLimit: 3 }, START), START);
    timed = expireKotoba(timed, START + 3000);
    timed = advanceKotobaQuiz(answerKotoba(advanceKotobaQuiz(timed, START + 4000), timed.questions[1].key, null, START + 5000), START + 6000);
    const [timeout, skipped] = getKotobaResults(timed).rows;
    expect(kotobaRowVerdict(timed, timeout)).toBe("Waktu habis");
    expect(kotobaRowVerdict(timed, skipped)).toBe("Dilewati");
  });

  it("membuat nama file aman dari nickname dan bab", () => {
    const session = finish({ ...SETUP, nickname: "生徒 / Lans 🌸" }, () => true);
    expect(kotobaImageFileName(session, "summary")).toBe("tebak-kotoba-bab-1-生徒___Lans__-ringkasan.png");
    expect(kotobaImageFileName({ ...session, babs: [1, 2, 3] }, "full")).toBe("tebak-kotoba-3-bab-生徒___Lans__-laporan.png");
  });
});
