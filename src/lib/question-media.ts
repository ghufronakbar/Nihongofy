type QuestionContextMedia = {
  storyText: string | null;
  storyImage: string | null;
  storyAudio: string | null;
};

export function shouldShowContextAudio(
  storyAudio: string | null,
  questionAudio: string | null,
) {
  return Boolean(storyAudio && !questionAudio);
}

export function shouldShowQuestionContext(
  context: QuestionContextMedia | null,
  questionAudio: string | null,
) {
  if (!context) return false;
  return Boolean(
    context.storyText ||
      context.storyImage ||
      shouldShowContextAudio(context.storyAudio, questionAudio),
  );
}
