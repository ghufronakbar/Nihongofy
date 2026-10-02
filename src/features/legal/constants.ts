export const PRIVACY_PATH = "/privacy";
export const TERMS_PATH = "/terms";

/** Penanda isian yang belum diketahui. Lihat `isLegalPlaceholder` dan `guard.ts`. */
export const LEGAL_PLACEHOLDER_PREFIX = "[[ISI:";

type LegalFactKey =
  | "operatorName"
  | "contactEmail"
  | "postalAddress"
  | "minimumAge"
  | "databaseRegion"
  | "smtpProvider"
  | "aiProvider";

// Fakta tentang pengelola dan infrastruktur produksi yang dipakai dokumen hukum,
// dikumpulkan di satu tempat. Nilai yang belum diketahui ditulis dengan awalan
// `[[ISI:`: halaman menandainya dengan warna mencolok dan build produksi gagal
// selama masih ada (`assertLegalDocumentPublishable`).
//
// Ubah nilai di sini bersamaan dengan infrastrukturnya: region database, penyedia
// SMTP, dan penyedia AI disebut apa adanya di Kebijakan Privasi.
export const LEGAL_FACTS: Readonly<Record<LegalFactKey, string>> = {
  operatorName: "Pengelola Nihongofy",
  contactEmail: "contact@lans.my.id",
  // String kosong = alamat tidak dicantumkan.
  postalAddress: "",
  minimumAge: "13 tahun",
  // Region pooler Supabase pada DATABASE_URL.
  databaseRegion: "Singapura (AWS ap-southeast-1)",
  // SMTP_HOST=smtp.gmail.com.
  smtpProvider: "Google (Gmail)",
  // Provider OpenAI-compatible lewat OPENAI_BASE_URL (gateway milik pengelola).
  aiProvider: "OpenAI, melalui gateway API milik pengelola",
};

export function isLegalPlaceholder(value: string) {
  return value.startsWith(LEGAL_PLACEHOLDER_PREFIX);
}
