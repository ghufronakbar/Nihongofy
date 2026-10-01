import { describe, expect, it } from "vitest";
import {
  FLASHCARD_DEFAULT_CONFIG,
  FLASHCARD_DEFAULT_DISPLAY,
  parseFlashcardConfig,
  parseFlashcardDisplay,
} from "./schemas";
import {
  SETTINGS_FORM_DEFAULTS,
  SettingsFormSchema,
  formToSettings,
  parseSteps,
  settingsToForm,
} from "./settings-form";
import { describeTags } from "./taxonomy";

describe("learning steps", () => {
  it("diketik seperti di Anki, dipisah spasi atau koma", () => {
    expect(parseSteps(" 1m  2h,3h ")).toEqual(["1m", "2h", "3h"]);
  });

  it("form menolak step tidak valid dengan pesan yang menunjuk step-nya", () => {
    const result = SettingsFormSchema.safeParse({ ...SETTINGS_FORM_DEFAULTS, learningSteps: "1m 1d" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain('"1d"');
  });
});

describe("konversi form", () => {
  it("default form mengikuti pengaturan bawaan", () => {
    expect(SETTINGS_FORM_DEFAULTS).toMatchObject({
      learningSteps: "1m 2h 3h",
      relearningSteps: "1m 1h",
      desiredRetentionPercent: 95,
      textScale: 100,
      showFuriganaOnBack: true,
    });
  });

  it("bolak-balik tanpa kehilangan nilai", () => {
    const { config, display } = formToSettings(SETTINGS_FORM_DEFAULTS, FLASHCARD_DEFAULT_CONFIG);
    expect(config).toEqual(FLASHCARD_DEFAULT_CONFIG);
    expect(display).toEqual(FLASHCARD_DEFAULT_DISPLAY);
    expect(settingsToForm(config, display)).toEqual(SETTINGS_FORM_DEFAULTS);
  });

  it("mempertahankan setting yang tidak ada di form", () => {
    const base = { ...FLASHCARD_DEFAULT_CONFIG, leechThreshold: 4, startingEase: 2.1 };
    const { config } = formToSettings({ ...SETTINGS_FORM_DEFAULTS, newCardsPerDay: 5 }, base);
    expect(config).toMatchObject({ newCardsPerDay: 5, leechThreshold: 4, startingEase: 2.1 });
  });
});

describe("membaca pengaturan tersimpan", () => {
  it("satu field yang tidak valid lagi tidak menghapus pengaturan lain", () => {
    const config = parseFlashcardConfig({
      newCardsPerDay: 7,
      reviewSortOrder: "relativeOverdueness", // pilihan lama yang sudah diganti
    });
    expect(config.newCardsPerDay).toBe(7);
    expect(config.reviewSortOrder).toBe(FLASHCARD_DEFAULT_CONFIG.reviewSortOrder);
  });

  it("nilai yang bukan objek jatuh ke default", () => {
    expect(parseFlashcardConfig(null)).toEqual(FLASHCARD_DEFAULT_CONFIG);
    expect(parseFlashcardDisplay("x")).toEqual(FLASHCARD_DEFAULT_DISPLAY);
  });
});

describe("tag kartu", () => {
  it("tanpa tag level dan slug asing, urut per dimensi", () => {
    expect(describeTags(["food", "n5", "tidak-ada", "noun"]).map((tag) => tag.slug)).toEqual([
      "noun",
      "food",
    ]);
  });
});
