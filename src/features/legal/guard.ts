import { isLegalPlaceholder, LEGAL_FACTS } from "./constants";
import type { LegalDocument } from "./types";

// Penjaga supaya dokumen hukum berisi placeholder `[[ISI:` tidak pernah terbit
// di produksi. Dipanggil di module scope halaman /privacy dan /terms: kedua
// halaman di-prerender saat build, jadi lemparan di sini menggagalkan build.
//
// Hanya `VERCEL_ENV=production` yang dijaga. Build lokal dan preview tetap jalan
// supaya isi yang belum lengkap masih bisa ditinjau di browser.
//
// Cakupannya `LEGAL_FACTS` dan `effectiveDate`. Isi dokumen sendiri tidak boleh
// memuat placeholder literal; `guard.test.ts` memeriksa sumbernya.

export function collectLegalPlaceholders(
  document: Pick<LegalDocument, "effectiveDate" | "lastUpdated" | "version">,
  facts: Readonly<Record<string, string>> = LEGAL_FACTS,
) {
  const values = [...Object.values(facts), document.effectiveDate, document.lastUpdated, document.version];
  return [...new Set(values.filter(isLegalPlaceholder))];
}

export function assertLegalDocumentPublishable(
  document: Pick<LegalDocument, "path" | "effectiveDate" | "lastUpdated" | "version">,
  vercelEnv: string | undefined,
  facts: Readonly<Record<string, string>> = LEGAL_FACTS,
) {
  if (vercelEnv !== "production") return;

  const placeholders = collectLegalPlaceholders(document, facts);
  if (placeholders.length === 0) return;

  throw new Error(
    `Dokumen hukum ${document.path} masih memuat placeholder: ${placeholders.join(", ")}. ` +
      "Isi LEGAL_FACTS di src/features/legal/constants.ts dan EFFECTIVE_DATE di " +
      "src/features/legal/content/ sebelum deploy produksi.",
  );
}
