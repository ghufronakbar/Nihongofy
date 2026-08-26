import type { JlptLevel, JlptSection, MondaiType } from "@prisma/client";

export type SeedQuestionChoice = {
  codeAnswer: number; // 1-4, harus unik per soal
  answerText: string; // boleh string kosong (soal audio-only, mis. 即時応答)
  answerImage?: string | null;
};

export type SeedQuestion = {
  order: number; // nomor soal di dalam mondai, mulai dari 1
  questionText: string; // boleh string kosong; markup ringan, lihat docs/seed.md
  questionImage?: string | null;
  questionAudio?: string | null;
  questionAnswer: number; // codeAnswer yang benar (1-4), BUKAN id pilihan
  explanation?: string | null;
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
