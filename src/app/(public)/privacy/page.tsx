import type { Metadata } from "next";
import { LegalDocumentView } from "@/features/legal/components/legal-document";
import { env } from "@/constants";
import { PRIVACY_POLICY } from "@/features/legal/content/privacy-policy";
import { assertLegalDocumentPublishable } from "@/features/legal/guard";
import { pageMetadata } from "@/lib/seo";

// Dokumen hukum di-prerender saat build: tanpa query database dan tanpa feature
// flag, supaya tidak pernah ikut mati bersama modul lain. `force-static` membuat
// `cookies()` di layout publik kosong, sehingga header selalu tampil sebagai tamu
// di halaman ini.
export const dynamic = "force-static";

// Build produksi gagal selama masih ada placeholder `[[ISI:` (lihat guard.ts).
assertLegalDocumentPublishable(PRIVACY_POLICY, env.VERCEL_ENV);

export const metadata: Metadata = pageMetadata({
  title: PRIVACY_POLICY.title,
  description: PRIVACY_POLICY.description,
  path: PRIVACY_POLICY.path,
});

export default function PrivacyPage() {
  return <LegalDocumentView document={PRIVACY_POLICY} />;
}
