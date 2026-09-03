import { describe, expect, it } from "vitest";
import { FLASHCARD_DEFAULT_PRESET_CONFIG } from "./schemas";
import {
  PresetFormSchema,
  configToForm,
  formToConfig,
  formatFsrsParameters,
  formatSteps,
  parseFsrsParameters,
  parseSteps,
} from "./preset-form";

describe("parsing steps", () => {
  it("memisahkan dengan spasi maupun koma", () => {
    expect(parseSteps("1m 10m")).toEqual(["1m", "10m"]);
    expect(parseSteps("1m, 10m,  1h")).toEqual(["1m", "10m", "1h"]);
  });

  it("mentoleransi spasi berlebih dan input kosong", () => {
    expect(parseSteps("   10m   ")).toEqual(["10m"]);
    expect(parseSteps("")).toEqual([]);
    expect(parseSteps("   ")).toEqual([]);
  });

  it("bolak-balik tanpa kehilangan nilai", () => {
    expect(parseSteps(formatSteps(["1m", "10m", "4h"]))).toEqual(["1m", "10m", "4h"]);
  });
});

describe("parsing parameter FSRS", () => {
  it("menerima pemisah koma maupun spasi", () => {
    expect(parseFsrsParameters("0.2, 1.3 2.4")).toEqual([0.2, 1.3, 2.4]);
  });

  it("bolak-balik mempertahankan 21 nilai", () => {
    const original = FLASHCARD_DEFAULT_PRESET_CONFIG.fsrsParameters;
    expect(parseFsrsParameters(formatFsrsParameters(original))).toEqual(original);
  });
});

describe("validasi form", () => {
  const valid = configToForm("Default", FLASHCARD_DEFAULT_PRESET_CONFIG);

  it("nilai default lolos validasi", () => {
    expect(PresetFormSchema.safeParse(valid).success).toBe(true);
  });

  it("menerima angka yang datang sebagai string dari input HTML", () => {
    const parsed = PresetFormSchema.safeParse({
      ...valid,
      newCardsPerDay: "35",
      desiredRetentionPercent: "88",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.newCardsPerDay).toBe(35);
      expect(parsed.data.desiredRetentionPercent).toBe(88);
    }
  });

  it("menolak step yang tidak valid dengan menyebut step-nya", () => {
    const parsed = PresetFormSchema.safeParse({ ...valid, learningSteps: "1m 1d" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toContain('"1d"');
    }
  });

  it("menolak jumlah parameter FSRS yang salah dan menyebut jumlahnya", () => {
    const parsed = PresetFormSchema.safeParse({ ...valid, fsrsParameters: "1, 2, 3" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toContain("ditemukan 3");
    }
  });

  it("menolak desired retention di luar 70-99 persen", () => {
    expect(
      PresetFormSchema.safeParse({ ...valid, desiredRetentionPercent: 50 }).success,
    ).toBe(false);
    expect(
      PresetFormSchema.safeParse({ ...valid, desiredRetentionPercent: 100 }).success,
    ).toBe(false);
  });

  it("steps boleh dikosongkan sepenuhnya", () => {
    // Anki memperlakukan steps kosong sebagai "langsung lulus".
    expect(PresetFormSchema.safeParse({ ...valid, learningSteps: "" }).success).toBe(true);
  });
});

describe("konversi form <-> config", () => {
  it("bolak-balik menghasilkan config yang identik", () => {
    const form = configToForm("Default", FLASHCARD_DEFAULT_PRESET_CONFIG);
    const parsed = PresetFormSchema.parse(form);
    expect(formToConfig(parsed)).toEqual(FLASHCARD_DEFAULT_PRESET_CONFIG);
  });

  it("retention ditampilkan sebagai persen dan disimpan sebagai pecahan", () => {
    const form = configToForm("Default", FLASHCARD_DEFAULT_PRESET_CONFIG);
    expect(form.desiredRetentionPercent).toBe(90);

    const config = formToConfig(
      PresetFormSchema.parse({ ...form, desiredRetentionPercent: 85 }),
    );
    expect(config.desiredRetention).toBe(0.85);
  });

  it("steps yang diketik user tersimpan sebagai array", () => {
    const form = configToForm("Default", FLASHCARD_DEFAULT_PRESET_CONFIG);
    const config = formToConfig(
      PresetFormSchema.parse({ ...form, learningSteps: "5m, 25m 2h" }),
    );
    expect(config.learningSteps).toEqual(["5m", "25m", "2h"]);
  });
});
