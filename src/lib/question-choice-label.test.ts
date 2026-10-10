import { describe, expect, it } from "vitest";
import {
  questionChoiceFallbackLabel,
  questionPromptFallbackLabel,
} from "./question-choice-label";

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

describe("questionPromptFallbackLabel", () => {
  it("menampilkan instruksi audio untuk audio pada konteks", () => {
    expect(
      questionPromptFallbackLabel({
        ...baseQuestion,
        questionContext: { storyAudio: "https://cdn.example.test/audio.mp3", storyImage: null },
      }),
    ).toBe("Dengarkan rekaman audio di bawah, lalu tentukan pilihan jawaban yang tepat.");
  });

  it("menampilkan instruksi audio untuk audio pada soal", () => {
    expect(
      questionPromptFallbackLabel({
        ...baseQuestion,
        questionAudio: "https://cdn.example.test/question.mp3",
      }),
    ).toBe("Dengarkan rekaman audio di bawah, lalu tentukan pilihan jawaban yang tepat.");
  });

  it("tidak menampilkan fallback untuk konteks teks tanpa audio", () => {
    expect(
      questionPromptFallbackLabel({
        ...baseQuestion,
        questionContext: { storyAudio: null, storyImage: null },
      }),
    ).toBeNull();
  });

  it("tidak menampilkan fallback untuk soal berbasis gambar", () => {
    expect(
      questionPromptFallbackLabel({
        ...baseQuestion,
        questionImage: "https://cdn.example.test/question.png",
      }),
    ).toBeNull();
  });

  it("tidak menampilkan fallback bila soal tidak memiliki media", () => {
    expect(questionPromptFallbackLabel(baseQuestion)).toBeNull();
  });
});
