// Transcript payload for read mode, completed-attempt review, and answered
// practice feedback. Audit metadata remains server-side.
export const QUESTION_AUDIO_TRANSCRIPT_SELECT = {
  text: true,
} as const;

export type QuestionAudioTranscriptView = {
  text: string;
};
