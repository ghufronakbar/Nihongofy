import type { JlptLevel, JlptSection, MondaiType } from "@prisma/client";

export const JLPT_LEVEL_ORDER: JlptLevel[] = ["N1", "N2", "N3", "N4", "N5"];

export const JLPT_SECTION_LABELS: Record<JlptSection, string> = {
  MOJI_GOI: "Moji-Goi (文字・語彙)",
  BUNPOU: "Bunpou (文法)",
  DOKKAI: "Dokkai (読解)",
  CHOUKAI: "Choukai (聴解)",
};

// Waktu resmi JLPT per level & sesi. TIDAK disimpan di database (lihat
// docs/database.md "Timer") — referensi statis dari jlpt.jp, dipakai sebagai
// acuan timer manual di halaman detail paket.
// Source: https://www.jlpt.jp/e/guideline/testsections.html
export const JLPT_SESSION_TIMING: Record<
  JlptLevel,
  { session: number; label: string; durationMinutes: number }[]
> = {
  N1: [
    { session: 1, label: "Moji-Goi / Bunpou / Dokkai", durationMinutes: 110 },
    { session: 2, label: "Choukai", durationMinutes: 55 },
  ],
  N2: [
    { session: 1, label: "Moji-Goi / Bunpou / Dokkai", durationMinutes: 105 },
    { session: 2, label: "Choukai", durationMinutes: 50 },
  ],
  N3: [
    { session: 1, label: "Moji-Goi", durationMinutes: 30 },
    { session: 2, label: "Bunpou / Dokkai", durationMinutes: 70 },
    { session: 3, label: "Choukai", durationMinutes: 40 },
  ],
  N4: [
    { session: 1, label: "Moji-Goi", durationMinutes: 25 },
    { session: 2, label: "Bunpou / Dokkai", durationMinutes: 55 },
    { session: 3, label: "Choukai", durationMinutes: 35 },
  ],
  N5: [
    { session: 1, label: "Moji-Goi", durationMinutes: 20 },
    { session: 2, label: "Bunpou / Dokkai", durationMinutes: 40 },
    { session: 3, label: "Choukai", durationMinutes: 30 },
  ],
};

// Batas lulus total resmi JLPT (skala 0–180). Batas minimum per seksi (mis.
// 19 poin) tidak dimodelkan karena app memakai skala 3×60 seragam untuk semua
// level — lihat src/lib/jlpt-score.ts. Dipakai sebagai garis acuan di report.
// Source: https://www.jlpt.jp/e/guideline/results.html
export const JLPT_PASS_MARK: Record<JlptLevel, number> = {
  N1: 100,
  N2: 90,
  N3: 95,
  N4: 90,
  N5: 80,
};

export const MONDAI_TYPE_LABELS: Record<MondaiType, string> = {
  MOJI_GOI_READ_KANJI: "漢字読み",
  MOJI_GOI_WRITE_KANJI: "表記",
  MOJI_GOI_WORD_FORMATION: "語形成",
  MOJI_GOI_CONTEXT: "文脈規定",
  MOJI_GOI_SYNONYM: "言い換え類義",
  MOJI_GOI_WORD_USAGE: "用法",
  BUNPOU_GRAMMAR: "文法形式の判断",
  BUNPOU_SENTENCE_COMPOSITION: "文の組み立て",
  BUNPOU_TEXT_GRAMMAR: "文章の文法",
  DOKKAI_SHORT_TEXT: "内容理解（短文）",
  DOKKAI_MEDIUM_TEXT: "内容理解（中文）",
  DOKKAI_LONG_TEXT: "内容理解（長文）",
  DOKKAI_INTEGRATED: "統合理解（読解）",
  DOKKAI_MAIN_IDEA: "主張理解",
  DOKKAI_INFORMATION_RETRIEVAL: "情報検索",
  CHOUKAI_TASK_BASED: "課題理解",
  CHOUKAI_MAIN_POINT: "ポイント理解",
  CHOUKAI_OUTLINE: "概要理解",
  CHOUKAI_EXPRESSION: "発話表現",
  CHOUKAI_QUICK_RESPONSE: "即時応答",
  CHOUKAI_INTEGRATED: "統合理解（聴解）",
};

// Terjemahan Indonesia — dipakai bareng MONDAI_TYPE_LABELS lewat
// mondaiTypeFullLabel() di tempat yang punya ruang cukup (judul card, baris
// tabel). Di tempat sempit (kolom tabel lebar, nav sidebar) tetap pakai
// MONDAI_TYPE_LABELS saja + `title` attribute untuk tooltip.
export const MONDAI_TYPE_TRANSLATIONS: Record<MondaiType, string> = {
  MOJI_GOI_READ_KANJI: "Cara Baca Kanji",
  MOJI_GOI_WRITE_KANJI: "Penulisan Kanji",
  MOJI_GOI_WORD_FORMATION: "Pembentukan Kata",
  MOJI_GOI_CONTEXT: "Kata Sesuai Konteks",
  MOJI_GOI_SYNONYM: "Sinonim",
  MOJI_GOI_WORD_USAGE: "Penggunaan Kata",
  BUNPOU_GRAMMAR: "Bentuk Tata Bahasa",
  BUNPOU_SENTENCE_COMPOSITION: "Susun Kalimat",
  BUNPOU_TEXT_GRAMMAR: "Tata Bahasa Wacana",
  DOKKAI_SHORT_TEXT: "Pemahaman Teks Pendek",
  DOKKAI_MEDIUM_TEXT: "Pemahaman Teks Sedang",
  DOKKAI_LONG_TEXT: "Pemahaman Teks Panjang",
  DOKKAI_INTEGRATED: "Pemahaman Terpadu",
  DOKKAI_MAIN_IDEA: "Pemahaman Opini Penulis",
  DOKKAI_INFORMATION_RETRIEVAL: "Pencarian Informasi",
  CHOUKAI_TASK_BASED: "Pemahaman Tugas",
  CHOUKAI_MAIN_POINT: "Pemahaman Poin Penting",
  CHOUKAI_OUTLINE: "Pemahaman Garis Besar",
  CHOUKAI_EXPRESSION: "Ungkapan Situasional",
  CHOUKAI_QUICK_RESPONSE: "Respon Cepat",
  CHOUKAI_INTEGRATED: "Pemahaman Terpadu (Audio)",
};

export function mondaiTypeFullLabel(mondaiType: MondaiType): string {
  return `${MONDAI_TYPE_LABELS[mondaiType]} (${MONDAI_TYPE_TRANSLATIONS[mondaiType]})`;
}
