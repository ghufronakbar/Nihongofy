import type { JlptLevel, JlptSection, MondaiType } from "@prisma/client";

// Bentuk data lembar soal cetak. Sengaja tanpa `questionAnswer` dan pembahasan:
// lembar soal dibagikan ke peserta, jadi kunci tidak perlu ikut diambil.
// Kunci jawaban punya bentuk sendiri (AnswerKeyPackage, di bawah).

export type PrintChoice = {
  codeAnswer: number;
  answerText: string;
  answerImage: string | null;
};

export type PrintContext = {
  id: number;
  storyText: string | null;
  storyImage: string | null;
};

export type PrintQuestion = {
  id: number;
  order: number;
  questionText: string;
  questionImage: string | null;
  questionContext: PrintContext | null;
  questionChoices: PrintChoice[];
};

export type PrintItem = {
  id: number;
  session: number;
  order: number;
  section: JlptSection;
  mondaiType: MondaiType;
  instruction: string | null;
  questions: PrintQuestion[];
};

export type PrintPackage = {
  name: string;
  jlptLevel: JlptLevel;
  testPackageItems: PrintItem[];
};

// Bagian soal yang dibutuhkan penomoran. Lembar soal dan kunci jawaban sama-sama
// memenuhinya, jadi nomor di keduanya selalu cocok.
export type NumberedQuestion = Pick<PrintQuestion, "id" | "order" | "questionText">;

export type NumberedItem<Q extends NumberedQuestion = NumberedQuestion> = Pick<
  PrintItem,
  "session" | "order" | "section" | "mondaiType"
> & { questions: Q[] };

// Kunci jawaban diambil lewat query terpisah, hanya berisi yang perlu untuk
// penomoran plus jawaban benar. Lembar soal tetap tidak pernah memuat kunci.
export type AnswerKeyQuestion = NumberedQuestion & { questionAnswer: number };

export type AnswerKeyItem = NumberedItem<AnswerKeyQuestion> & { id: number };

export type AnswerKeyPackage = {
  name: string;
  jlptLevel: JlptLevel;
  testPackageItems: AnswerKeyItem[];
};

/** `null` = lembar tanpa identitas situs sama sekali (judul, kepala, kaki halaman). */
export type PrintBranding = {
  name: string;
  host: string;
};
