import { describe, expect, it } from "vitest";
import { shouldShowContextAudio, shouldShowQuestionContext } from "./question-media";

describe("question media display", () => {
  it("uses context audio while a question has no dedicated audio", () => {
    expect(shouldShowContextAudio("https://cdn.example.test/mondai.mp3", null)).toBe(true);
  });

  it("hides context audio when dedicated question audio exists", () => {
    expect(
      shouldShowContextAudio(
        "https://cdn.example.test/mondai.mp3",
        "https://cdn.example.test/question.mp3",
      ),
    ).toBe(false);
  });

  it("does not leave an empty context card after context audio is superseded", () => {
    expect(
      shouldShowQuestionContext(
        { storyText: null, storyImage: null, storyAudio: "https://cdn.example.test/mondai.mp3" },
        "https://cdn.example.test/question.mp3",
      ),
    ).toBe(false);
  });

  it("keeps text or image context visible with dedicated question audio", () => {
    expect(
      shouldShowQuestionContext(
        { storyText: "本文", storyImage: null, storyAudio: "https://cdn.example.test/mondai.mp3" },
        "https://cdn.example.test/question.mp3",
      ),
    ).toBe(true);
  });
});
