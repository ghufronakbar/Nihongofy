import type { FlashcardRatingInput } from "../schemas";

/** Empat tombol jawaban Anki beserta pintasan keyboard dan warnanya. */
export const RATING_OPTIONS: {
  value: FlashcardRatingInput;
  label: string;
  key: string;
  tone: string;
}[] = [
  { value: "AGAIN", label: "Again", key: "1", tone: "bg-neo-coral text-black" },
  { value: "HARD", label: "Hard", key: "2", tone: "bg-neo-yellow text-black" },
  { value: "GOOD", label: "Good", key: "3", tone: "bg-neo-green text-black" },
  { value: "EASY", label: "Easy", key: "4", tone: "bg-neo-blue text-black" },
];
