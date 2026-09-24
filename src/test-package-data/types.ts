import type { JlptLevel, JlptSection, MondaiType } from "@prisma/client";

export type SeedQuestionChoice = {
  codeAnswer: number; // 1-4, harus unik per soal
  answerText: string; // boleh string kosong (soal audio-only, mis. 即時応答)
  answerImage?: string | null;
};

// Pembahasan soal. Satu soal punya paling banyak satu pembahasan (relasi 1:1 ke
// tabel QuestionExplanation), dan alasan tiap pilihan disimpan sebagai baris
// tersendiri, bukan sebagai blok JSON.
export type SeedQuestionExplanationChoice = {
  codeAnswer: number; // 1-4, harus cocok dengan codeAnswer pilihan soal
  reason: string; // kenapa pilihan ini benar/salah
};

export type SeedQuestionExplanation = {
  summary: string; // inti: kenapa kunci jawaban benar
  detail?: string | null; // pembahasan menyeluruh
  translation?: string | null; // terjemahan kalimat kunci ke bahasa Indonesia
  keyPoints?: string[]; // kosakata/grammar yang diuji
  choices?: SeedQuestionExplanationChoice[]; // 4 item bila diisi, satu per pilihan
  // Sinyal QA: diisi generator saat kunci jawaban fixture tampak keliru.
  answerKeyDoubt?: boolean;
  answerKeyDoubtNote?: string | null;
  meta?: {
    source?: "AI" | "HUMAN" | "IMPORTED";
    aiModel?: string | null;
    promptVersion?: string | null;
    generatedAt?: string | null; // ISO-8601
    // Diisi saat kunci jawaban sudah diverifikasi ulang dan penanda ragu dicabut.
    reviewedAt?: string | null; // ISO-8601
  };
};

export type SeedQuestion = {
  order: number; // nomor soal di dalam mondai, mulai dari 1
  questionText: string; // boleh string kosong; markup ringan, lihat docs/seed.md
  questionImage?: string | null;
  questionAudio?: string | null;
  questionAnswer: number; // codeAnswer yang benar (1-4), BUKAN id pilihan
  // String tunggal masih diterima (bentuk lama) dan dipetakan ke `summary`.
  explanation?: string | SeedQuestionExplanation | null;
  // Local reference ke `id` di SeedTestPackage.questionContexts — HANYA dipakai
  // di dalam file JSON ini untuk menghubungkan soal ke bacaan/audio bersama,
  // tidak pernah disimpan langsung ke database (di-resolve jadi questionContextId asli).
  questionContextRef?: string | null;
  questionChoices: SeedQuestionChoice[]; // harus tepat 4 pilihan
};

export type SeedTestPackageItem = {
  mondaiType: MondaiType;
  section: JlptSection;
  session: number; // 1 | 2 | 3, lihat docs/seed.md untuk jumlah sesi per level
  order: number; // urutan mondai di dalam sesi (問題1, 問題2, ...)
  instruction?: string | null;
  questions: SeedQuestion[];
};

export type SeedQuestionContext = {
  id: string; // local reference id (bebas, unik dalam satu testPackage), lihat questionContextRef
  storyText?: string | null;
  storyImage?: string | null;
  storyAudio?: string | null;
};

// Satu file JSON di folder ini = satu SeedTestPackage, bukan dibungkus array.
export type SeedTestPackage = {
  // HARUS unik — dipakai sebagai kunci deteksi duplikat antar run seed.
  // Kalau sudah ada TestPackage dengan `name` yang sama, seluruh paket ini di-skip.
  name: string;
  jlptLevel: JlptLevel;
  questionContexts?: SeedQuestionContext[];
  testPackageItems: SeedTestPackageItem[];
};
