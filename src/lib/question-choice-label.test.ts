import { describe, expect, it } from "vitest";
import { questionChoiceFallbackLabel } from "./question-choice-label";

const baseQuestion = {
  questionAudio: null,
  questionImage: null,
  questionContext: null,
};

describe("questionChoiceFallbackLabel", () => {
  it("mempertahankan label audio bila pilihan hanya tersedia lewat audio", () => {
    expect(
      questionChoiceFallbackLabel(
        {
          ...baseQuestion,
          questionContext: { storyAudio: "https://cdn.example.test/audio.mp3", storyImage: null },
        },
        2,
      ),
    ).toBe("Pilihan dari audio");
  });

  it("menunjuk nomor pilihan pada gambar untuk soal visual tanpa audio", () => {
    expect(
      questionChoiceFallbackLabel(
        { ...baseQuestion, questionImage: "https://cdn.example.test/choices.png" },
        3,
      ),
    ).toBe("Pilihan 3 pada gambar");
  });

  it("memberikan label netral bila tidak ada media", () => {
    expect(questionChoiceFallbackLabel(baseQuestion, 4)).toBe("Pilihan 4");
  });
});
