export const PRIVACY_PATH = "/privacy";
export const TERMS_PATH = "/terms";

/** Penanda isian yang belum diketahui dari kode. Lihat `isLegalPlaceholder`. */
export const LEGAL_PLACEHOLDER_PREFIX = "[[ISI:";

// Fakta tentang pengelola dan infrastruktur produksi yang TIDAK dapat dipastikan
// dari repo. Semua isian dokumen hukum yang belum diketahui dikumpulkan di sini
// supaya mengisinya cukup dari satu tempat. Selama masih ada nilai berawalan
// `[[ISI:`, halaman menandainya dengan warna mencolok.
export const LEGAL_FACTS = {
  operatorName: "[[ISI: nama pengelola atau badan hukum]]",
  contactEmail: "[[ISI: email kontak privasi]]",
  // Kosongkan menjadi "" bila alamat tidak dicantumkan.
  postalAddress: "[[ISI: alamat korespondensi, atau kosongkan bila tidak dicantumkan]]",
  minimumAge: "[[ISI: usia minimum pengguna, mis. 13 atau 18 tahun]]",
  databaseRegion: "[[ISI: region server Supabase produksi]]",
  smtpProvider: "[[ISI: penyedia SMTP produksi]]",
  aiProvider: "[[ISI: penyedia model AI di balik OPENAI_BASE_URL produksi]]",
} as const;

export function isLegalPlaceholder(value: string) {
  return value.startsWith(LEGAL_PLACEHOLDER_PREFIX);
}
