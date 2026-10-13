// Public transcript payload for surfaces that may reveal answers: read mode and
// completed-attempt review. Audit metadata remains server-side.
export const QUESTION_AUDIO_TRANSCRIPT_SELECT = {
  text: true,
} as const;

export type QuestionAudioTranscriptView = {
  text: string;
};
