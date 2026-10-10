type QuestionChoiceMedia = {
  questionAudio: string | null;
  questionImage: string | null;
  questionContext: {
    storyAudio: string | null;
    storyImage: string | null;
  } | null;
};

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
