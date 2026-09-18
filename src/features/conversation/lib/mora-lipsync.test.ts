import { describe, expect, it } from "vitest";
import { beforeEach } from "vitest";
import {
  DEFAULT_MORAE_PER_SECOND,
  getMoraePerSecond,
  moraDurationMs,
  recordUtteranceTiming,
  resetMoraCalibration,
  textToMouthShapes,
} from "./mora-lipsync";

describe("textToMouthShapes", () => {
  it("memetakan kana dasar ke vokalnya", () => {
    expect(textToMouthShapes("あいうえお")).toEqual(["a", "i", "u", "e", "o"]);
  });

  it("memakai bacaan furigana, bukan kanjinya", () => {
    // 来 tidak punya vokal sendiri; yang dibaca adalah き.
    expect(textToMouthShapes("{来|き}た")).toEqual(["i", "a"]);
  });

  it("menggabungkan kana kecil menjadi satu mora", () => {
    // きゃ = satu mora bervokal a, bukan dua mora.
    expect(textToMouthShapes("きゃく")).toEqual(["a", "u"]);
  });

  it("memperlakukan sokuon dan hatsuon sebagai mora tertutup", () => {
    expect(textToMouthShapes("がっこう")).toEqual(["a", "closed", "o", "u"]);
    expect(textToMouthShapes("にほん")).toEqual(["i", "o", "closed"]);
  });

  it("memanjangkan vokal sebelumnya pada choonpu", () => {
    expect(textToMouthShapes("コーヒー")).toEqual(["o", "o", "i", "i"]);
  });

  it("mengabaikan tanda baca dan kanji tanpa bacaan", () => {
    expect(textToMouthShapes("あ、い。")).toEqual(["a", "i"]);
    expect(textToMouthShapes("漢字")).toEqual([]);
  });

  it("mengabaikan slot dan menembus underline", () => {
    expect(textToMouthShapes("__あ__[_]い")).toEqual(["a", "i"]);
  });
});

describe("moraDurationMs", () => {
  beforeEach(resetMoraCalibration);

  it("mempercepat saat rate naik", () => {
    expect(moraDurationMs(1)).toBeCloseTo(1000 / DEFAULT_MORAE_PER_SECOND);
    expect(moraDurationMs(2)).toBeLessThan(moraDurationMs(1));
  });

  it("tidak membagi nol pada rate tidak valid", () => {
    expect(Number.isFinite(moraDurationMs(0))).toBe(true);
  });
});

describe("recordUtteranceTiming", () => {
  beforeEach(resetMoraCalibration);

  it("melambat ketika suara nyata ternyata lebih lama", () => {
    // 30 mora dalam 10 detik pada rate 1 = 3 mora/detik, jauh lebih lambat
    // daripada default.
    recordUtteranceTiming(30, 10_000, 1);
    expect(getMoraePerSecond()).toBeLessThan(DEFAULT_MORAE_PER_SECOND);
  });

  it("mendekati laju teramati setelah beberapa ucapan", () => {
    for (let i = 0; i < 12; i += 1) recordUtteranceTiming(30, 10_000, 1);
    expect(getMoraePerSecond()).toBeCloseTo(3, 1);
  });

  it("memperhitungkan rate persona", () => {
    // Rate 0.5 berarti perangkat menghasilkan 3 mora/detik pada rate 1.
    recordUtteranceTiming(30, 20_000, 0.5);
    expect(getMoraePerSecond()).toBeLessThan(DEFAULT_MORAE_PER_SECOND);
  });

  it("mengabaikan sampel yang terlalu pendek", () => {
    recordUtteranceTiming(2, 100, 1);
    expect(getMoraePerSecond()).toBe(DEFAULT_MORAE_PER_SECOND);
  });

  it("menahan hasil dalam rentang wajar", () => {
    for (let i = 0; i < 40; i += 1) recordUtteranceTiming(100, 1000, 1);
    expect(getMoraePerSecond()).toBeLessThanOrEqual(10);
  });
});
