// Peta kategori per jenis target — satu sumber kebenaran untuk form (client),
// schema zod, dan layar admin. JANGAN menyalin daftar ini ke tempat lain: dua
// salinan akan berbeda diam-diam begitu salah satunya diubah.
//
// File ini tidak mengimpor `@/constants` supaya dapat dipakai komponen client
// tanpa menarik validasi env server ke bundle browser.

export const REPORT_TARGET_TYPES = [
  "GENERAL",
  "QUESTION",
  "QUESTION_EXPLANATION",
  "ARTICLE",
  "COMMENT",
  "FLASHCARD_VOCAB",
  "BUNPOU_POINT",
  "BUNPOU_COMPARISON",
  "POST",
] as const;

export type ReportTargetTypeValue = (typeof REPORT_TARGET_TYPES)[number];

export const REPORT_CATEGORIES = [
  "BUG",
  "CONTENT_ERROR",
  "ANSWER_KEY",
  "MEDIA_ERROR",
  "EXPLANATION_ERROR",
  "ABUSE",
  "SUGGESTION",
  "OTHER",
  "READING_ERROR",
  "MEANING_ERROR",
  "EXAMPLE_ERROR",
  "TAG_ERROR",
  "CONNECTION_ERROR",
] as const;

export type ReportCategoryValue = (typeof REPORT_CATEGORIES)[number];

export const REPORT_STATUSES = [
  "OPEN",
  "IN_REVIEW",
  "RESOLVED",
  "REJECTED",
  "DUPLICATE",
] as const;

export type ReportStatusValue = (typeof REPORT_STATUSES)[number];

/**
 * Kategori yang boleh dipakai per target.
 *
 * `BUG` dan `OTHER` sengaja dibuka di semua target: user yang menemukan "tombol
 * berikutnya tidak jalan di soal 12" akan memaksa laporannya masuk kategori yang
 * salah bila satu-satunya pilihan di halaman soal adalah kategori konten. Yang
 * dibatasi target adalah kategori kontennya.
 *
 * Kartu flashcard sengaja TIDAK memakai `CONTENT_ERROR`. Empat kategorinya
 * menunjuk bagian fixture yang berbeda (bacaan, arti dan catatan, contoh kalimat,
 * tag), dan satu di antaranya diperbaiki dengan cara lain: bacaan kata ikut
 * membentuk `key`, jadi bacaan yang keliru tidak selesai dengan generate ulang.
 * Kategori serba-mencakup akan menyembunyikan pembedaan itu di dalam teks bebas.
 *
 * Pola bunpou memakai ulang kategori arti, contoh, dan furigana dari kartu
 * flashcard (petunjuknya disesuaikan lewat `REPORT_CATEGORY_HINT_OVERRIDES`),
 * ditambah `CONNECTION_ERROR` untuk sambungan dan tabel pembentukan. Perbandingan
 * cukup `CONTENT_ERROR`: isinya satu kesatuan (tabel dan kalimat kontras) yang
 * ditinjau ulang bersama.
 */
export const REPORT_CATEGORIES_BY_TARGET = {
  GENERAL: ["BUG", "SUGGESTION", "OTHER"],
  QUESTION: ["CONTENT_ERROR", "ANSWER_KEY", "MEDIA_ERROR", "BUG", "OTHER"],
  QUESTION_EXPLANATION: ["EXPLANATION_ERROR", "ANSWER_KEY", "BUG", "OTHER"],
  ARTICLE: ["CONTENT_ERROR", "BUG", "OTHER"],
  COMMENT: ["ABUSE", "OTHER"],
  FLASHCARD_VOCAB: ["READING_ERROR", "MEANING_ERROR", "EXAMPLE_ERROR", "TAG_ERROR", "BUG", "OTHER"],
  BUNPOU_POINT: [
    "MEANING_ERROR",
    "CONNECTION_ERROR",
    "EXAMPLE_ERROR",
    "READING_ERROR",
    "BUG",
    "OTHER",
  ],
  BUNPOU_COMPARISON: ["CONTENT_ERROR", "BUG", "OTHER"],
  // Postingan komunitas diperlakukan seperti entri diskusi: yang dilaporkan
  // adalah perilaku penulisnya, bukan isi aplikasi.
  POST: ["ABUSE", "OTHER"],
} as const satisfies Record<ReportTargetTypeValue, readonly ReportCategoryValue[]>;

export const REPORT_TARGET_TYPE_LABELS: Record<ReportTargetTypeValue, string> = {
  GENERAL: "Umum",
  QUESTION: "Soal",
  QUESTION_EXPLANATION: "Pembahasan",
  ARTICLE: "Artikel",
  COMMENT: "Diskusi",
  FLASHCARD_VOCAB: "Kartu flashcard",
  BUNPOU_POINT: "Pola bunpou",
  BUNPOU_COMPARISON: "Perbandingan bunpou",
  POST: "Postingan",
};

export const REPORT_CATEGORY_LABELS: Record<ReportCategoryValue, string> = {
  BUG: "Ada yang error",
  CONTENT_ERROR: "Salah tulis / isi keliru",
  ANSWER_KEY: "Kunci jawaban keliru",
  MEDIA_ERROR: "Audio atau gambar bermasalah",
  EXPLANATION_ERROR: "Pembahasan keliru",
  ABUSE: "Tidak pantas / melanggar",
  SUGGESTION: "Saran",
  OTHER: "Lainnya",
  READING_ERROR: "Bacaan / furigana salah",
  MEANING_ERROR: "Arti atau catatan keliru",
  EXAMPLE_ERROR: "Contoh kalimat bermasalah",
  TAG_ERROR: "Tag atau deck tidak cocok",
  CONNECTION_ERROR: "Sambungan / pembentukan salah",
};

export const REPORT_CATEGORY_HINTS: Record<ReportCategoryValue, string> = {
  BUG: "Tombol tidak bekerja, halaman gagal dimuat, tampilan rusak.",
  CONTENT_ERROR: "Typo, kalimat terpotong, furigana atau data yang salah.",
  ANSWER_KEY: "Kunci yang ditandai benar menurut Anda bukan jawaban yang tepat.",
  MEDIA_ERROR: "Audio tidak berbunyi, gambar tidak muncul, atau salah berkas.",
  EXPLANATION_ERROR: "Penjelasan tidak sesuai soal atau menyesatkan.",
  ABUSE: "Kasar, spam, promosi, atau membocorkan data orang lain.",
  SUGGESTION: "Ide fitur atau perbaikan pengalaman belajar.",
  OTHER: "Tidak masuk kategori mana pun di atas.",
  READING_ERROR: "Cara baca kata salah, atau furigana di kata maupun contoh kalimat tidak tepat.",
  MEANING_ERROR:
    "Arti Indonesia/Inggris salah atau menyesatkan, ada arti penting yang hilang, atau catatannya keliru.",
  EXAMPLE_ERROR:
    "Kalimat janggal atau tidak gramatikal, kata yang disorot salah, atau terjemahannya keliru.",
  TAG_ERROR:
    "Kelas kata, ragam, atau topiknya keliru, misalnya kata ini tidak seharusnya ada di deck tertentu.",
  CONNECTION_ERROR:
    "Bentuk yang disambungkan (mis. Vて形, Nの) keliru, atau tabel pembentukannya salah.",
};

/**
 * Petunjuk kategori yang berbeda untuk target tertentu. Kategori yang dipakai
 * ulang lintas target menunjuk bagian isi yang berbeda; petunjuk bawaan di atas
 * ditulis untuk kartu flashcard.
 */
const REPORT_CATEGORY_HINT_OVERRIDES: Partial<
  Record<ReportTargetTypeValue, Partial<Record<ReportCategoryValue, string>>>
> = {
  BUNPOU_POINT: {
    MEANING_ERROR:
      "Arti atau penjelasan pola keliru atau menyesatkan, atau ada pemakaian penting yang hilang.",
    EXAMPLE_ERROR:
      "Kalimat janggal atau tidak gramatikal, bagian pola yang disorot salah, atau terjemahannya keliru.",
    READING_ERROR: "Furigana di judul, contoh kalimat, atau penjelasan tidak tepat.",
  },
  BUNPOU_COMPARISON: {
    CONTENT_ERROR:
      "Tabel nuansa, ragam, atau batasan keliru, atau penilaian ○/△/✕ pada kalimat kontras salah.",
  },
};

export function reportCategoryHint(
  targetType: ReportTargetTypeValue,
  category: ReportCategoryValue,
) {
  return REPORT_CATEGORY_HINT_OVERRIDES[targetType]?.[category] ?? REPORT_CATEGORY_HINTS[category];
}

export const REPORT_STATUS_LABELS: Record<ReportStatusValue, string> = {
  OPEN: "Baru",
  IN_REVIEW: "Ditinjau",
  RESOLVED: "Selesai",
  REJECTED: "Ditolak",
  DUPLICATE: "Duplikat",
};

export const REPORT_MESSAGE_MIN_LENGTH = 20;
export const REPORT_MESSAGE_MAX_LENGTH = 2000;
export const REPORT_ADMIN_NOTE_MAX_LENGTH = 2000;
export const REPORT_REPLY_MIN_LENGTH = 20;
export const REPORT_REPLY_MAX_LENGTH = 2000;

/** Batas kolom `Report.targetLabel`; label dipotong, tidak ditolak. */
export const REPORT_TARGET_LABEL_MAX_LENGTH = 200;
export const REPORT_PAGE_PATH_MAX_LENGTH = 200;
export const REPORT_USER_AGENT_MAX_LENGTH = 400;

export function reportCategoriesFor(targetType: ReportTargetTypeValue) {
  return REPORT_CATEGORIES_BY_TARGET[targetType];
}

export function isReportCategoryAllowed(
  targetType: ReportTargetTypeValue,
  category: ReportCategoryValue,
) {
  return (REPORT_CATEGORIES_BY_TARGET[targetType] as readonly ReportCategoryValue[]).includes(
    category,
  );
}
