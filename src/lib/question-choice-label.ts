type QuestionChoiceMedia = {
  questionAudio: string | null;
  questionImage: string | null;
  questionContext: {
    storyAudio: string | null;
    storyImage: string | null;
  } | null;
};

const AUDIO_QUESTION_PROMPT =
  "Dengarkan rekaman audio di bawah, lalu tentukan pilihan jawaban yang tepat.";

export function questionPromptFallbackLabel(
  question: QuestionChoiceMedia,
): string | null {
  if (question.questionAudio || question.questionContext?.storyAudio) {
    return AUDIO_QUESTION_PROMPT;
  }

  return null;
}

export function questionChoiceFallbackLabel(
  question: QuestionChoiceMedia,
  codeAnswer: number,
): string {
  if (question.questionAudio || question.questionContext?.storyAudio) {
    return "Pilihan dari audio";
  }

  if (question.questionImage || question.questionContext?.storyImage) {
    return `Pilihan ${codeAnswer} pada gambar`;
  }

  return `Pilihan ${codeAnswer}`;
}
