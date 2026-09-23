// Bentuk pembahasan soal yang dipakai UI, sekaligus satu-satunya definisi
// `select` Prisma untuk relasi QuestionExplanation.
//
// Dipusatkan di sini karena aturan data-leak mode ujian (docs/database.md)
// melarang pembahasan ikut terkirim sebelum attempt disubmit: satu tempat yang
// menentukan kolom apa saja yang diambil lebih mudah ditinjau daripada select
// yang ditulis ulang di tiap feature.
export const QUESTION_EXPLANATION_SELECT = {
  summary: true,
  detail: true,
  translation: true,
  keyPoints: true,
  answerKeyDoubt: true,
  choices: {
    orderBy: { codeAnswer: "asc" },
    select: { codeAnswer: true, isCorrect: true, reason: true },
  },
} as const;

export type QuestionExplanationView = {
  summary: string;
  detail: string | null;
  translation: string | null;
  keyPoints: string[];
  answerKeyDoubt: boolean;
  choices: { codeAnswer: number; isCorrect: boolean; reason: string }[];
};
